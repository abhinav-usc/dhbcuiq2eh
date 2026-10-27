"""Thin client for the two Elexon BMRS datasets we use.

Both are public "stream" endpoints: no API key, no pagination, one JSON array
per request. We keep the raw records untouched; all cleaning happens in
dataset.py so it is visible and testable.
"""

from datetime import date, datetime

import httpx

from app.config import ELEXON_BASE_URL

TIMEOUT = httpx.Timeout(120.0, connect=10.0)


def _iso_utc(dt: datetime) -> str:
    return dt.strftime("%Y-%m-%dT%H:%M:%SZ")


def fetch_wind_actuals(client: httpx.Client, settlement_from: date, settlement_to: date) -> list[dict]:
    """FUELHH half-hourly outturn, filtered to fuelType WIND (dates inclusive)."""
    response = client.get(
        f"{ELEXON_BASE_URL}/datasets/FUELHH/stream",
        params={
            "settlementDateFrom": settlement_from.isoformat(),
            "settlementDateTo": settlement_to.isoformat(),
            "fuelType": "WIND",
        },
    )
    response.raise_for_status()
    return [row for row in response.json() if row.get("fuelType") == "WIND"]


def fetch_wind_forecasts(client: httpx.Client, published_from: datetime, published_to: datetime) -> list[dict]:
    """WINDFOR hourly forecasts for every run published in the window."""
    response = client.get(
        f"{ELEXON_BASE_URL}/datasets/WINDFOR/stream",
        params={
            "publishDateTimeFrom": _iso_utc(published_from),
            "publishDateTimeTo": _iso_utc(published_to),
        },
    )
    response.raise_for_status()
    return response.json()
