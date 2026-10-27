# Backend: Anemo API (FastAPI)

The backend loads one month of national wind data from Elexon. For each delivery day it works out which forecast a day-ahead buyer actually had when bids closed. It then measures how far that forecast was from what was generated. Everything runs in memory over about 21,000 rows, with no database.

> **Status: v1, 27 Oct 2026.** The core logic is complete and tested (26 tests). It includes a bias-adjusted forecast and a backtest of the likely range. The defaults below were confirmed on 27 Oct (scope, N2EX gate, strictly-before cutoff, Heroku). The remaining open items are in [Decisions to discuss](#decisions-to-discuss).

---

## Quick start

```bash
cd backend
python3.10 -m venv .venv                  # local Python is 3.10; Docker uses 3.12
.venv/bin/pip install -r requirements-dev.txt

# Optional: refresh the data snapshot from Elexon (about 3 s, no API key).
.venv/bin/python -m app.snapshot

.venv/bin/uvicorn app.main:app --reload   # http://localhost:8000
.venv/bin/python -m pytest -q             # 26 tests
```

Interactive API docs: <http://localhost:8000/docs>. FastAPI generates them from the response models.

---

## Code layout

```
backend/
├── app/
│   ├── config.py     every product decision: scope, gate times, band settings, paths
│   ├── elexon.py     thin HTTP client for the two BMRS stream endpoints
│   ├── snapshot.py   fetch → raw JSON on disk → load at startup (`python -m app.snapshot`)
│   ├── dataset.py    the domain logic: cleaning, the gate rule, uncertainty band, horizon join
│   ├── metrics.py    error statistics: MAE, bias, RMSE, P90, histogram, by-hour, daily
│   ├── schemas.py    Pydantic response models (the API contract)
│   ├── api.py        3 endpoints; thin, just validate, call dataset/metrics, shape response
│   └── main.py       app + lifespan (loads data once) + serves the built React app in Docker
├── data/             raw Elexon snapshot (JSON, about 2.6 MB), committed so the app runs offline
├── tests/
│   ├── test_dataset.py   synthetic data: each rule tested in isolation
│   ├── test_metrics.py   statistics on hand-computed numbers
│   └── test_api.py       end to end against the real January snapshot
├── requirements.txt       runtime dependencies (pinned)
└── requirements-dev.txt   + pytest
```

### Data flow

```
Elexon BMRS ──(elexon.py)──▶ data/*.json ──(snapshot.py)──▶ WindDataset (dataset.py, pandas)
                                                               │
                         decisions(gate) cached per gate ◀─────┤
                                                               ▼
                                     metrics.py ──▶ api.py ──▶ JSON ──▶ React frontend
```

The raw files are never modified. All cleaning happens in code (`dataset.py`), so a reviewer can see it and the tests can exercise it.

---

## The data and what we found in it

| Dataset | What it is | Resolution | Used fields |
|---|---|---|---|
| `FUELHH`, `fuelType=WIND` | Metered national wind output (actuals) | Half-hourly | `startTime`, `generation` (MW) |
| `WINDFOR` | Wind generation forecast | **Hourly** | `publishTime`, `startTime`, `generation` (MW) |

These properties of the data shape the design. They were found by probing the API, not taken from documentation:

1. **WINDFOR publishes 8 runs a day** at 02:30, 04:30, 07:30, 09:30, 11:30, 15:30, 18:30 and 22:30 UTC. That is 264 runs in our window.
2. **Each run covers a fixed window**, from 21:00 the day before publication to 21:00 two days after (73 hourly values). The forecast for a delivery day is therefore 14–38 hours ahead when bids close.
3. **Each run repeats hours that are already in the past**, frozen at the values of earlier runs. We checked: none of the 726 such hours ever changes. These rows are not forecasts, so `dataset.forecasts_frame` drops any row where `startTime < publishTime`.
4. **Forecasts are hourly and actuals half-hourly.** We compare at hourly resolution, using the mean of the `:00` and `:30` half-hours. An hour missing either half-hour is dropped rather than guessed.
5. **FUELHH for January is clean**: 1,536 half-hours, no gaps, no duplicates.
6. **The forecast is persistently too high**, by about +1.7 GW on average (about 15% of mean output). The bias is still +1.5 GW even 0–3 hours ahead. That pattern suggests a difference in what the two datasets measure rather than forecast skill. The likely cause is curtailment: wind farms paid to turn down appear in metered FUELHH, but probably not in WINDFOR. **This is not verified yet.** It is the most important finding for the client, because buying against the raw forecast leaves you short in 84% of hours.

### Snapshot

| File | Contents |
|---|---|
| `data/fuelhh_wind.json` | FUELHH WIND, settlement dates 1 Jan to 1 Feb 2026 |
| `data/windfor.json` | WINDFOR runs published 30 Dec 2025 00:00Z to 1 Feb 2026 00:00Z |
| `data/snapshot_meta.json` | When it was fetched, the query windows, row counts |

On startup the app loads these files. If they are missing, it fetches from Elexon (about 3 s) and writes them. January 2026 is history, so the data can't change.

---

## Definitions (the business logic)

All of this lives in `dataset.py` and `config.py`.

| Term | Definition in v1 |
|---|---|
| **Scope** | Purchase decisions made 1 to 31 Jan 2026, so **delivery days 2 Jan to 1 Feb**. 1 Jan is loaded as a *warm-up* day, used only as history for the uncertainty band and never shown. |
| **Delivery day** | The UK local calendar date of the target hour. In January UK time equals UTC, but the code converts properly so it stays correct across BST. |
| **Gate** | When day-ahead bids close, in UK local time on D−1: EPEX hourly 09:20, **N2EX 09:50 (default)**, half-hourly 15:30. |
| **Decision forecast** | For each target hour, the **latest forecast published strictly before** that day's gate. So EPEX uses the 07:30 run, N2EX the 09:30 run, and half-hourly the 11:30 run, because a run published at exactly 15:30 is excluded. |
| **Error** | `forecast − actual` in MW. **Positive = over-forecast**: less wind arrived than expected, so the buyer is short. |
| **Energy** | Sum of hourly MW = MWh. The day error only compares hours that have an actual. |
| **Likely range (band)** | The P10 and P90 of hourly decision-forecast errors over up to 14 recent delivery days, flipped around the forecast (`actual ≈ forecast − error`). It **only uses days ≤ D−2**: when bids close on D−1, day D−1 is still in progress, so using it would leak the future. It needs at least 3 such days, so 2–4 Jan have no band. The low side is floored at 0 GW. |
| **Bias-adjusted forecast** | `forecast − mean error` of the same D−2 history window as the band, floored at 0. Until there are 3 days of history it equals the raw forecast. **This is our model, not Elexon's**, and the UI labels it so. |
| **Range backtest (coverage)** | Over the scope, the share of hours the actual fell inside, below or above the band. A P10–P90 band should hold about 80%. |
| **Short / long** | Hourly errors summed as energy. *Short* = MWh missing in over-forecast hours; *long* = MWh surplus in under-forecast hours. |
| **Horizon analysis** | *Every* run, not just the decision one, paired with outturn, bucketed by hours ahead (0–48 h, 3 h buckets). It shows how accuracy changes with lead time. |

---

## API

All responses are JSON. MW and MWh values are rounded to 1 decimal place, timestamps are ISO-8601 UTC, and days are `YYYY-MM-DD`. `null` means no data.

### `GET /api/health`
`{"status": "ok"}`

### `GET /api/meta`
Scope dates, the gate list (id, label, market, local close time), the default gate, the error convention, and snapshot info (fetched_at, row counts, number of runs). The frontend calls this once at boot.

### `GET /api/decision?delivery_day=2026-01-15&gate=n2ex`
Everything for one delivery day at one gate:

```jsonc
{
  "delivery_day": "2026-01-15",
  "gate": { "id": "n2ex", "label": "N2EX", "closes_at_local": "09:50", ... },
  "cutoff": "2026-01-14T09:50:00Z",
  "runs_used": ["2026-01-14T09:30:00Z"],
  "totals": { "forecast_mwh": 280272.0, "actual_mwh": 253626.0, "error_mwh": 26646.0, "hours": 24, "hours_with_actual": 24 },
  "stats":  { "n": 24, "mae_mw": ..., "bias_mw": ..., "rmse_mw": ..., "p90_abs_mw": ..., ... },
  "band":   { "error_low_mw": -555.1, "error_high_mw": 4803.3, "history_days": 13, "history_from": "2026-01-01", "history_to": "2026-01-13", ... },
  "points": [ { "time": "2026-01-15T00:00:00Z", "published_at": "...", "horizon_h": 14.5,
                "forecast_mw": 15828.0, "actual_mw": 14456.5, "error_mw": 1371.5,
                "band_low_mw": 11024.7, "band_high_mw": 16383.1 }, ... 24 hours ]
}
```

Each point also carries `adjusted_mw`. `band.mean_error_mw` is the recent bias used for the adjustment. `band_coverage` is the range backtest for this gate over the whole scope.

Errors: **404** if the day is outside 2 Jan to 1 Feb (with a readable message), **422** for an unknown gate.

### `GET /api/accuracy?gate=n2ex[&start=2026-01-02&end=2026-02-01]`
The gate's decision forecasts across a range of delivery days. It returns:

- `stats`: n, MAE, bias, RMSE, P50/P90 absolute error, max, mean actual, short and long MWh.
- `adjusted_stats`: the same measures for the bias-adjusted forecast.
- `band_coverage`: share of hours inside, below and above the likely range.
- `by_horizon`: MAE and bias per 3 h horizon bucket, over all runs.
- `histogram`: 0.5 GW bins **centred** on multiples of 0.5 GW, so the zero bin means "about right".
- `by_hour`: error by UK hour of day.
- `daily`: per-day energy, MAE and bias.
- `series`: every hour's forecast vs actual, 744 points.

It takes about 40 ms.

### Reference numbers (January 2026, delivery days 2 Jan to 1 Feb, 744 hours)

| Gate | Run used | MAE | Bias | RMSE | P90 abs error | Worst hour |
|---|---|---|---|---|---|---|
| EPEX hourly 09:20 | 07:30 | 2,039 MW | +1,748 MW | 2,505 MW | 4,098 MW | 6,870 MW |
| **N2EX 09:50** | 09:30 | **2,013 MW** | **+1,730 MW** | 2,506 MW | 4,144 MW | 6,833 MW |
| Half-hourly 15:30 | 11:30 | 1,904 MW | +1,693 MW | 2,361 MW | 3,847 MW | 6,861 MW |

**Bias-adjusted, N2EX:** MAE 1,624 MW (−19%), bias +136 MW, short 655 GWh (vs 1,392 GWh raw), long 554 GWh (vs 105 GWh). EPEX and half-hourly behave the same way: MAE −21% and −20%.
**Likely-range backtest:** actuals inside 75% (N2EX), 77% (EPEX) and 76% (half-hourly) of 672 hours, against an 80% target. Misses split about evenly above and below.

The N2EX figures, raw and adjusted, match separate throwaway scripts written before the features were built. `test_api.py::test_accuracy_matches_independent_exploration` locks them in.

---

## Tests

```bash
.venv/bin/python -m pytest -q
```

| File | What it proves |
|---|---|
| `test_dataset.py` | The adjustment subtracts the mean error of settled days only (the planted D−1 error must not leak in) and falls back to raw without history. Stale rows are dropped. Half-hours average to hours, and incomplete hours are dropped. Each gate picks the latest run *strictly* before it (parametrised over all three gates). The error sign is right. **The band never uses D−1** (a planted 10 GW error on D−1 must not appear). The band needs at least 3 days. |
| `test_metrics.py` | Short/long energy. Stats on the adjusted column. Band coverage. MAE, bias and RMSE on hand-computed numbers. Empty input. Energy totals. Horizon bucketing. Histogram centring. |
| `test_api.py` | Real snapshot end to end: meta, a decision day (cutoff, run used, band history), 404 and 422 errors, the band clamped at 0, and the regression numbers above (raw, adjusted and coverage). Skipped automatically if there is no snapshot. |

The test run prints a harmless Starlette deprecation warning about `httpx` vs `httpx2` in `TestClient`. It can be fixed with a dependency bump.

---

## Configuration

Everything is in `app/config.py` as plain constants, so the decisions are easy to review.

| Constant | v1 value | Meaning |
|---|---|---|
| `FIRST_DECISION_DAY` / `LAST_DECISION_DAY` | 1 Jan / 31 Jan 2026 | Scope. Delivery days are the next day. |
| `GATES`, `DEFAULT_GATE` | 09:20 / **09:50** / 15:30 | Auction close times, UK local, on D−1 |
| `BAND_TRAILING_DAYS`, `BAND_MIN_DAYS`, `BAND_QUANTILES` | 14, 3, (0.1, 0.9) | Uncertainty band |
| `MAX_HORIZON_HOURS`, `HORIZON_BUCKET_HOURS` | 48, 3 | Horizon chart |
| `HISTOGRAM_BIN_MW` | 500 | Histogram bin width |
| `DATA_DIR` (env var) | `backend/data` | Where the snapshot lives |

---

## Decisions to discuss

These are the choices v1 made so it could ship. Each one is a sensible default that is easy to change.

| # | Decision | v1 does | Alternatives | Notes |
|---|---|---|---|---|
| 1 | **Framework** | FastAPI | Flask, Django | Typed models give us an API contract and `/docs` for free. Django's ORM and admin aren't needed. |
| 2 | **Reading of "decisions in January"** | Delivery 2 Jan to 1 Feb, plus a 1 Jan warm-up for the band | Delivery 1–31 Jan | The brief says *decisions*, so delivery is shifted by one day. Confirm with the PM. |
| 3 | **Gate times** | 09:20 / 09:50 / 15:30, N2EX default | Ask the client which auction they trade | These come from exchange docs (EPEX, Nord Pool). Nord Pool labels the 15:30 gate CET while EPEX says GMT, which needs checking. |
| 4 | **Cutoff rule** | Strictly before the gate | `≤ gate`, or a safety margin (e.g. 10 min before) | It only matters for half-hourly: the 15:30 run is published *at* the gate. |
| 5 | **Comparison resolution** | Hourly (average of the two half-hours) | Step the forecast to half-hours | Hourly compares like with like. The half-hourly auction might prefer half-hours. |
| 6 | **Uncertainty band** | Pooled P10–P90, trailing 14 days, ≤ D−2, clamped at 0 | Condition on wind level or hour of day; quantile regression; check calibration | It is *not* calibrated yet: we should measure how often actuals fall outside the band (target 20%). |
| 7 | **Bias** | **Optional bias-adjusted line** (off by default) + a raw vs adjusted comparison. Trailing 14-day mean error, ≤ D−2. | Exponential weighting; condition on wind level or hour; don't ship it | It cuts MAE by about 19% and roughly halves the energy short, but increases energy long (105 → 554 GWh). Short and long become balanced rather than one-sided. It is our model, so the label and the caveat matter. |
| 8 | **Storage** | Raw JSON snapshot committed and baked into the image | Fetch at startup; SQLite; Parquet | The data is immutable history, so a snapshot is simplest and works offline. Revisit if the scope becomes "live". |
| 9 | **pandas** | Used for the domain logic | Pure Python | It makes the logic readable for data people. The image grew from 281 MB to 457 MB with pandas and numpy. |
| 10 | **Python version** | Local 3.10, Docker 3.12 | Upgrade local to 3.12 | **3.10 reaches end of life this month (Oct 2026).** Pins were chosen to work on both (pandas 2.3.3, numpy 2.2.6). |
| 11 | **Hosting** | **Decided: Heroku container stack.** `heroku.yml` builds the root `Dockerfile` on Heroku; the image honours `$PORT` | Vercel | Heroku runs the same image we test locally. Paid dyno (Eco or Basic). |
| 12 | **Response contract** | Pydantic models, types mirrored by hand in `frontend/src/api/types.ts` | Generate TS types from `/openapi.json` | Codegen removes drift. |

## Known gaps and next steps

- Verify the curtailment explanation for the bias, if it can be done within the "Elexon data only" constraint.
- A conditional band (by wind level or hour of day) to get coverage from 75% up to the 80% target.
- The horizon chart pools *all* runs targeting the selected days, not just the gate's run, so it doesn't change when you switch gates. The UI subtitle says so, but it may surprise a first-time viewer.
- No caching headers. Responses are deterministic, so `Cache-Control` and an ETag would be trivial to add.
- No auth, rate limiting or structured logging. Fine for a demo, not for production.
