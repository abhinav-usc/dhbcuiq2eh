# Error statistics. Inputs are frames from dataset.py (error = forecast - actual)

import math

import numpy as np
import pandas as pd

from app.config import UK_TZ


def error_stats(table: pd.DataFrame, column: str = "error_mw") -> dict:
    """Statistics of one error column (raw `error_mw` or `adjusted_error_mw`).

    short/long are hourly errors summed as energy: buying against this
    forecast, how many MWh would have been missing (short) or surplus (long)
    """
    scored = table.dropna(subset=[column])
    errors = scored[column]
    if errors.empty:
        return {"n": 0}
    abs_errors = errors.abs()
    return {
        "n": int(len(errors)),
        "mae_mw": float(abs_errors.mean()),
        "bias_mw": float(errors.mean()),
        "rmse_mw": math.sqrt(float((errors**2).mean())),
        "p50_abs_mw": float(abs_errors.quantile(0.5)),
        "p90_abs_mw": float(abs_errors.quantile(0.9)),
        "max_abs_mw": float(abs_errors.max()),
        "mean_actual_mw": float(scored["actual_mw"].mean()),
        "short_mwh": float(errors[errors > 0].sum()),
        "long_mwh": float(-errors[errors < 0].sum()),
    }


def energy_totals(table: pd.DataFrame) -> dict:
    # Hourly MW summed over hours = MWh. Errors compare like-for-like hours
    scored = table.dropna(subset=["actual_mw"])
    has_actual = not scored.empty
    return {
        "forecast_mwh": float(table["forecast_mw"].sum()),
        "adjusted_mwh": float(table["adjusted_mw"].sum()),
        "actual_mwh": float(scored["actual_mw"].sum()) if has_actual else None,
        "error_mwh": float(scored["error_mw"].sum()) if has_actual else None,
        "adjusted_error_mwh": float(scored["adjusted_error_mw"].sum()) if has_actual else None,
        "hours": int(len(table)),
        "hours_with_actual": int(len(scored)),
    }


def band_coverage(table: pd.DataFrame) -> dict:
    # How often the actual fell inside the likely range (target: P90 - P10)
    scored = table.dropna(subset=["actual_mw", "band_low_mw", "band_high_mw"])
    hours = len(scored)
    if hours == 0:
        return {"hours": 0}
    below = int((scored["actual_mw"] < scored["band_low_mw"]).sum())
    above = int((scored["actual_mw"] > scored["band_high_mw"]).sum())
    return {
        "hours": hours,
        "inside": (hours - below - above) / hours,
        "below": below / hours,
        "above": above / hours,
    }


def by_horizon(table: pd.DataFrame, bucket_hours: int) -> list[dict]:
    if table.empty:
        return []
    buckets = (table["horizon_h"] // bucket_hours * bucket_hours).astype(int)
    grouped = table.groupby(buckets)["error_mw"]
    return [
        {
            "horizon_from_h": int(start),
            "horizon_to_h": int(start + bucket_hours),
            "n": int(group.size),
            "mae_mw": float(group.abs().mean()),
            "bias_mw": float(group.mean()),
        }
        for start, group in grouped
    ]


def histogram(table: pd.DataFrame, bin_mw: int) -> list[dict]:
    # Bins centred on multiples of bin_mw, so one bin sits on zero ("about right")
    errors = table["error_mw"].dropna()
    if errors.empty:
        return []
    first_center = round(errors.min() / bin_mw) * bin_mw
    last_center = round(errors.max() / bin_mw) * bin_mw
    centers = np.arange(first_center, last_center + bin_mw, bin_mw)
    edges = np.append(centers - bin_mw / 2, centers[-1] + bin_mw / 2)
    counts, _ = np.histogram(errors, bins=edges)
    return [
        {
            "center_mw": float(centers[i]),
            "from_mw": float(edges[i]),
            "to_mw": float(edges[i + 1]),
            "count": int(count),
        }
        for i, count in enumerate(counts)
    ]


def by_hour_of_day(table: pd.DataFrame) -> list[dict]:
    scored = table.dropna(subset=["error_mw"])
    hours = scored["start_time"].dt.tz_convert(UK_TZ).dt.hour
    grouped = scored.groupby(hours)["error_mw"]
    return [
        {"hour": int(hour), "n": int(group.size), "mae_mw": float(group.abs().mean()), "bias_mw": float(group.mean())}
        for hour, group in grouped
    ]


def daily(table: pd.DataFrame) -> list[dict]:
    rows = []
    for day, group in table.groupby("delivery_day"):
        totals = energy_totals(group)
        stats = error_stats(group)
        rows.append(
            {
                "delivery_day": day,
                "forecast_mwh": totals["forecast_mwh"],
                "adjusted_mwh": totals["adjusted_mwh"],
                "actual_mwh": totals["actual_mwh"],
                "mae_mw": stats.get("mae_mw"),
                "bias_mw": stats.get("bias_mw"),
            }
        )
    return rows
