"""Response models. These are the API contract the frontend's api/types.ts mirrors."""

from datetime import date, datetime

from pydantic import BaseModel

from app.config import GateId

# MW / MWh values are rounded to 1 decimal place. None means "no data".


class GateOut(BaseModel):
    id: GateId
    label: str
    market: str
    closes_at_local: str  # "HH:MM" UK local time on the day before delivery


class DataInfo(BaseModel):
    source: str
    fetched_at: datetime | None
    actual_half_hours: int
    forecast_rows: int
    forecast_runs: int


class MetaOut(BaseModel):
    timezone: str
    first_decision_day: date
    last_decision_day: date
    first_delivery_day: date
    last_delivery_day: date
    gates: list[GateOut]
    default_gate: GateId
    error_convention: str
    data: DataInfo


class ErrorStats(BaseModel):
    n: int
    mae_mw: float | None = None
    bias_mw: float | None = None
    rmse_mw: float | None = None
    p50_abs_mw: float | None = None
    p90_abs_mw: float | None = None
    max_abs_mw: float | None = None
    mean_actual_mw: float | None = None
    short_mwh: float | None = None  # sum of over-forecast hours: energy missing
    long_mwh: float | None = None  # sum of under-forecast hours: energy surplus


class EnergyTotals(BaseModel):
    forecast_mwh: float
    adjusted_mwh: float
    actual_mwh: float | None
    error_mwh: float | None
    adjusted_error_mwh: float | None
    hours: int
    hours_with_actual: int


class Band(BaseModel):
    """History behind the likely range and the bias adjustment for one day."""

    low_quantile: float
    high_quantile: float
    error_low_mw: float
    error_high_mw: float
    mean_error_mw: float
    history_days: int
    history_from: date
    history_to: date


class Coverage(BaseModel):
    """Backtest: share of hours the actual fell inside / below / above the range."""

    hours: int
    inside: float | None = None
    below: float | None = None
    above: float | None = None


class HourPoint(BaseModel):
    time: datetime
    published_at: datetime
    horizon_h: float
    forecast_mw: float
    adjusted_mw: float
    actual_mw: float | None
    error_mw: float | None
    # Plausible range for the actual, given the forecast and recent errors.
    band_low_mw: float | None
    band_high_mw: float | None


class DecisionOut(BaseModel):
    delivery_day: date
    gate: GateOut
    cutoff: datetime
    runs_used: list[datetime]
    totals: EnergyTotals
    stats: ErrorStats
    band: Band | None
    # How the range method performed over the whole scope, for this gate.
    band_coverage: Coverage
    points: list[HourPoint]


class HorizonBucket(BaseModel):
    horizon_from_h: int
    horizon_to_h: int
    n: int
    mae_mw: float
    bias_mw: float


class HistogramBin(BaseModel):
    center_mw: float
    from_mw: float
    to_mw: float
    count: int


class HourOfDay(BaseModel):
    hour: int
    n: int
    mae_mw: float
    bias_mw: float


class DailyRow(BaseModel):
    delivery_day: date
    forecast_mwh: float
    adjusted_mwh: float
    actual_mwh: float | None
    mae_mw: float | None
    bias_mw: float | None


class SeriesPoint(BaseModel):
    time: datetime
    forecast_mw: float
    adjusted_mw: float
    actual_mw: float | None


class AccuracyOut(BaseModel):
    gate: GateOut
    first_delivery_day: date
    last_delivery_day: date
    stats: ErrorStats
    adjusted_stats: ErrorStats
    band_coverage: Coverage
    by_horizon: list[HorizonBucket]
    histogram: list[HistogramBin]
    by_hour: list[HourOfDay]
    daily: list[DailyRow]
    series: list[SeriesPoint]
