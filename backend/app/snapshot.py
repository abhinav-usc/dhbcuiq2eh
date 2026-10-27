"""On-disk snapshot of the raw Elexon data.

January 2026 is history, so the data never changes: we fetch it once, store
the raw JSON under DATA_DIR and load it at startup. Refresh manually with:

    python -m app.snapshot
"""

import json
import logging
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path

import httpx

from app import config, elexon

log = logging.getLogger(__name__)

ACTUALS_FILE = "fuelhh_wind.json"
FORECASTS_FILE = "windfor.json"
META_FILE = "snapshot_meta.json"


@dataclass
class Snapshot:
    fetched_at: datetime
    actuals: list[dict]
    forecasts: list[dict]


def fetch() -> Snapshot:
    with httpx.Client(timeout=elexon.TIMEOUT) as client:
        log.info("Fetching FUELHH wind actuals %s..%s", config.ACTUALS_FROM, config.ACTUALS_TO)
        actuals = elexon.fetch_wind_actuals(client, config.ACTUALS_FROM, config.ACTUALS_TO)
        log.info(
            "Fetching WINDFOR forecasts published %s..%s",
            config.FORECASTS_PUBLISHED_FROM,
            config.FORECASTS_PUBLISHED_TO,
        )
        forecasts = elexon.fetch_wind_forecasts(
            client, config.FORECASTS_PUBLISHED_FROM, config.FORECASTS_PUBLISHED_TO
        )
    return Snapshot(fetched_at=datetime.now(timezone.utc), actuals=actuals, forecasts=forecasts)


def save(snapshot: Snapshot, data_dir: Path) -> None:
    data_dir.mkdir(parents=True, exist_ok=True)
    (data_dir / ACTUALS_FILE).write_text(json.dumps(snapshot.actuals))
    (data_dir / FORECASTS_FILE).write_text(json.dumps(snapshot.forecasts))
    meta = {
        "fetched_at": snapshot.fetched_at.isoformat(),
        "actuals": {
            "dataset": "FUELHH",
            "settlement_from": config.ACTUALS_FROM.isoformat(),
            "settlement_to": config.ACTUALS_TO.isoformat(),
            "rows": len(snapshot.actuals),
        },
        "forecasts": {
            "dataset": "WINDFOR",
            "published_from": config.FORECASTS_PUBLISHED_FROM.isoformat(),
            "published_to": config.FORECASTS_PUBLISHED_TO.isoformat(),
            "rows": len(snapshot.forecasts),
        },
    }
    (data_dir / META_FILE).write_text(json.dumps(meta, indent=2))


def load(data_dir: Path) -> Snapshot | None:
    paths = [data_dir / name for name in (ACTUALS_FILE, FORECASTS_FILE, META_FILE)]
    if not all(path.exists() for path in paths):
        return None
    actuals, forecasts, meta = (json.loads(path.read_text()) for path in paths)
    return Snapshot(
        fetched_at=datetime.fromisoformat(meta["fetched_at"]),
        actuals=actuals,
        forecasts=forecasts,
    )


def load_or_fetch(data_dir: Path) -> Snapshot:
    snapshot = load(data_dir)
    if snapshot is None:
        log.warning("No snapshot in %s; fetching from Elexon (takes ~20s)", data_dir)
        snapshot = fetch()
        save(snapshot, data_dir)
    return snapshot


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    fresh = fetch()
    save(fresh, config.DATA_DIR)
    log.info("Saved %d actuals and %d forecasts to %s", len(fresh.actuals), len(fresh.forecasts), config.DATA_DIR)
