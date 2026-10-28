import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from app import config, snapshot
from app.api import router
from app.dataset import WindDataset

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s %(message)s")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # The whole dataset (~21k rows) is loaded once and kept in memory
    snap = snapshot.load_or_fetch(config.DATA_DIR)
    app.state.dataset = WindDataset(snap.actuals, snap.forecasts, fetched_at=snap.fetched_at)
    yield


app = FastAPI(title="Wind Forecast API", lifespan=lifespan)


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


app.include_router(router)

# In the Docker image the built React app is copied to ./static; it is
# absent in local dev, where the Vite dev server serves the frontend instead
static_dir = Path(__file__).resolve().parent.parent / "static"
if static_dir.is_dir():
    app.mount("/", StaticFiles(directory=static_dir, html=True), name="static")
