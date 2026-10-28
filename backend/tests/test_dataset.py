from datetime import date

import pytest

from app.config import GATES, GateId
from app.dataset import WindDataset

N2EX = GATES[GateId.N2EX]  # 09:50
EPEX = GATES[GateId.EPEX_HOURLY]  # 09:20
HALF_HOURLY = GATES[GateId.HALF_HOURLY]  # 15:30


def forecast(published: str, start: str, mw: float) -> dict:
    return {"publishTime": published, "startTime": start, "generation": mw}


def actual(start: str, mw: float) -> dict:
    return {"startTime": start, "generation": mw, "fuelType": "WIND"}


@pytest.fixture
def one_hour() -> WindDataset:
    # Delivery hour 10 Jan 00:00 with runs either side of each gate
    target = "2026-01-10T00:00:00Z"
    return WindDataset(
        actual_records=[actual("2026-01-10T00:00:00Z", 150), actual("2026-01-10T00:30:00Z", 250)],
        forecast_records=[
            forecast("2026-01-09T07:30:00Z", target, 100),
            forecast("2026-01-09T09:30:00Z", target, 200),
            forecast("2026-01-09T09:50:00Z", target, 300),  # exactly at the N2EX gate
            forecast("2026-01-10T01:00:00Z", target, 999),  # stale carry-over, after the hour
        ],
    )


def test_stale_rows_dropped(one_hour):
    assert 999 not in one_hour.forecasts["forecast_mw"].tolist()
    assert (one_hour.forecasts["horizon_h"] >= 0).all()


def test_actuals_averaged_to_hourly(one_hour):
    assert one_hour.actuals_hourly.tolist() == [200.0]


def test_incomplete_hour_is_dropped():
    data = WindDataset([actual("2026-01-10T00:00:00Z", 150)], [])
    assert data.actuals_hourly.empty


@pytest.mark.parametrize(
    "gate, expected_mw",
    [
        (EPEX, 100),  # only the 07:30 run is before 09:20
        (N2EX, 200),  # 09:30 run; the 09:50 run is not strictly before the gate
        (HALF_HOURLY, 300),  # latest run before 15:30
    ],
)
def test_decision_uses_latest_run_strictly_before_gate(one_hour, gate, expected_mw):
    row = one_hour.decisions_for_day(gate, date(2026, 1, 10)).iloc[0]
    assert row["forecast_mw"] == expected_mw


def test_decision_error_sign(one_hour):
    row = one_hour.decisions_for_day(EPEX, date(2026, 1, 10)).iloc[0]
    assert row["actual_mw"] == 200
    assert row["error_mw"] == -100  # forecast 100 - actual 200: under-forecast


@pytest.fixture
def daily_errors() -> WindDataset:
    """One hour per delivery day, 1..12 Jan. Day d is over-forecast by d*10 MW,
    except 9 Jan which is wildly off (so we can tell if it leaks into the band)"""
    actuals, forecasts = [], []
    for day in range(1, 13):
        error = 10_000 if day == 9 else day * 10
        start = f"2026-01-{day:02d}T00:00:00Z"
        published = f"2026-01-{day - 1:02d}T08:00:00Z" if day > 1 else "2025-12-31T08:00:00Z"
        actuals += [actual(start, 1000), actual(start.replace("00:00:00", "00:30:00"), 1000)]
        forecasts.append(forecast(published, start, 1000 + error))
    return WindDataset(actuals, forecasts)


def test_band_uses_only_days_settled_before_the_gate(daily_errors):
    band = daily_errors.error_band(N2EX, date(2026, 1, 10))
    # Bidding for 10 Jan happens on 9 Jan, so 9 Jan itself must be excluded
    assert band["history_to"] == date(2026, 1, 8)
    assert band["error_high_mw"] < 10_000
    assert band["history_days"] == 8


def test_adjustment_subtracts_mean_error_of_settled_days(daily_errors):
    row = daily_errors.decisions_for_day(N2EX, date(2026, 1, 10)).iloc[0]
    # Days 1-8 Jan were over-forecast by 10..80 MW: mean 45. 9 Jan (10 GW) must not leak in
    assert row["adjusted_mw"] == row["forecast_mw"] - 45


def test_adjustment_falls_back_to_raw_without_history(daily_errors):
    row = daily_errors.decisions_for_day(N2EX, date(2026, 1, 3)).iloc[0]
    assert row["adjusted_mw"] == row["forecast_mw"]
    assert row["band_low_mw"] != row["band_low_mw"]  # NaN: no range yet


def test_band_needs_minimum_history(daily_errors):
    # For 4 Jan only 1-2 Jan are settled: below BAND_MIN_DAYS (3)
    assert daily_errors.error_band(N2EX, date(2026, 1, 4)) is None
    assert daily_errors.error_band(N2EX, date(2026, 1, 5))["history_days"] == 3
