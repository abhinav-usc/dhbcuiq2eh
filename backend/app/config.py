"""Static configuration for v1.

Everything that encodes a product decision (scope, gate times, band settings)
lives here so it can be reviewed and changed in one place.
"""

import os
from dataclasses import dataclass
from datetime import date, datetime, time, timedelta, timezone
from enum import Enum
from pathlib import Path
from zoneinfo import ZoneInfo

UK_TZ = ZoneInfo("Europe/London")

# --- Scope -------------------------------------------------------------------
# Purchase decisions made on each day of January 2026, each for delivery the
# following day. So the delivery days shown in the app are 2 Jan .. 1 Feb.
FIRST_DECISION_DAY = date(2026, 1, 1)
LAST_DECISION_DAY = date(2026, 1, 31)
FIRST_DELIVERY_DAY = FIRST_DECISION_DAY + timedelta(days=1)
LAST_DELIVERY_DAY = LAST_DECISION_DAY + timedelta(days=1)

# One extra delivery day before the visible range, used only as history for
# the uncertainty band (never shown as a delivery day itself).
WARMUP_DELIVERY_DAY = FIRST_DELIVERY_DAY - timedelta(days=1)

# --- Gates (day-ahead auctions) ----------------------------------------------


class GateId(str, Enum):
    EPEX_HOURLY = "epex_hourly"
    N2EX = "n2ex"
    HALF_HOURLY = "half_hourly"


@dataclass(frozen=True)
class Gate:
    id: GateId
    label: str
    market: str
    closes_at: time  # UK local time on the day before delivery


GATES: dict[GateId, Gate] = {
    GateId.EPEX_HOURLY: Gate(GateId.EPEX_HOURLY, "EPEX hourly", "EPEX SPOT GB 60-min auction", time(9, 20)),
    GateId.N2EX: Gate(GateId.N2EX, "N2EX", "Nord Pool N2EX day-ahead auction", time(9, 50)),
    GateId.HALF_HOURLY: Gate(GateId.HALF_HOURLY, "Half-hourly", "GB 30-min day-ahead auction", time(15, 30)),
}
DEFAULT_GATE = GateId.N2EX

# --- Analysis settings -------------------------------------------------------
MAX_HORIZON_HOURS = 48
HORIZON_BUCKET_HOURS = 3
HISTOGRAM_BIN_MW = 500

# Uncertainty band: error quantiles from the decision forecasts of recent,
# fully-settled delivery days (see dataset.error_band).
BAND_TRAILING_DAYS = 14
BAND_MIN_DAYS = 3
BAND_QUANTILES = (0.1, 0.9)

# --- Data source & storage ---------------------------------------------------
ELEXON_BASE_URL = "https://data.elexon.co.uk/bmrs/api/v1"
DATA_DIR = Path(os.environ.get("DATA_DIR", Path(__file__).resolve().parent.parent / "data"))

# Actuals: every settlement day we might evaluate (including the warm-up day).
ACTUALS_FROM = WARMUP_DELIVERY_DAY
ACTUALS_TO = LAST_DELIVERY_DAY

# Forecasts: everything published that could matter for a January decision,
# reaching back far enough to cover MAX_HORIZON_HOURS for the warm-up day.
FORECASTS_PUBLISHED_FROM = datetime.combine(WARMUP_DELIVERY_DAY, time(0), tzinfo=timezone.utc) - timedelta(
    hours=MAX_HORIZON_HOURS
)
FORECASTS_PUBLISHED_TO = datetime.combine(LAST_DECISION_DAY + timedelta(days=1), time(0), tzinfo=timezone.utc)
