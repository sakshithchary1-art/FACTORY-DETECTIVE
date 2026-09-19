"""
Factory Detective — FastAPI backend.

Software-only decision-support prototype. No machine control, no PLC writes.
All AI features work with or without an LLM API key.

Run:  uvicorn main:app --reload   (from the backend/ directory)
"""

from __future__ import annotations

import html
import time
from pathlib import Path
from typing import Any, Dict, List, Optional

import numpy as np
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from pydantic import BaseModel, Field

import ai_layer
import analytics as A
import investigation as INV

APP_VERSION = "1.0.0"

app = FastAPI(title="Factory Detective API", version=APP_VERSION)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # prototype: dev server on any local port
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


# --------------------------------------------------------------------------- #
# Models (request bodies)
# --------------------------------------------------------------------------- #

class SimRequest(BaseModel):
    station: str = "PRESS3"
    cycle_adj_pct: float = Field(default=0.0, ge=-50, le=50)
    extra_capacity: bool = False
    queue_reduction_pct: float = Field(default=0.0, ge=0, le=90)
    case_id: str = INV.DEMO_CASE_ID


class BriefRequest(BaseModel):
    case_id: str = INV.DEMO_CASE_ID
    station: Optional[str] = None
    simulation: Optional[Dict[str, Any]] = None
    cost_impact: Optional[Dict[str, Any]] = None


class VisionRequest(BaseModel):
    demo_type: str  # surface-crack | scratch | dent | misalignment | normal


class CostsRequest(BaseModel):
    scrap_unit_cost: float = Field(gt=0)
    rework_unit_cost: float = Field(gt=0)
    downtime_hour_cost: float = Field(gt=0)
    contribution_margin: float = Field(gt=0)
    case_id: str = INV.DEMO_CASE_ID
    units_delta: float = 0.0


class BottleneckRequest(BaseModel):
    utilization: float = Field(default=0.5, gt=0, le=1)
    queue: float = Field(default=0.3, gt=0, le=1)
    wait: float = Field(default=0.2, gt=0, le=1)


# --------------------------------------------------------------------------- #
# Health / status
# --------------------------------------------------------------------------- #

@app.get("/api/health")
def health() -> Dict[str, Any]:
    ds = {d["id"]: d["available"] for d in A.datasets_status()}
    return {
        "status": "ok",
        "version": APP_VERSION,
        "plant_status": "ONLINE",
        "datasets": ds,
        "ai": ai_layer.ai_status(),
        "time": time.time(),
    }


@app.get("/api/datasets")
def datasets() -> Dict[str, Any]:
    return {
        "root": str(A.dataset_dir()),
        "datasets": A.datasets_status(),
        "mat": A._load_mat(),
    }


@app.get("/api/ai/status")
def ai_status() -> Dict[str, Any]:
    return ai_layer.ai_status()


# --------------------------------------------------------------------------- #
# Model summaries
# --------------------------------------------------------------------------- #

@app.get("/api/model/1/summary")
def model1_summary():
    return A.model_summary(1)


@app.get("/api/model/2/summary")
def model2_summary():
    return A.model_summary(2)


@app.get("/api/model/3/summary")
def model3_summary():
    return A.model_summary(3)


@app.get("/api/model/{model_id}/features")
def model_features(model_id: int, search: str = "", group: str = "",
                   page: int = 1, page_size: int = 25):
    if model_id not in (1, 2, 3):
        raise HTTPException(404, "unknown model")
    return A.feature_table(model_id, search=search, group=group,
                           page=page, page_size=page_size)


@app.get("/api/model/{model_id}/correlations")
def model_correlations(model_id: int):
    if model_id not in (1, 2, 3):
        raise HTTPException(404, "unknown model")
    return A.correlations(model_id)


@app.get("/api/model/{model_id}/scatter")
def model_scatter(model_id: int, x: str, y: str, max_points: int = 1200):
    if model_id not in (1, 2, 3):
        raise HTTPException(404, "unknown model")
    return A.scatter(model_id, x, y, max_points=max_points)


@app.get("/api/model/{model_id}/column")
def model_column(model_id: int, col: str, bins: int = 24):
    """Stats + histogram for one column (Dataset Explorer detail view)."""
    loaders = {1: A._load_model1, 2: A._load_model2, 3: A._load_model3}
    loader = loaders.get(model_id)
    if loader is None:
        raise HTTPException(404, "unknown model")
    df = loader()
    if df.empty or col not in df.columns:
        raise HTTPException(404, f"column not found: {col}")
    return {"column": col, "stats": A._series_stats(df[col]),
            "histogram": A._histogram(df[col], bins)}


# --------------------------------------------------------------------------- #
# Stations / bottlenecks
# --------------------------------------------------------------------------- #

@app.get("/api/stations")
def stations():
    df3 = A._load_model3()
    if df3.empty:
        raise HTTPException(503, "Model 3 dataset unavailable")
    return {"stations": A.station_metrics(df3)}


@app.get("/api/bottlenecks")
def bottlenecks(utilization: float = 0.5, queue: float = 0.3, wait: float = 0.2):
    return A.bottlenecks({"utilization": utilization, "queue": queue, "wait": wait})


@app.post("/api/bottlenecks")
def bottlenecks_post(req: BottleneckRequest):
    return A.bottlenecks(req.model_dump())


# --------------------------------------------------------------------------- #
# Investigation
# --------------------------------------------------------------------------- #

@app.get("/api/investigation")
def investigation(case_id: str = INV.DEMO_CASE_ID):
    try:
        return INV.get_investigation(case_id)
    except Exception as e:
        raise HTTPException(500, f"investigation failed: {e}")


# --------------------------------------------------------------------------- #
# Cost model
# --------------------------------------------------------------------------- #

@app.post("/api/costs")
def costs(req: CostsRequest):
    return INV.business_impact(
        units_gained=req.units_delta,
        case_id=req.case_id,
        costs=req.model_dump(),
    )


# --------------------------------------------------------------------------- #
# Simulation
# --------------------------------------------------------------------------- #

@app.post("/api/simulation")
def simulation(req: SimRequest):
    try:
        return INV.simulate(
            station_id=req.station,
            cycle_adj_pct=req.cycle_adj_pct,
            extra_capacity=req.extra_capacity,
            queue_reduction_pct=req.queue_reduction_pct,
            case_id=req.case_id,
        )
    except Exception as e:
        raise HTTPException(500, f"simulation failed: {e}")


# --------------------------------------------------------------------------- #
# AI decision brief
# --------------------------------------------------------------------------- #

@app.post("/api/decision-brief")
def decision_brief(req: BriefRequest):
    try:
        inv = INV.get_investigation(req.case_id)
        station = req.station or inv["station"]
        sim = req.simulation
        if sim is None:
            sim = INV.simulate(station_id=station, cycle_adj_pct=-10.0,
                               case_id=req.case_id)
        if req.cost_impact is None:
            units_delta = (sim.get("simulated", {}).get("throughput", 0)
                           - sim.get("current", {}).get("throughput", 0))
            req.cost_impact = INV.business_impact(units_delta, case_id=req.case_id)
        payload = {
            "case": inv["id"],
            "defect": inv["defect"],
            "batch": inv["batch"],
            "station": inv.get("station_name", station),
            "severity": inv["severity"],
            "confidence": inv["confidence"],
            "location": inv["location"],
            "metrics": inv["metrics"],
            "signals": inv["signals"],
            "correlation_evidence": inv["correlation_evidence"],
            "queue_pressure_percentile": inv.get("queue_pressure_percentile"),
            "bottleneck": A.bottlenecks().get("top"),
            "cost_impact": req.cost_impact,
            "simulation": sim,
        }
        brief = ai_layer.decision_brief(payload)
        return {"brief": brief, "payload_echo": None,
                "ai_status": ai_layer.ai_status()}
    except Exception as e:
        raise HTTPException(500, f"decision brief failed: {e}")


# --------------------------------------------------------------------------- #
# Vision demo
# --------------------------------------------------------------------------- #

VISION_DEMOS: Dict[str, Dict[str, Any]] = {
    "surface-crack": {
        "label": "Surface Crack", "severity": "high", "confidence": 94.2,
        "location": "Upper-right surface",
        "box": {"x": 63, "y": 17, "w": 21, "h": 13},
        "possible_station": "PRESS3", "batch": "B17",
    },
    "scratch": {
        "label": "Scratch", "severity": "medium", "confidence": 87.6,
        "location": "Lower-left edge",
        "box": {"x": 17, "y": 64, "w": 27, "h": 10},
        "possible_station": "CELL1", "batch": "B21",
    },
    "dent": {
        "label": "Dent", "severity": "medium", "confidence": 83.1,
        "location": "Lower panel",
        "box": {"x": 40, "y": 58, "w": 18, "h": 16},
        "possible_station": "FORKLIFT", "batch": "B09",
    },
    "misalignment": {
        "label": "Misalignment", "severity": "low", "confidence": 78.9,
        "location": "Left seam",
        "box": {"x": 12, "y": 30, "w": 14, "h": 34},
        "possible_station": "CELL2", "batch": "B33",
    },
    "normal": {
        "label": "No defect", "severity": "none", "confidence": 96.8,
        "location": None, "box": None, "possible_station": None, "batch": "B40",
    },
}


@app.get("/api/vision/demos")
def vision_demos():
    return {"demos": [{"id": k, **{kk: vv for kk, vv in v.items() if kk != "box"}}
                      for k, v in VISION_DEMOS.items()],
            "label": "Prototype Vision Result"}


@app.post("/api/vision-demo")
def vision_demo(req: VisionRequest):
    d = VISION_DEMOS.get(req.demo_type)
    if d is None:
        raise HTTPException(400, f"unknown demo type: {req.demo_type}")
    out = {k: v for k, v in d.items() if k != "possible_station"}
    out["demo"] = True
    out["label_tag"] = "Prototype Vision Result"
    out["note"] = ("Demo inspection — synthetic result for the prototype; "
                   "not a measured ML output. Evaluation pending.")
    return out


@app.post("/api/vision/upload")
async def vision_upload(file: UploadFile = File(None)):
    """
    Uploaded images are NOT analysed by a trained model in this prototype.
    They are accepted for the inspection UX and returned with an honest
    'analysis pending trained model' result.
    """
    if file is None:
        raise HTTPException(400, "no file provided")
    raw = await file.read()
    if not raw:
        raise HTTPException(400, "empty file")
    if len(raw) > 8 * 1024 * 1024:
        raise HTTPException(413, "file too large (max 8 MB)")
    if not (file.content_type or "").startswith("image/"):
        raise HTTPException(415, "only image files are supported")
    return {
        "demo": False,
        "uploaded": True,
        "filename": file.filename,
        "label": "Analysis pending",
        "severity": "unknown",
        "confidence": None,
        "location": None,
        "box": None,
        "label_tag": "Prototype Vision Result",
        "note": ("Uploaded image received. No trained vision model is wired in this "
                 "prototype — use the demo inspections for the guided flow. "
                 "Evaluation pending."),
    }


# --------------------------------------------------------------------------- #
# Decision brief export (printable HTML)
# --------------------------------------------------------------------------- #

@app.get("/api/decision-brief/export", response_class=HTMLResponse)
def export_brief(case_id: str = INV.DEMO_CASE_ID):
    try:
        inv = INV.get_investigation(case_id)
        sim = INV.simulate(station_id=inv["station"], cycle_adj_pct=-10.0, case_id=case_id)
        units_delta = (sim["simulated"]["throughput"] - sim["current"]["throughput"])
        cost = INV.business_impact(units_delta, case_id=case_id)
        payload = {
            "case": inv["id"], "defect": inv["defect"], "batch": inv["batch"],
            "station": inv.get("station_name", inv["station"]), "severity": inv["severity"],
            "confidence": inv["confidence"], "location": inv["location"],
            "metrics": inv["metrics"], "signals": inv["signals"],
            "correlation_evidence": inv["correlation_evidence"],
            "queue_pressure_percentile": inv.get("queue_pressure_percentile"),
            "bottleneck": A.bottlenecks().get("top"),
            "cost_impact": cost, "simulation": sim,
        }
        b = ai_layer.decision_brief(payload)
        return HTMLResponse(_brief_html(inv, b, sim, cost))
    except Exception as e:
        raise HTTPException(500, f"export failed: {e}")


def _esc(x: Any) -> str:
    return html.escape(str(x))


def _brief_html(inv: Dict[str, Any], b: Dict[str, Any],
                sim: Dict[str, Any], cost: Dict[str, Any]) -> str:
    cur, simd = sim["current"], sim["simulated"]
    d = sim["deltas"]
    brk = cost["breakdown"]
    rows = [
        ("Problem", b["problem"]),
        ("Evidence", "".join(f"<li>{_esc(e)}</li>" for e in b["evidence"])),
        ("Possible contributing factor", b["possible_cause"]),
        ("Production impact", b["production_impact"]),
        ("Cost impact", b["cost_impact"]),
        ("What-if result", b["scenario"]),
        ("Recommended next step", b["next_step"]),
    ]
    sections = "".join(
        f"<h2>{_esc(t)}</h2>{('<ul>' + c + '</ul>') if t == 'Evidence' else f'<p>{_esc(c)}</p>'}"
        for t, c in rows
    )
    cur_json = {}
    return f"""<!doctype html>
<html><head><meta charset="utf-8">
<title>Factory Detective — Decision Brief { _esc(inv['id']) }</title>
<style>
  body {{ font-family: 'Segoe UI', Arial, sans-serif; color:#0b1220; margin:0; background:#eef1f5; }}
  .page {{ max-width: 860px; margin: 24px auto; background:#fff; padding: 40px 48px;
          box-shadow: 0 2px 14px rgba(0,0,0,.12); }}
  h1 {{ font-size: 22px; margin:0 0 4px; letter-spacing:.5px; }}
  .sub {{ color:#5b6b7c; font-size: 12px; margin-bottom: 22px; }}
  h2 {{ font-size: 13px; text-transform: uppercase; letter-spacing: 1.2px; color:#0a7ea4;
       border-bottom: 2px solid #e3e8ee; padding-bottom: 4px; margin: 22px 0 8px; }}
  p, li {{ font-size: 13.5px; line-height: 1.55; }}
  table {{ width:100%; border-collapse: collapse; font-size: 12.5px; margin: 10px 0 4px; }}
  th, td {{ border: 1px solid #dfe5ec; padding: 6px 9px; text-align:left; }}
  th {{ background:#f4f6f9; text-transform: uppercase; font-size: 10.5px; letter-spacing:.8px; }}
  .tag {{ display:inline-block; font-size:10px; border:1px solid #cbd5e1; border-radius:3px;
         padding:2px 6px; margin-right:6px; color:#475569; text-transform:uppercase; }}
  ul {{ margin: 4px 0; padding-left: 20px; }}
  .foot {{ margin-top: 26px; font-size: 11px; color:#7a8794; border-top: 1px solid #e3e8ee;
          padding-top: 10px; }}
  @media print {{ body {{ background:#fff; }} .page {{ box-shadow:none; margin:0; }} }}
</style></head><body><div class="page">
<h1>FACTORY DETECTIVE — AI DECISION BRIEF</h1>
<div class="sub">Investigation {_esc(inv['id'])} · Defect: {_esc(inv['defect'])} · Batch: {_esc(inv['batch'])}
 · Station: {_esc(inv.get('station_name',''))} · Generated {time.strftime('%Y-%m-%d %H:%M')}
 · <span class="tag">{_esc(b.get('generator',''))}</span><span class="tag">AI-GENERATED SUMMARY</span></div>
{sections}
<h2>Simulation summary (Prototype simulation)</h2>
<table>
<tr><th></th><th>Throughput</th><th>Utilization</th><th>Queue</th><th>Wait time</th></tr>
<tr><td>Current</td><td>{cur['throughput']:,.0f}</td><td>{cur['utilization']:.1f}%</td>
 <td>{cur['queue']:,.1f}</td><td>{cur['wait_time']:.2f} h</td></tr>
<tr><td>Simulated</td><td>{simd['throughput']:,.0f}</td><td>{simd['utilization']:.1f}%</td>
 <td>{simd['queue']:,.1f}</td><td>{simd['wait_time']:.2f} h</td></tr>
<tr><td>Delta</td><td>{d['throughput_pct']:+.1f}%</td><td>{d['utilization_pct']:+.1f} pp</td>
 <td>{d['queue_pct']:+.1f}%</td><td>{d['wait_time_pct']:+.1f}%</td></tr>
</table>
<h2>Cost impact ({_esc(cost['label'])})</h2>
<table>
<tr><th>Scrap</th><th>Rework</th><th>Downtime</th><th>Lost output</th><th>Total</th></tr>
<tr><td>₹{brk['scrap']:,.0f}</td><td>₹{brk['rework']:,.0f}</td><td>₹{brk['downtime']:,.0f}</td>
 <td>₹{brk['lost_output']:,.0f}</td><td><b>₹{cost['total_estimated_impact']:,.0f}</b></td></tr>
</table>
<div class="foot">Factory Detective is a software-only decision-support prototype. Figures marked
USER ASSUMPTIONS are configurable estimates, not audited costs. Simulation output is a
prototype analytical estimate derived from the supplied discrete-event simulation dataset.
No machine control or PLC integration. Generated by {_esc(b.get('generator','local'))}.</div>
</div></body></html>"""


# --------------------------------------------------------------------------- #
# Error handling — never leak stack traces
# --------------------------------------------------------------------------- #

@app.exception_handler(Exception)
async def unhandled(_req, exc: Exception):
    return HTMLResponse(status_code=500, content=(
        '{"detail": "Internal error — see server logs"}'))
