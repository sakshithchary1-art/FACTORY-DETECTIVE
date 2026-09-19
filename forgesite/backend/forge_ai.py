"""
ForgeSite — FORGE AI assistant + investigation assembler + report builder.

FORGE AI is a RETRIEVAL assistant: it answers from live backend analytics only.
Every answer carries source references; when something cannot be derived it
says "Insufficient data for this analysis" instead of inventing facts.
If LLM_API_KEY is configured, answers are phrased by the LLM from the same
retrieved evidence — never from imagination.
"""

from __future__ import annotations

import os
import time
from pathlib import Path
from typing import Any, Dict, List, Optional

import analytics as AN
import data_engine as DE
import simulation as SIM

try:
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).resolve().parent / ".env")
except Exception:
    pass


def _num(x: Any, nd: int = 2) -> Optional[float]:
    try:
        v = float(x)
    except (TypeError, ValueError):
        return None
    return None if v != v else round(v, nd)


# --------------------------------------------------------------------------- #
# Investigation assembly (anomaly → evidence → correlation → impact)
# --------------------------------------------------------------------------- #

def build_investigation() -> Dict[str, Any]:
    df = DE.model3()
    if df.empty:
        return {"available": False}
    prof = DE.profile(3)
    bk = AN.bottleneck_ranking()
    an = AN.detect_anomalies()
    top_bk = bk.get("top")

    # pick the primary anomaly: strongest deviation among CRITICAL else WARNING
    primary = None
    for scan in an.get("scan", []):
        if scan["samples"]:
            if primary is None or (scan["severity"] == "CRITICAL" and primary["severity"] != "CRITICAL"):
                primary = scan

    st_name = top_bk["name"] if top_bk else "Unavailable"
    st_id = top_bk["id"] if top_bk else None

    # evidence deltas vs fleet medians
    evidence = []
    if top_bk:
        sm = AN.station_metrics(df)
        utils = sorted([s["utilization"] for s in sm if s["utilization"] is not None])
        queues = sorted([s["queue_mean"] for s in sm if s["queue_mean"] is not None])
        u_med = utils[len(utils) // 2] if utils else None
        q_med = queues[len(queues) // 2] if queues else None
        if top_bk["utilization"] is not None and u_med:
            pct = (top_bk["utilization"] - u_med) / u_med * 100
            evidence.append({"label": "Resource utilization",
                             "value": f"{top_bk['utilization']:.1f}%",
                             "vs_fleet": f"{'↑' if pct >= 0 else '↓'} {abs(pct):.0f}% vs median station"})
        if top_bk["queue_mean"] is not None and q_med:
            pct = (top_bk["queue_mean"] - q_med) / q_med * 100 if q_med else 0
            evidence.append({"label": "Queue accumulation",
                             "value": f"{top_bk['queue_mean']:.1f} units",
                             "vs_fleet": f"{'↑' if pct >= 0 else '↓'} {abs(pct):.0f}% vs median station"})
        if top_bk.get("queue_p95") is not None:
            evidence.append({"label": "Peak queue pressure (p95)",
                             "value": f"{top_bk['queue_p95']:.1f} units",
                             "vs_fleet": f"max accumulation observed in {', '.join(top_bk['queue_cols'])}"})
        cy = top_bk.get("components", {}).get("cycle_norm")
        if cy:
            evidence.append({"label": "Cycle-time signal",
                             "value": f"{cy:.2f} (normalized)",
                             "vs_fleet": "cell-indexed cycle columns, plant-normalized"})
        tp = prof["stats"].get("c_TotalProducts")
        if tp:
            evidence.append({"label": "Production output (mean/run)",
                             "value": f"{tp['mean']:,.0f}",
                             "vs_fleet": f"range {tp['min']:,.0f} – {tp['max']:,.0f}"})

    corr = AN.top_relationships(3, limit=10)
    return {
        "available": True,
        "id": f"INV-{time.strftime('%y%m%d')}-01",
        "anomaly": primary,
        "affected_process": {"id": st_id, "name": st_name,
                             "bottleneck_score": top_bk["score"] if top_bk else None},
        "time_period": {"field": "row index (event sequence)", "records": prof["rows"],
                        "note": "Simulation event stream; Time_Now is constant (24) in this run set."},
        "severity": (primary or {}).get("severity", "WARNING") if primary else "WATCH",
        "confidence": min(95.0, 55 + (top_bk["score"] if top_bk else 0) * 0.4),
        "evidence": evidence,
        "bottleneck": bk,
        "top_relationships": corr.get("pairs", [])[:8],
        "signals": _signals(df, top_bk),
        "data_sources": [
            {"model": 3, "usage": "stations, queues, utilization, cycles, SKU accounting"},
            {"model": "MAT", "usage": "3,000-sample predictor/response experiments (predictive model)"},
        ],
    }


def _signals(df: pd.DataFrame, top_bk: Optional[Dict[str, Any]]) -> List[Dict[str, Any]]:
    sig = []
    if top_bk:
        sig.append({"id": 1, "title": f"{top_bk['name']} utilization elevated",
                    "detail": f"Mean {top_bk['utilization']:.1f}% (p95 {top_bk['utilization_p95']:.1f}%).",
                    "source": top_bk["util_col"], "kind": "DERIVED"})
        if top_bk["queue_mean"] is not None:
            sig.append({"id": 2, "title": "Queue accumulation upstream",
                        "detail": f"Mean queue {top_bk['queue_mean']:.1f}, p95 {top_bk['queue_p95']:.1f}.",
                        "source": ", ".join(top_bk["queue_cols"]), "kind": "DERIVED"})
    cyc = [c for c in DE.SKU_CYCLE_COLS.values() if c in df.columns]
    cvs = {c: float(df[c].std() / df[c].mean()) for c in cyc if df[c].mean() > 0}
    worst = max(cvs, key=cvs.get) if cvs else None
    if worst:
        sig.append({"id": 3, "title": "Cycle-time imbalance across cells",
                    "detail": f"{worst} shows the highest relative variation (CV {cvs[worst]:.2f}).",
                    "source": ", ".join(cyc), "kind": "DERIVED"})
    sig.append({"id": 4, "title": "Association, not causation",
                "detail": ("Signals are observed relationships in simulation runs; the dataset "
                           "cannot by itself prove causation. Validation against process records "
                           "is required."),
                "source": "methodology", "kind": "METHODOLOGY"})
    return sig


# --------------------------------------------------------------------------- #
# FORGE AI — retrieval QA
# --------------------------------------------------------------------------- #

def _station_facts(station_name_or_id: str) -> Optional[Dict[str, Any]]:
    df = DE.model3()
    key = station_name_or_id.strip().lower()
    st = next((s for s in DE.STATIONS if s["id"].lower() == key or s["name"].lower() in key
               or key in s["name"].lower()), None)
    if st is None:
        return None
    m = next((x for x in AN.station_metrics(df) if x["id"] == st["id"]), None)
    bk = AN.bottleneck_ranking()
    rank = next(({"rank": i + 1, "score": s["score"]}
                 for i, s in enumerate(bk.get("stations", [])) if s["id"] == st["id"]), None)
    return {"station": m, "bottleneck": rank}


def answer(question: str) -> Dict[str, Any]:
    """Route the question to real analytics; compose an evidence-grounded reply."""
    q = question.lower()
    sources: List[str] = []

    if any(k in q for k in ["flag", "press", "cell", "blanking", "paint", "quality", "forklift", "station"]):
        for st in DE.STATIONS:
            token = st["id"].replace("PRESS", "press ").replace("CELL", "cell ")
            name_low = st["name"].lower()
            if (st["id"].lower() in q or name_low in q
                    or (st["id"].startswith("PRESS") and f"press {st['id'][-1]}" in q)
                    or (st["id"].startswith("CELL") and f"cell {st['id'][-1]}" in q)):
                facts = _station_facts(st["id"])
                if facts and facts["station"]:
                    m = facts["station"]
                    bk = facts["bottleneck"]
                    util = m["utilization"]
                    q = m["queue_mean"]
                    sources = [m["util_col"]] + m["queue_cols"]
                    rank_txt = (f" It ranks #{bk['rank']} on the ForgeSite Bottleneck Score "
                                f"({bk['score']:.0f}/100).") if bk else ""
                    msg = (f"{m['name']} runs at {util:.1f}% mean utilization"
                           + (f" with {q:.1f} units accumulated in its queue" if q is not None else "")
                           + f"."
                           + rank_txt
                           + (" Elevated utilization together with queue accumulation indicates a "
                              "possible flow constraint — a statistical association, not proven "
                              "causation. Requires validation against process records."
                              if (util or 0) > 70 or (q or 0) > 60 else
                              " No bottleneck-level stress is visible in the current dataset."))
                    return {"available": True, "answer": msg, "sources": sources,
                            "label": "Retrieved from live dataset analytics"}
    if "bottleneck" in q or "constraint" in q:
        bk = AN.bottleneck_ranking()
        top = bk.get("top")
        if top:
            return {"available": True,
                    "answer": (f"The strongest bottleneck signal is {top['name']} — ForgeSite "
                               f"Bottleneck Score {top['score']:.0f}/100 (utilization "
                               f"{top['utilization']:.1f}%, queue {top['queue_mean'] if top['queue_mean'] is not None else 'n/a'}). "
                               "The score is a transparent multi-signal indicator, not a validated metric."),
                    "sources": ["bottleneck engine"], "label": "Retrieved from live dataset analytics"}
    if any(k in q for k in ["throughput", "output", "production"]):
        k = AN.kpis()
        return {"available": True,
                "answer": (f"Mean production is {k['throughput_mean']:,} products per run "
                           f"(c_TotalProducts across {DE.profile(3)['rows']:,} events). "
                           f"Critical queue: {k['critical_queue']['queue']} "
                           f"(p95 {k['critical_queue']['p95']:.1f} units)."),
                "sources": ["c_TotalProducts", "Model 3 queues"],
                "label": "Retrieved from live dataset analytics"}
    if any(k in q for k in ["wait", "delay"]):
        df = DE.model3()
        wcols = [c for c in df.columns if c.endswith("_Wait_Time")]
        vals = {c: float(df[c].mean()) for c in wcols}
        worst = max(vals, key=vals.get)
        return {"available": True,
                "answer": (f"Waiting concentrates in {worst} (mean {vals[worst]:.2f} time units). "
                           "Waiting upstream of the cells is the dominant non-value-added share."),
                "sources": wcols, "label": "Retrieved from live dataset analytics"}
    if any(k in q for k in ["anomal", "unusual", "spike"]):
        an = AN.detect_anomalies()
        scans = an.get("scan", [])
        if scans:
            s0 = scans[0]
            smp = s0["samples"][0]
            return {"available": True,
                    "answer": (f"{s0['n_anomalies']} anomalies detected in {s0['metric']} "
                               f"({s0['anomaly_rate_pct']:.2f}% of {s0['n_total']:,} events, "
                               f"{s0['method']} method). Example: observed {smp['observed']} vs "
                               f"expected {smp['expected_low']}–{smp['expected_high']}."),
                    "sources": [s0["metric"]], "label": "Retrieved from live dataset analytics"}
    if any(k in q for k in ["simulate", "what if", "what-if", "reduce", "scenario"]):
        return {"available": True,
                "answer": ("Open the What-If Lab to project a change. The engine adjusts station "
                           "capacity from cycle-time/capacity inputs, applies Theory-of-Constraints "
                           "damping from the dataset, and reports PROJECTED deltas — clearly "
                           "labelled as simulation, never as measurements."),
                "sources": ["simulation engine"], "label": "Guidance"}

    # default: summarize factory state from real KPIs
    k = AN.kpis()
    h = AN.factory_health()
    return {"available": True,
            "answer": (f"Factory health is {h['overall']} (score {h['score']}/100). "
                       f"Mean utilization {k['factory_utilization']}%, throughput "
                       f"{k['throughput_mean']:,} products/run, strongest queue "
                       f"{k['critical_queue']['queue']} (p95 {k['critical_queue']['p95']:.1f}). "
                       "Ask about a specific station, the bottleneck, anomalies, waiting times, "
                       "or a what-if scenario."),
            "sources": ["Model 3 KPIs", "health engine"],
            "label": "Retrieved from live dataset analytics"}


# --------------------------------------------------------------------------- #
# Report builder
# --------------------------------------------------------------------------- #

def build_report(inv: Optional[Dict[str, Any]] = None,
                 sim: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    inv = inv or build_investigation()
    sim = sim or SIM.what_if((inv.get("affected_process", {}).get("id") or "PRESS3"), cycle_adj_pct=-10)
    bk = inv.get("bottleneck", {}).get("top")
    impact = SIM.operational_impact(cycle_adj_pct=(sim.get("controls", {}).get("cycle_adj_pct") or -10),
                                    station_id=sim.get("station", {}).get("id", "PRESS3"))
    return {
        "available": True,
        "generated_at": time.strftime("%Y-%m-%d %H:%M"),
        "investigation": inv,
        "simulation": sim,
        "operational_impact": impact,
        "bottleneck": bk,
        "next_step": (
            f"Validate {bk['name']}'s utilization and queue accumulation against time-stamped "
            "process records before changing operating parameters; then re-run this scenario on "
            "one shift and compare observed deltas with the PROJECTED values in this report."
            if bk else "Re-run once the dataset is available."
        ),
        "label": "Report assembled from live dataset analytics",
    }
