"""Turns raw Elexon records into the tables the API serves.

Conventions used everywhere:
- Timestamps are tz-aware UTC. A "delivery day" is the UK local calendar date
  of the target hour.
- error = forecast - actual, in MW. Positive means over-forecast: less wind
  arrived than expected, so a buyer relying on the forecast is short.
- WINDFOR is hourly, FUELHH is half-hourly. We compare at hourly resolution,
  averaging the two half-hours of each hour.
"""

from datetime import date, datetime, timedelta

import pandas as pd

from app import config
from app.config import Gate, GateId, UK_TZ


def actuals_frame(records: list[dict]) -> pd.Series:
    """Half-hourly wind outturn (MW), indexed by settlement period start."""
    raw = pd.DataFrame.from_records(records, columns=["startTime", "generation"])
    series = pd.Series(
        raw["generation"].astype(float).to_numpy(),
        index=pd.to_datetime(raw["startTime"], utc=True),
        name="actual_mw",
    )
    return series[~series.index.duplicated(keep="last")].sort_index()


def to_hourly(half_hourly: pd.Series) -> pd.Series:
    """Mean of the :00 and :30 half-hours; hours missing either are dropped."""
    grouped = half_hourly.groupby(half_hourly.index.floor("h"))
    means, counts = grouped.mean(), grouped.count()
    return means[counts == 2].rename("actual_mw")


def forecasts_frame(records: list[dict]) -> pd.DataFrame:
    """One row per (forecast run, target hour), future hours only."""
    raw = pd.DataFrame.from_records(records, columns=["publishTime", "startTime", "generation"])
    frame = pd.DataFrame(
        {
            "publish_time": pd.to_datetime(raw["publishTime"], utc=True),
            "start_time": pd.to_datetime(raw["startTime"], utc=True),
            "forecast_mw": raw["generation"].astype(float),
        }
    )
    frame["horizon_h"] = (frame["start_time"] - frame["publish_time"]).dt.total_seconds() / 3600
    # Every WINDFOR run also repeats hours already in the past, frozen at the
    # values of earlier runs. Those are not forecasts, so drop them.
    frame = frame[frame["horizon_h"] >= 0]
    frame = frame.drop_duplicates(["publish_time", "start_time"], keep="last")
    frame["delivery_day"] = local_dates(frame["start_time"])
    return frame.reset_index(drop=True)


def local_dates(timestamps: pd.Series) -> pd.Series:
    return timestamps.dt.tz_convert(UK_TZ).dt.date


def gate_cutoff(delivery_day: date, gate: Gate) -> pd.Timestamp:
    """The moment bids for `delivery_day` close: gate time, UK local, on D-1."""
    local = datetime.combine(delivery_day - timedelta(days=1), gate.closes_at, tzinfo=UK_TZ)
    return pd.Timestamp(local).tz_convert("UTC")


class WindDataset:
    def __init__(self, actual_records: list[dict], forecast_records: list[dict], fetched_at: datetime | None = None):
        self.fetched_at = fetched_at
        self.actuals_half_hourly = actuals_frame(actual_records)
        self.actuals_hourly = to_hourly(self.actuals_half_hourly)
        self.forecasts = forecasts_frame(forecast_records)
        self._decisions: dict[GateId, pd.DataFrame] = {}
        self._history: dict[GateId, pd.DataFrame] = {}
        self._scored: dict[GateId, pd.DataFrame] = {}

    @property
    def forecast_run_count(self) -> int:
        return int(self.forecasts["publish_time"].nunique())

    def decisions(self, gate: Gate) -> pd.DataFrame:
        """For every target hour: the forecast a buyer had when `gate` closed.

        That is the latest forecast published strictly before the cutoff for
        the hour's delivery day. Covers the warm-up day too (for the band).
        """
        if gate.id not in self._decisions:
            self._decisions[gate.id] = self._build_decisions(gate)
        return self._decisions[gate.id]

    def _build_decisions(self, gate: Gate) -> pd.DataFrame:
        forecasts = self.forecasts
        cutoffs = {day: gate_cutoff(day, gate) for day in forecasts["delivery_day"].unique()}
        cutoff = pd.to_datetime(forecasts["delivery_day"].map(cutoffs), utc=True)
        eligible = forecasts[forecasts["publish_time"] < cutoff]
        latest = eligible.sort_values("publish_time").groupby("start_time").tail(1)
        in_scope = latest["delivery_day"].between(config.WARMUP_DELIVERY_DAY, config.LAST_DELIVERY_DAY)
        table = latest[in_scope].sort_values("start_time").reset_index(drop=True)
        table["actual_mw"] = table["start_time"].map(self.actuals_hourly)
        table["error_mw"] = table["forecast_mw"] - table["actual_mw"]
        return table

    def history(self, gate: Gate) -> pd.DataFrame:
        """Per delivery day: error statistics of the recent decision forecasts
        a buyer could actually see when bidding at `gate`.

        When bidding for day D (at the gate on D-1), day D-1 is still in
        progress, so the newest fully settled day is D-2. Using D-1 would leak
        information the buyer did not have. Statistics are NaN until
        BAND_MIN_DAYS of history exist.
        """
        if gate.id not in self._history:
            self._history[gate.id] = self._build_history(gate)
        return self._history[gate.id]

    def _build_history(self, gate: Gate) -> pd.DataFrame:
        decisions = self.decisions(gate)
        settled = decisions.dropna(subset=["error_mw"])
        low_q, high_q = config.BAND_QUANTILES
        rows = []
        for day in sorted(decisions["delivery_day"].unique()):
            history_to = day - timedelta(days=2)
            history_from = history_to - timedelta(days=config.BAND_TRAILING_DAYS - 1)
            window = settled[settled["delivery_day"].between(history_from, history_to)]
            days = int(window["delivery_day"].nunique())
            enough = days >= config.BAND_MIN_DAYS
            errors = window["error_mw"]
            rows.append(
                {
                    "delivery_day": day,
                    "history_days": days,
                    "history_from": window["delivery_day"].min() if days else None,
                    "history_to": window["delivery_day"].max() if days else None,
                    "error_low_mw": errors.quantile(low_q) if enough else float("nan"),
                    "error_high_mw": errors.quantile(high_q) if enough else float("nan"),
                    "mean_error_mw": errors.mean() if enough else float("nan"),
                }
            )
        return pd.DataFrame(rows).set_index("delivery_day")

    def scored(self, gate: Gate) -> pd.DataFrame:
        """Decision forecasts plus everything derived from history at the gate:

        - band_low_mw / band_high_mw: likely range for the actual. Since
          actual = forecast - error, the error quantiles flip sides. Generation
          can't be negative, so the low side is floored at 0.
        - adjusted_mw: forecast minus recent mean error (our bias adjustment,
          not Elexon's). Falls back to the raw forecast until there is history.
        """
        if gate.id not in self._scored:
            table = self.decisions(gate).join(self.history(gate), on="delivery_day")
            table["band_low_mw"] = (table["forecast_mw"] - table["error_high_mw"]).clip(lower=0)
            table["band_high_mw"] = table["forecast_mw"] - table["error_low_mw"]
            table["adjusted_mw"] = (table["forecast_mw"] - table["mean_error_mw"].fillna(0)).clip(lower=0)
            table["adjusted_error_mw"] = table["adjusted_mw"] - table["actual_mw"]
            self._scored[gate.id] = table
        return self._scored[gate.id]

    def decisions_for_day(self, gate: Gate, delivery_day: date) -> pd.DataFrame:
        table = self.scored(gate)
        return table[table["delivery_day"] == delivery_day].reset_index(drop=True)

    def decisions_in_range(self, gate: Gate, first_day: date, last_day: date) -> pd.DataFrame:
        table = self.scored(gate)
        return table[table["delivery_day"].between(first_day, last_day)].reset_index(drop=True)

    def error_band(self, gate: Gate, delivery_day: date) -> dict | None:
        """The history behind one delivery day's range and adjustment, or None if too little."""
        history = self.history(gate)
        if delivery_day not in history.index:
            return None
        row = history.loc[delivery_day]
        if row["history_days"] < config.BAND_MIN_DAYS:
            return None
        low_q, high_q = config.BAND_QUANTILES
        return {
            "low_quantile": low_q,
            "high_quantile": high_q,
            "error_low_mw": float(row["error_low_mw"]),
            "error_high_mw": float(row["error_high_mw"]),
            "mean_error_mw": float(row["mean_error_mw"]),
            "history_days": int(row["history_days"]),
            "history_from": row["history_from"],
            "history_to": row["history_to"],
        }

    def horizon_errors(self, first_day: date, last_day: date) -> pd.DataFrame:
        """Every forecast (any run, 0..MAX_HORIZON_HOURS ahead) against outturn."""
        forecasts = self.forecasts
        mask = (forecasts["horizon_h"] <= config.MAX_HORIZON_HOURS) & forecasts["delivery_day"].between(
            first_day, last_day
        )
        table = forecasts[mask].copy()
        table["actual_mw"] = table["start_time"].map(self.actuals_hourly)
        table = table.dropna(subset=["actual_mw"])
        table["error_mw"] = table["forecast_mw"] - table["actual_mw"]
        return table
