# End-to-end checks against the real January 2026 snapshot in backend/data

import pytest
from fastapi.testclient import TestClient

from app import config, snapshot
from app.main import app

pytestmark = pytest.mark.skipif(
    snapshot.load(config.DATA_DIR) is None, reason="no data snapshot; run `python -m app.snapshot`"
)


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as test_client:
        yield test_client


def test_meta(client):
    body = client.get("/api/meta").json()
    assert body["first_delivery_day"] == "2026-01-02"
    assert body["last_delivery_day"] == "2026-02-01"
    assert {g["id"] for g in body["gates"]} == {"epex_hourly", "n2ex", "half_hourly"}


def test_decision_day(client):
    body = client.get("/api/decision", params={"delivery_day": "2026-01-15", "gate": "n2ex"}).json()
    assert len(body["points"]) == 24
    assert body["cutoff"] == "2026-01-14T09:50:00Z"
    assert body["runs_used"] == ["2026-01-14T09:30:00Z"]
    assert body["band"]["history_to"] == "2026-01-13"


def test_likely_range_never_below_zero(client):
    # 8 Jan: low wind and a wide error band, so forecast - P90 error goes negative
    points = client.get("/api/decision", params={"delivery_day": "2026-01-08"}).json()["points"]
    assert min(p["band_low_mw"] for p in points) == 0


def test_decision_out_of_scope(client):
    assert client.get("/api/decision", params={"delivery_day": "2026-01-01"}).status_code == 404
    assert client.get("/api/decision", params={"delivery_day": "2026-01-15", "gate": "x"}).status_code == 422


def test_accuracy_matches_independent_exploration(client):
    # Figures first computed in a separate throwaway script during discovery
    stats = client.get("/api/accuracy", params={"gate": "n2ex"}).json()["stats"]
    assert stats["n"] == 744
    assert stats["mae_mw"] == pytest.approx(2013, abs=1)
    assert stats["bias_mw"] == pytest.approx(1730, abs=1)


def test_bias_adjustment_and_range_backtest(client):
    # Also first computed in a separate script before being built in
    body = client.get("/api/accuracy", params={"gate": "n2ex"}).json()
    adjusted = body["adjusted_stats"]
    assert adjusted["mae_mw"] == pytest.approx(1624, abs=1)
    assert adjusted["bias_mw"] == pytest.approx(136, abs=1)
    assert adjusted["short_mwh"] == pytest.approx(654_800, abs=100)
    assert body["band_coverage"]["inside"] == pytest.approx(0.75, abs=0.005)
