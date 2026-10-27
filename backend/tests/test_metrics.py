import math

import pandas as pd
import pytest

from app import metrics


def table(errors: list[float], actual: float = 100.0, adjust_by: float = 0.0) -> pd.DataFrame:
    return pd.DataFrame(
        {
            "start_time": pd.date_range("2026-01-10", periods=len(errors), freq="h", tz="UTC"),
            "forecast_mw": [actual + e for e in errors],
            "adjusted_mw": [actual + e - adjust_by for e in errors],
            "actual_mw": [actual] * len(errors),
            "error_mw": errors,
            "adjusted_error_mw": [e - adjust_by for e in errors],
            "horizon_h": [0.5 + i for i in range(len(errors))],
        }
    )


def test_error_stats():
    stats = metrics.error_stats(table([1, -1, 2, -2]))
    assert stats["n"] == 4
    assert stats["mae_mw"] == 1.5
    assert stats["bias_mw"] == 0
    assert stats["rmse_mw"] == pytest.approx(math.sqrt(2.5))
    assert stats["max_abs_mw"] == 2


def test_error_stats_empty():
    assert metrics.error_stats(table([])) == {"n": 0}


def test_short_and_long_energy():
    stats = metrics.error_stats(table([30, -10, 5]))
    assert stats["short_mwh"] == 35  # over-forecast hours: energy missing
    assert stats["long_mwh"] == 10  # under-forecast hours: energy surplus


def test_error_stats_on_adjusted_column():
    stats = metrics.error_stats(table([30, 10], adjust_by=20), column="adjusted_error_mw")
    assert stats["bias_mw"] == 0
    assert stats["mae_mw"] == 10


def test_energy_totals():
    totals = metrics.energy_totals(table([10, 20], adjust_by=5))
    assert totals["forecast_mwh"] == 230
    assert totals["adjusted_mwh"] == 220
    assert totals["actual_mwh"] == 200
    assert totals["error_mwh"] == 30
    assert totals["adjusted_error_mwh"] == 20


def test_band_coverage():
    frame = table([0, 0, 0, 0]).assign(band_low_mw=[90, 90, 110, None], band_high_mw=[110, 95, 120, None])
    # actual is 100 everywhere: inside, above, below, and one hour with no band (ignored)
    assert metrics.band_coverage(frame) == {"hours": 3, "inside": 1 / 3, "below": 1 / 3, "above": 1 / 3}


def test_by_horizon_buckets():
    rows = metrics.by_horizon(table([1, 2, 3, 4]), bucket_hours=2)  # horizons 0.5, 1.5, 2.5, 3.5
    assert [(r["horizon_from_h"], r["n"], r["bias_mw"]) for r in rows] == [(0, 2, 1.5), (2, 2, 3.5)]


def test_histogram_bins_are_centred_on_multiples():
    bins = metrics.histogram(table([-600, -100, 50, 400, 1200]), bin_mw=500)
    assert sum(b["count"] for b in bins) == 5
    assert [b["center_mw"] for b in bins] == [-500, 0, 500, 1000]
    zero = next(b for b in bins if b["center_mw"] == 0)
    assert (zero["from_mw"], zero["to_mw"], zero["count"]) == (-250, 250, 2)
