"""
ForgeSite — FastAPI backend.

Real dataset analytics for the ForgeSite frontend. Never exposes filesystem
paths, never fabricates data, never leaks stack traces.
Run:  uvicorn main:app --reload   (from backend/)
"""

from __future__ import annotations

import time
from typing import Any, Dict, List, Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

import analytics as AN
import data_engine as DE
import forge_ai as FA
import simulation as SIM

app = FastAPI(title="ForgeSite API", version="1.0.0")
app.add_middleware(
    CORSMiddleware, allow_origins=["*"], allow_credentials=False,
    allow_methods=["*"], allow_headers=["*"],
)


class BottleneckReq(BaseModel):
    weights: Dict[str, float] = Field(default_factory=dict)


class SimReq(BaseModel):
    station: str = "PRESS3"
    cycle_adj_pct: float = Field(default=0.0, ge=-50, le=50)
    capacity_add_pct: float = Field(default=0.0, ge=0, le=100)
    queue_reduction_pct: float = Field(default=0.0, ge=0, le=90)
    demand_adj_pct: float = Field(default=0.0, ge=-50, le=50)


class ImpactReq(BaseModel):
    cycle_adj_pct: float = Field(default=-10.0, ge=-50, le=50)
    station: str = "PRESS3"
    cost_per_unit: Optional[float] = Field(default=None, gt=0)
    downtime_cost_hour: Optional[float] = Field(default=None, gt=0)


class PredictReq(BaseModel):
    sku1: float = Field(default=14000, ge=0)
    sku2: float = Field(default=14000, ge=0)
    sku3: float = Field(default=14000, ge=0)
    sku4: float = Field(default=14000, ge=0)


class AskReq(BaseModel):
    question: str = Field(min_length=2, max_length=500)


class VisionReq(BaseModel):
    image_base64: str = Field(min_length=16, max_length=12_000_000)


@app.get("/api/health")
def health():
    ds = {f"model{i}": not DE.get_model(i).empty for i in (1, 2, 3)}
    return {"status": "ok", "version": "1.0.0", "system": "ONLINE",
            "datasets": ds, "time": time.time()}


@app.get("/api/profile/{model_id}")
def profile(model_id: int):
    if model_id not in (1, 2, 3):
        raise HTTPException(404, "Unknown model")
    p = DE.profile(model_id)
    if not p.get("available"):
        raise HTTPException(503, "Dataset unavailable")
    # hide absolute paths — only expose structure
    return {k: v for k, v in p.items() if k != "path"}


@app.get("/api/mat/inventory")
def mat_inventory():
    return DE.mat_inventory()


@app.get("/api/kpis")
def kpis():
    k = AN.kpis()
    if not k.get("available"):
        raise HTTPException(503, "Dataset unavailable")
    return k


@app.get("/api/health/factory")
def factory_health():
    h = AN.factory_health()
    if not h.get("available"):
        raise HTTPException(503, "Dataset unavailable")
    return h


@app.get("/api/stations")
def stations():
    df = DE.model3()
    if df.empty:
        raise HTTPException(503, "Dataset unavailable")
    return {"stations": AN.station_metrics(df)}


@app.get("/api/station/{station_id}")
def station_detail(station_id: str):
    df = DE.model3()
    if df.empty:
        raise HTTPException(503, "Dataset unavailable")
    st = next((s for s in DE.STATIONS if s["id"] == station_id.upper()), None)
    if st is None:
        raise HTTPException(404, "Unknown station")
    m = next((x for x in AN.station_metrics(df) if x["id"] == st["id"]), None)
    # SKU counters per cell (exact columns: c_Cell1_SKU1, c_CellN__SKU2-4)
    sku_counters = {}
    if st["id"].startswith("CELL"):
        i = int(st["id"][-1])
        for sku in range(1, 5):
            col = f"c_Cell{i}_SKU{sku}" if i == 1 else f"c_Cell{i}__SKU{sku}"
            if col in df.columns:
                sku_counters[f"SKU{sku}"] = {"column": col, "mean": AN._num(float(df[col].mean()), 0)}
    # series for the station's util + main queue
    series = {}
    series["utilization"] = DE.series_summary(df, st["util"], 220)
    for q in DE.station_queues(st)[:1]:
        series["queue"] = DE.series_summary(df, q, 220)
    return {"station": m, "sku_counters": sku_counters, "series": series,
            "label": "DERIVED from Model 3"}


@app.post("/api/bottlenecks")
def bottlenecks(req: BottleneckReq):
    b = AN.bottleneck_ranking(req.weights)
    if not b.get("available"):
        raise HTTPException(503, "Dataset unavailable")
    return b


@app.get("/api/anomalies")
def anomalies(metric: Optional[str] = None, method: str = "auto"):
    a = AN.detect_anomalies(metric=metric, method=method)
    if not a.get("available"):
        raise HTTPException(503, "Dataset unavailable")
    return a


@app.get("/api/correlation/matrix")
def correlation_matrix(model_id: int = 3, max_vars: int = 10):
    m = AN.correlation_matrix(model_id, max_vars)
    if not m.get("available"):
        raise HTTPException(503, m.get("reason", "Insufficient data for this analysis."))
    return m


@app.get("/api/correlation/detail")
def correlation_detail(model_id: int = 3, a: str = "", b: str = "",
                       method: str = "pearson", lag: int = 0):
    d = AN.correlation_detail(model_id, a, b, method, lag)
    if not d.get("available"):
        raise HTTPException(503, d.get("reason", "Insufficient data for this analysis."))
    return d


@app.get("/api/correlation/top")
def top_relationships(model_id: int = 3, limit: int = 12):
    return AN.top_relationships(model_id, limit)


@app.get("/api/series")
def series(model_id: int = 3, col: str = "", max_points: int = 300):
    df = DE.get_model(model_id)
    if df.empty:
        raise HTTPException(503, "Dataset unavailable")
    s = DE.series_summary(df, col, max_points)
    if not s.get("available"):
        raise HTTPException(404, s.get("reason", "Required field unavailable."))
    return s


@app.get("/api/histogram")
def histogram(model_id: int = 3, col: str = "", bins: int = 24):
    df = DE.get_model(model_id)
    if df.empty:
        raise HTTPException(503, "Dataset unavailable")
    if col not in df.columns:
        raise HTTPException(404, f"Required field unavailable in current dataset: {col}")
    return {"column": col, "bins": DE.histogram(df, col, bins),
            "stats": DE.profile(model_id)["stats"].get(col)}


@app.post("/api/simulate")
def simulate(req: SimReq):
    s = SIM.what_if(req.station, req.cycle_adj_pct, req.capacity_add_pct,
                    req.queue_reduction_pct, req.demand_adj_pct)
    if not s.get("available"):
        raise HTTPException(503, s.get("reason", "Dataset unavailable"))
    return s


@app.post("/api/impact")
def impact(req: ImpactReq):
    r = SIM.operational_impact(req.cycle_adj_pct, req.station,
                               req.cost_per_unit, req.downtime_cost_hour)
    if not r.get("available"):
        raise HTTPException(503, "Dataset unavailable")
    return r


@app.get("/api/model/status")
def model_status():
    return SIM.predictive_status()


@app.post("/api/predict")
def predict(req: PredictReq):
    r = SIM.predict_sku_production({"SKU1": req.sku1, "SKU2": req.sku2,
                                    "SKU3": req.sku3, "SKU4": req.sku4})
    if not r.get("available"):
        raise HTTPException(503, r.get("reason", "Predictive model unavailable."))
    return r


@app.get("/api/investigation")
def investigation():
    inv = FA.build_investigation()
    if not inv.get("available"):
        raise HTTPException(503, "Dataset unavailable")
    return inv


@app.post("/api/ask")
def ask(req: AskReq):
    return FA.answer(req.question)


@app.get("/api/report")
def report():
    return FA.build_report()


@app.post("/api/vision")
def vision(req: VisionReq):
    """Honest vision extension slot.

    The supplied dataset contains NO product images, so ForgeSite ships no
    vision model and never fabricates a verdict. If FORGE_VISION_URL is set,
    the uploaded image is forwarded to that external model and its response is
    relayed. Otherwise we say clearly that the module is not connected.
    """
    import os
    import urllib.request
    import json as _json

    url = os.environ.get("FORGE_VISION_URL", "").strip()
    if not url:
        return {
            "connected": False,
            "message": (
                "The supplied dataset is discrete-event simulation telemetry and contains no "
                "product photographs or defect labels — there is nothing to train or evaluate a "
                "vision model on. ForgeSite therefore does not produce defect verdicts. Connect "
                "an external computer-vision endpoint to enable this module."
            ),
        }
    try:
        payload = _json.dumps({"image_base64": req.image_base64}).encode()
        r = urllib.request.Request(url, data=payload, headers={"Content-Type": "application/json"})
        with urllib.request.urlopen(r, timeout=20) as resp:
            body = _json.loads(resp.read().decode())
        verdict = body.get("verdict", body)
        return {"connected": True, "verdict": verdict,
                "label": "EXTERNAL VISION MODEL"}
    except Exception:
        return {
            "connected": False,
            "message": "The configured vision endpoint could not be reached or returned an invalid response.",
        }


@app.exception_handler(Exception)
async def unhandled(_req, exc):
    return HTTPException(500, "Internal error — see server logs")
