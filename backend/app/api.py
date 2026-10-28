# HTTP endpoints. Thin: validate input, call dataset/metrics, shape the response

import math
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, Request

from app import config, metrics, schemas
from app.config import GATES, Gate, GateId
from app.dataset import WindDataset, gate_cutoff

router = APIRouter(prefix="/api")


def get_dataset(request: Request) -> WindDataset:
    return request.app.state.dataset


def _round(value: float | None, digits: int = 1) -> float | None:
    if value is None or (isinstance(value, float) and math.isnan(value)):
        return None
    return round(float(value), digits)


def _rounded(values: dict) -> dict:
    return {key: _round(value) if isinstance(value, float) else value for key, value in values.items()}


def _gate_out(gate: Gate) -> schemas.GateOut:
    return schemas.GateOut(
        id=gate.id, label=gate.label, market=gate.market, closes_at_local=gate.closes_at.strftime("%H:%M")
    )


def _check_delivery_range(first_day: date, last_day: date) -> None:
    if first_day > last_day:
        raise HTTPException(422, "start must not be after end")
    if first_day < config.FIRST_DELIVERY_DAY or last_day > config.LAST_DELIVERY_DAY:
        raise HTTPException(
            404,
            f"Delivery days in scope are {config.FIRST_DELIVERY_DAY} to {config.LAST_DELIVERY_DAY}",
        )


@router.get("/meta", response_model=schemas.MetaOut)
def meta(dataset: WindDataset = Depends(get_dataset)) -> schemas.MetaOut:
    return schemas.MetaOut(
        timezone="Europe/London",
        first_decision_day=config.FIRST_DECISION_DAY,
        last_decision_day=config.LAST_DECISION_DAY,
        first_delivery_day=config.FIRST_DELIVERY_DAY,
        last_delivery_day=config.LAST_DELIVERY_DAY,
        gates=[_gate_out(gate) for gate in GATES.values()],
        default_gate=config.DEFAULT_GATE,
        error_convention="error = forecast - actual (MW); positive = over-forecast",
        data=schemas.DataInfo(
            source="Elexon BMRS: FUELHH (fuelType WIND) and WINDFOR",
            fetched_at=dataset.fetched_at,
            actual_half_hours=len(dataset.actuals_half_hourly),
            forecast_rows=len(dataset.forecasts),
            forecast_runs=dataset.forecast_run_count,
        ),
    )


@router.get("/decision", response_model=schemas.DecisionOut)
def decision(
    delivery_day: date = Query(..., description="Delivery day (UK local date)"),
    gate: GateId = Query(config.DEFAULT_GATE),
    dataset: WindDataset = Depends(get_dataset),
) -> schemas.DecisionOut:
    # What the buyer knew at the gate for one delivery day, and how it turned out
    _check_delivery_range(delivery_day, delivery_day)
    gate_def = GATES[gate]
    table = dataset.decisions_for_day(gate_def, delivery_day)
    if table.empty:
        raise HTTPException(404, f"No forecast was published before the {gate_def.label} gate for {delivery_day}")

    band = dataset.error_band(gate_def, delivery_day)
    points = []
    for row in table.itertuples(index=False):
        points.append(
            schemas.HourPoint(
                time=row.start_time,
                published_at=row.publish_time,
                horizon_h=row.horizon_h,
                forecast_mw=_round(row.forecast_mw),
                adjusted_mw=_round(row.adjusted_mw),
                actual_mw=_round(row.actual_mw),
                error_mw=_round(row.error_mw),
                band_low_mw=_round(row.band_low_mw),
                band_high_mw=_round(row.band_high_mw),
            )
        )

    return schemas.DecisionOut(
        delivery_day=delivery_day,
        gate=_gate_out(gate_def),
        cutoff=gate_cutoff(delivery_day, gate_def),
        runs_used=sorted(table["publish_time"].unique()),
        totals=schemas.EnergyTotals(**_rounded(metrics.energy_totals(table))),
        stats=schemas.ErrorStats(**_rounded(metrics.error_stats(table))),
        band=schemas.Band(**_rounded(band)) if band else None,
        band_coverage=_coverage(dataset, gate_def, config.FIRST_DELIVERY_DAY, config.LAST_DELIVERY_DAY),
        points=points,
    )


def _coverage(dataset: WindDataset, gate: Gate, first_day: date, last_day: date) -> schemas.Coverage:
    coverage = metrics.band_coverage(dataset.decisions_in_range(gate, first_day, last_day))
    # Shares, not MW: keep 3 decimals rather than _rounded's 1
    return schemas.Coverage(**{k: round(v, 3) if isinstance(v, float) else v for k, v in coverage.items()})


@router.get("/accuracy", response_model=schemas.AccuracyOut)
def accuracy(
    gate: GateId = Query(config.DEFAULT_GATE),
    start: date = Query(config.FIRST_DELIVERY_DAY, description="First delivery day"),
    end: date = Query(config.LAST_DELIVERY_DAY, description="Last delivery day"),
    dataset: WindDataset = Depends(get_dataset),
) -> schemas.AccuracyOut:
    # How accurate the gate-time forecast was across a range of delivery days
    _check_delivery_range(start, end)
    gate_def = GATES[gate]
    table = dataset.decisions_in_range(gate_def, start, end)
    horizon_table = dataset.horizon_errors(start, end)

    return schemas.AccuracyOut(
        gate=_gate_out(gate_def),
        first_delivery_day=start,
        last_delivery_day=end,
        stats=schemas.ErrorStats(**_rounded(metrics.error_stats(table))),
        adjusted_stats=schemas.ErrorStats(**_rounded(metrics.error_stats(table, "adjusted_error_mw"))),
        band_coverage=_coverage(dataset, gate_def, start, end),
        by_horizon=[_rounded(row) for row in metrics.by_horizon(horizon_table, config.HORIZON_BUCKET_HOURS)],
        histogram=metrics.histogram(table, config.HISTOGRAM_BIN_MW),
        by_hour=[_rounded(row) for row in metrics.by_hour_of_day(table)],
        daily=[_rounded(row) for row in metrics.daily(table)],
        series=[
            schemas.SeriesPoint(
                time=row.start_time,
                forecast_mw=_round(row.forecast_mw),
                adjusted_mw=_round(row.adjusted_mw),
                actual_mw=_round(row.actual_mw),
            )
            for row in table.itertuples(index=False)
        ],
    )
