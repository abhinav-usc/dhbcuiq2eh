// Mirrors backend/app/schemas.py. Keep the two in sync by hand for v1.
// Timestamps are ISO-8601 UTC strings; days are "YYYY-MM-DD" (UK local date)

export type GateId = 'epex_hourly' | 'n2ex' | 'half_hourly'

export interface Gate {
  id: GateId
  label: string
  market: string
  closes_at_local: string
}

export interface Meta {
  timezone: string
  first_decision_day: string
  last_decision_day: string
  first_delivery_day: string
  last_delivery_day: string
  gates: Gate[]
  default_gate: GateId
  error_convention: string
  data: {
    source: string
    fetched_at: string | null
    actual_half_hours: number
    forecast_rows: number
    forecast_runs: number
  }
}

export interface ErrorStats {
  n: number
  mae_mw: number | null
  bias_mw: number | null
  rmse_mw: number | null
  p50_abs_mw: number | null
  p90_abs_mw: number | null
  max_abs_mw: number | null
  mean_actual_mw: number | null
  /** Energy missing in over-forecast hours (MWh) */
  short_mwh: number | null
  /** Energy surplus in under-forecast hours (MWh) */
  long_mwh: number | null
}

export interface EnergyTotals {
  forecast_mwh: number
  adjusted_mwh: number
  actual_mwh: number | null
  error_mwh: number | null
  adjusted_error_mwh: number | null
  hours: number
  hours_with_actual: number
}

export interface Band {
  low_quantile: number
  high_quantile: number
  error_low_mw: number
  error_high_mw: number
  mean_error_mw: number
  history_days: number
  history_from: string
  history_to: string
}

/** Backtest of the likely range: share of hours the actual fell inside / below / above */
export interface Coverage {
  hours: number
  inside: number | null
  below: number | null
  above: number | null
}

export interface HourPoint {
  time: string
  published_at: string
  horizon_h: number
  forecast_mw: number
  /** Our bias-adjusted forecast (not Elexon's) */
  adjusted_mw: number
  actual_mw: number | null
  error_mw: number | null
  band_low_mw: number | null
  band_high_mw: number | null
}

export interface Decision {
  delivery_day: string
  gate: Gate
  cutoff: string
  runs_used: string[]
  totals: EnergyTotals
  stats: ErrorStats
  band: Band | null
  band_coverage: Coverage
  points: HourPoint[]
}

export interface HorizonBucket {
  horizon_from_h: number
  horizon_to_h: number
  n: number
  mae_mw: number
  bias_mw: number
}

export interface HistogramBin {
  center_mw: number
  from_mw: number
  to_mw: number
  count: number
}

export interface HourOfDay {
  hour: number
  n: number
  mae_mw: number
  bias_mw: number
}

export interface DailyRow {
  delivery_day: string
  forecast_mwh: number
  adjusted_mwh: number
  actual_mwh: number | null
  mae_mw: number | null
  bias_mw: number | null
}

export interface SeriesPoint {
  time: string
  forecast_mw: number
  adjusted_mw: number
  actual_mw: number | null
}

export interface Accuracy {
  gate: Gate
  first_delivery_day: string
  last_delivery_day: string
  stats: ErrorStats
  adjusted_stats: ErrorStats
  band_coverage: Coverage
  by_horizon: HorizonBucket[]
  histogram: HistogramBin[]
  by_hour: HourOfDay[]
  daily: DailyRow[]
  series: SeriesPoint[]
}
