"""
Factory Detective — AI abstraction layer.

If LLM_API_KEY is configured, the decision-brief generator calls the LLM with
a compact STRUCTURED investigation payload (never the raw dataset) and expects
strict JSON back. On any error — or when no key exists — it falls back to a
deterministic local generator built from the same structured data.

The app must NEVER break because an API key is missing.
"""

from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any, Dict, List, Optional

try:
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).resolve().parent / ".env")
except Exception:  # pragma: no cover
    pass

# --------------------------------------------------------------------------- #
# Configuration
# --------------------------------------------------------------------------- #

def _cfg() -> Dict[str, Optional[str]]:
    return {
        "key": os.environ.get("LLM_API_KEY") or None,
        "base_url": os.environ.get("LLM_BASE_URL") or "https://api.openai.com/v1",
        "model": os.environ.get("LLM_MODEL") or "gpt-4o-mini",
    }


def ai_status() -> Dict[str, Any]:
    c = _cfg()
    return {
        "llm_configured": bool(c["key"]),
        "model": c["model"] if c["key"] else None,
        "mode": "llm" if c["key"] else "local-deterministic",
        "note": (
            "Using configured LLM with strict-JSON prompt; falls back to the "
            "deterministic local generator on any error."
        ) if c["key"] else
        "No LLM key configured — using the deterministic local decision-brief generator.",
    }


# --------------------------------------------------------------------------- #
# Prompt
# --------------------------------------------------------------------------- #

SYSTEM_PROMPT = """You are the decision-support analyst inside Factory Detective, an industrial
AI investigation platform. You receive a STRUCTURED investigation payload
about one manufacturing defect case. You must NEVER invent measurements,
accuracy figures, costs that are not in the payload, or claim causation from
correlation. Use the phrasing "possible contributing factor" for correlative
evidence. Answer ONLY with a JSON object with exactly these keys:

{
  "problem": "one tight paragraph",
  "evidence": ["3 to 5 short bullet strings citing the payload numbers"],
  "possible_cause": "one paragraph, hedged wording",
  "production_impact": "one paragraph citing throughput/queue/utilization deltas",
  "cost_impact": "one paragraph referencing the configured assumptions",
  "scenario": "one paragraph describing the what-if result",
  "next_step": "one concrete, testable engineering next step"
}"""


def _payload(payload: Dict[str, Any]) -> str:
    compact = {
        "case": payload.get("case"),
        "defect": payload.get("defect"),
        "batch": payload.get("batch"),
        "station": payload.get("station"),
        "severity": payload.get("severity"),
        "inspection_confidence_pct": payload.get("confidence"),
        "defect_location": payload.get("location"),
        "current_metrics": payload.get("metrics"),
        "signals": [
            {"title": s.get("title"), "detail": s.get("detail"),
             "kind": s.get("kind"), "confidence": s.get("confidence")}
            for s in payload.get("signals", [])
        ],
        "bottleneck": payload.get("bottleneck"),
        "cost_impact": {
            "total_estimated_impact": (payload.get("cost_impact") or {}).get("total_estimated_impact"),
            "breakdown": (payload.get("cost_impact") or {}).get("breakdown"),
            "assumptions_label": "user-configured assumptions",
        },
        "simulation": {
            "label": (payload.get("simulation") or {}).get("label"),
            "controls": (payload.get("simulation") or {}).get("controls"),
            "deltas": (payload.get("simulation") or {}).get("deltas"),
            "current": (payload.get("simulation") or {}).get("current"),
            "simulated": (payload.get("simulation") or {}).get("simulated"),
            "note": (payload.get("simulation") or {}).get("note"),
        },
    }
    return json.dumps(compact, indent=1)


# --------------------------------------------------------------------------- #
# LLM path
# --------------------------------------------------------------------------- #

def _generate_via_llm(payload: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    c = _cfg()
    if not c["key"]:
        return None
    try:
        from openai import OpenAI
        client = OpenAI(api_key=c["key"], base_url=c["base_url"], timeout=25)
        resp = client.chat.completions.create(
            model=c["model"],
            temperature=0.2,
            max_tokens=900,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": _payload(payload)},
            ],
            response_format={"type": "json_object"},
        )
        text = resp.choices[0].message.content or ""
        obj = json.loads(text)
        required = ["problem", "evidence", "possible_cause", "production_impact",
                    "cost_impact", "scenario", "next_step"]
        if all(k in obj for k in required):
            obj["generator"] = f"llm:{c['model']}"
            return obj
        return None
    except Exception:
        return None


# --------------------------------------------------------------------------- #
# Local deterministic generator (always available)
# --------------------------------------------------------------------------- #

def _fmt_units(x: Optional[float]) -> str:
    if x is None:
        return "n/a"
    return f"{x:,.0f}"


def _fmt_money(x: Optional[float]) -> str:
    if x is None:
        return "₹n/a"
    return f"₹{x:,.0f}"


def _generate_local(payload: Dict[str, Any]) -> Dict[str, Any]:
    m = payload.get("metrics") or {}
    sim = payload.get("simulation") or {}
    cost = payload.get("cost_impact") or {}
    bk = payload.get("bottleneck") or {}
    signals = payload.get("signals") or []
    corr = payload.get("correlation_evidence") or []

    util = m.get("utilization")
    util_p95 = m.get("utilization_p95")
    queue = m.get("queue_mean")
    q_p95 = m.get("queue_p95")
    thr = m.get("throughput_mean")

    cur, simd = sim.get("current") or {}, sim.get("simulated") or {}
    d = sim.get("deltas") or {}
    brk = cost.get("breakdown") or {}
    asm = cost.get("assumptions") or {}

    evidence: List[str] = []
    if util is not None:
        evidence.append(
            f"{payload.get('station')} utilization averages {util:.1f}% "
            f"(p95 {util_p95:.1f}%) across the Model 3 run set.")
    if queue is not None:
        evidence.append(
            f"Queue ahead of the station averages {queue:,.1f} units "
            f"(p95 {q_p95:,.1f}), indicating parts waiting before processing.")
    top = next((c for c in corr if abs((c.get('r_with_total_products') or 0)) > 0.2), None)
    if top:
        evidence.append(
            f"{top.get('label')} shows a statistical association with total products "
            f"(r = {top.get('r_with_total_products'):+.2f}) — correlation, not proven causation.")
    for s in signals[:2]:
        if s.get("kind") in ("dataset_metric", "dataset_correlation"):
            evidence.append(f"{s.get('title')}: {s.get('detail')}")

    d_thr = d.get("throughput_pct")
    d_queue = d.get("queue_pct")
    d_util = d.get("utilization_pct")

    scenario_txt = (
        f"Prototype simulation ({(sim.get('controls') or {})}): throughput "
        f"{_fmt_units(cur.get('throughput'))} → {_fmt_units(simd.get('throughput'))} "
        f"({(d_thr if d_thr is not None else 0):+.1f}%), queue "
        f"{_fmt_units(cur.get('queue'))} → {_fmt_units(simd.get('queue'))} "
        f"({(d_queue if d_queue is not None else 0):+.1f}%), utilization "
        f"{(cur.get('utilization') if cur.get('utilization') is not None else 0):.1f}% → "
        f"{(simd.get('utilization') if simd.get('utilization') is not None else 0):.1f}% "
        f"({(d_util if d_util is not None else 0):+.1f} pp). "
        f"{sim.get('note') or ''}"
    )

    total = cost.get("total_estimated_impact")
    cost_txt = (
        f"Estimated impact {_fmt_money(total)} under user-configured assumptions "
        f"(scrap {_fmt_money(asm.get('scrap_unit_cost'))}/unit × "
        f"{(cost.get('quantities') or {}).get('scrap_units')}, rework "
        f"{_fmt_money(asm.get('rework_unit_cost'))}/unit, downtime "
        f"{_fmt_money(asm.get('downtime_hour_cost'))}/h, margin "
        f"{_fmt_money(asm.get('contribution_margin'))}/unit). "
        f"Breakdown — scrap {_fmt_money(brk.get('scrap'))}, rework {_fmt_money(brk.get('rework'))}, "
        f"downtime {_fmt_money(brk.get('downtime'))}, lost output {_fmt_money(brk.get('lost_output'))}. "
        f"These are planning estimates, not audited costs."
    )

    station = payload.get("station") or "the station"
    return {
        "problem": (
            f"Investigation {payload.get('case')} — a {str(payload.get('severity', '')).lower()} "
            f"defect ({payload.get('defect')}) was detected on batch {payload.get('batch')} "
            f"at {payload.get('location')}. The line trace associates the defect with "
            f"{station}, which is operating under sustained load in the dataset."
        ),
        "evidence": evidence[:5],
        "possible_cause": (
            f"Cycle-time variation at {station} is a possible contributing factor: higher "
            f"effective cycle times raise station congestion, which appears in the data as "
            f"elevated utilization and queue depth. This is an association observed across "
            f"simulation runs — not a confirmed cause."
        ),
        "production_impact": (
            f"Throughput around {_fmt_units(thr)} products per run is exposed to waiting and "
            f"queue pressure: queue depth of {(_fmt_units(queue) if queue is not None else 'n/a')} "
            f"ahead of {station} ({(payload.get('queue_pressure_percentile') or 0):.0f}th percentile "
            f"across stations) delays parts and reduces effective output."
        ),
        "cost_impact": cost_txt,
        "scenario": scenario_txt,
        "next_step": (
            f"Validate {station} cycle-time variation against actual production records "
            f"(time-stamped station logs vs. the simulation's cycle distributions) before "
            f"changing operating parameters; if confirmed, test the simulated cycle-time "
            f"reduction on one shift and measure queue depth and throughput against this brief."
        ),
        "generator": "local-deterministic",
    }


# --------------------------------------------------------------------------- #
# Public entry point
# --------------------------------------------------------------------------- #

def decision_brief(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Try the LLM, always fall back locally. Never raises."""
    status = ai_status()
    result = None
    if status["llm_configured"]:
        result = _generate_via_llm(payload)
    if result is None:
        result = _generate_local(payload)
    result["ai_mode"] = "AI-GENERATED SUMMARY" if status["llm_configured"] else "AI-GENERATED SUMMARY (local generator)"
    result["engine"] = status["mode"]
    return result
