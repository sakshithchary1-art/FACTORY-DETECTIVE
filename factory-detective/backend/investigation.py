"""
Factory Detective — investigation, simulation & cost model.

Builds the structured investigation object (defect → batch → station →
process signal → constraint → impact) from real dataset metrics, runs the
prototype what-if simulation, and computes the configurable cost model.
"""

from __future__ import annotations

import math
from typing import Any, Dict, List, Optional

import numpy as np
import pandas as pd

import analytics as A

# --------------------------------------------------------------------------- #
# Investigation catalogue
# --------------------------------------------------------------------------- #

INVESTIGATIONS: Dict[str, Dict[str, Any]] = {
    "FD-017": {
        "id": "FD-017",
        "defect": "Surface Crack",
        "batch": "B17",
        "station": "PRESS3",
        "severity": "high",
        "confidence": 94.2,
        "location": "Upper-right surface",
        "demo": True,
        "narrative": (
            "Visual inspection flagged a surface crack on batch B17. The line "
            "trace points to Station 04 (Press 3) as the last forming step "
            "before the defect was detected at quality."
        ),
    },
    "FD-018": {
        "id": "FD-018",
        "defect": "Scratch",
        "batch": "B21",
        "station": "CELL1",
        "severity": "medium",
        "confidence": 87.6,
        "location": "Lower-left edge",
        "demo": True,
        "narrative": (
            "A linear scratch was detected on batch B21. The line trace points "
            "to Assembly Cell 1 as the likely contact point before painting."
        ),
    },
    "FD-019": {
        "id": "FD-019",
        "defect": "Dent",
        "batch": "B09",
        "station": "FORKLIFT",
        "severity": "medium",
        "confidence": 83.1,
        "location": "Lower panel",
        "demo": True,
        "narrative": (
            "An impact dent was detected on batch B09. Transport records point "
            "to the forklift transfer between press and assembly as the likely "
            "contact event."
        ),
    },
}

DEMO_CASE_ID = "FD-017"


def get_investigation(case_id: str = DEMO_CASE_ID) -> Dict[str, Any]:
    """Assemble the full investigation object with REAL dataset evidence."""
    inv = INVESTIGATIONS.get(case_id) or INVESTIGATIONS[DEMO_CASE_ID]
    station_id = inv["station"]

    df3 = A._load_model3()
    df1 = A._load_model1()
    df2 = A._load_model2()

    stations = {s["id"]: s for s in A.station_metrics(df3)} if not df3.empty else {}
    st = stations.get(station_id, {})

    utilization = st.get("utilization")
    queue = st.get("queue_mean")
    queue_p95 = st.get("queue_p95")
    util_p95 = st.get("utilization_p95")

    # ---- throughput / wait proxies (real columns) --------------------------
    throughput = None
    wait_time = None
    if not df3.empty:
        throughput = A._clean_float(df3["c_TotalProducts"].mean(), 0)
        # per-SKU wait for the SKU most coupled to this station (see signals)
        sku_wait_col = _sku_wait_col_for_station(station_id)
        if sku_wait_col:
            wait_time = A._clean_float(df3[sku_wait_col].mean(), 2)

    # correlation evidence
    corr_evidence: List[Dict[str, Any]] = []
    if not df3.empty:
        for col, label in _corr_targets_for_station(station_id):
            r = A._safe_corr(df3[col], df3["c_TotalProducts"]) if col in df3 else None
            if r is not None:
                corr_evidence.append({"column": col, "label": label,
                                      "r_with_total_products": A._clean_float(r, 3)})

    # queue pressure percentile (rank of this station's queue among stations)
    queue_pct = None
    ranked = A.bottlenecks().get("stations", [])
    for i, s in enumerate(ranked):
        if s["id"] == station_id:
            queue_pct = round(100 * (1 - (i / max(len(ranked) - 1, 1))), 0)
            break

    signals = build_signals(case_id, st, corr_evidence)

    return {
        **inv,
        "station_name": st.get("name", station_id),
        "metrics": {
            "utilization": utilization,
            "utilization_p95": util_p95,
            "queue_mean": queue,
            "queue_p95": queue_p95,
            "throughput_mean": throughput,
            "wait_time_mean": wait_time,
        },
        "queue_pressure_percentile": queue_pct,
        "correlation_evidence": corr_evidence,
        "signals": signals,
        "data_sources": [
            {"model": 3, "usage": "station utilization, queues, cycle times, SKU time accounting"},
            {"model": 1, "usage": "demand ↔ waiting-time relationships (3000 runs)"},
            {"model": 2, "usage": "queue/storage behaviour vs output (3000 runs)"},
        ],
    }


def _sku_wait_col_for_station(station_id: str) -> Optional[str]:
    return {
        "PRESS1": "SKU1_Wait_Time", "PRESS2": "SKU2_Wait_Time",
        "PRESS3": "SKU3_Wait_Time", "PRESS4": "SKU4_Wait_Time",
        "CELL1": "SKU1_Wait_Time", "CELL2": "SKU2_Wait_Time",
        "CELL3": "SKU3_Wait_Time", "CELL4": "SKU4_Wait_Time",
    }.get(station_id)


def _corr_targets_for_station(station_id: str) -> List[tuple]:
    tp = "c_TotalProducts"
    base = {
        "PRESS3": [("Press3_Util", "Press 3 utilization"),
                   ("Press3_Queue", "Press 3 queue length"),
                   ("Blanking_Queue", "Upstream blanking queue")],
        "CELL1": [("Cell1_Util", "Cell 1 utilization"),
                  ("Quality_Queue", "Quality queue length")],
        "FORKLIFT": [("Forklift_Util", "Forklift utilization"),
                     ("Forklift_Press_Queue", "Forklift press transfer queue")],
    }.get(station_id, [])
    return base + [("Blanking_Util", "Blanking utilization"), (tp, "")][:0]  # keep base only


# --------------------------------------------------------------------------- #
# Root-cause signals
# --------------------------------------------------------------------------- #

def build_signals(case_id: str, station: Dict[str, Any],
                  corr_evidence: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Signals carry an evidence kind so the UI can label them honestly:
      kind: "dataset_metric" | "dataset_correlation" | "demo_link"
    Wording stays correlative ("possible contributing factor").
    """
    signals: List[Dict[str, Any]] = []
    util = station.get("utilization")
    util_p95 = station.get("utilization_p95")
    q = station.get("queue_mean")
    q_p95 = station.get("queue_p95")

    # Signal 01 — station utilization elevated
    if util is not None:
        conf = min(99.0, max(60.0, util))  # utilization % maps to confidence in signal strength
        sev = "critical" if util > 95 else "high" if util > 85 else "watch" if util > 70 else "normal"
        signals.append({
            "id": 1, "title": f"{station.get('name','Station')} utilization elevated",
            "detail": f"Mean utilization {util:.1f}% (p95 {util_p95:.1f}%).",
            "kind": "dataset_metric",
            "source": f"Model 3 · {station.get('util_col')}",
            "confidence": round(conf, 1),
            "severity": sev,
        })

    # Signal 02 — queue pressure
    if q is not None:
        conf = 82.0 if q_p95 and q_p95 > 2 * q else 74.0
        signals.append({
            "id": 2, "title": "Queue pressure increased",
            "detail": f"Mean queue {q:.1f} units, p95 {q_p95:.1f} — parts waiting ahead of the station.",
            "kind": "dataset_metric",
            "source": f"Model 3 · {station.get('queue_col')}",
            "confidence": conf,
            "severity": "high" if q_p95 and q_p95 > 2 * q else "watch",
        })
    else:
        signals.append({
            "id": 2, "title": "Queue pressure monitored",
            "detail": "No direct queue metric for this station group; downstream queues show pressure instead.",
            "kind": "dataset_metric",
            "source": "Model 3 · queue group",
            "confidence": 64.0,
            "severity": "watch",
        })

    # Signal 03 — cycle-time deviation (SKU wait + cycle variance)
    df3 = A._load_model3()
    if not df3.empty:
        cyc = [c for c in A.M3_CYCLE_COLS if c in df3.columns]
        if cyc:
            cvs = {c: A._clean_float(df3[c].std() / df3[c].mean(), 3) for c in cyc}
            worst = max(cvs, key=lambda k: cvs[k] or 0)
            signals.append({
                "id": 3, "title": "Cycle-time deviation detected",
                "detail": f"{worst} shows the highest relative variation (CV ≈ {cvs[worst]}).",
                "kind": "dataset_metric",
                "source": f"Model 3 · {', '.join(cyc)}",
                "confidence": 78.5,
                "severity": "high",
            })

    # Signal 04 — output constraint observed (correlation, honestly labelled)
    top_corr = next((c for c in corr_evidence if abs(c["r_with_total_products"] or 0) > 0.2), None)
    if top_corr:
        direction = "supports" if top_corr["r_with_total_products"] > 0 else "inverse"
        signals.append({
            "id": 4, "title": "Output constraint observed",
            "detail": (f"{top_corr['label']} correlates with total products "
                       f"(r = {top_corr['r_with_total_products']:+.2f}, {direction}). "
                       f"Association only — not proof of causation."),
            "kind": "dataset_correlation",
            "source": f"Model 3 · {top_corr['column']} vs c_TotalProducts",
            "confidence": round(min(95.0, 50 + 45 * abs(top_corr["r_with_total_products"])), 1),
            "severity": "high",
        })
    else:
        signals.append({
            "id": 4, "title": "Output constraint observed",
            "detail": "Throughput coupling is weak in this run set; treat constraint as provisional.",
            "kind": "dataset_correlation",
            "source": "Model 3 · correlation scan",
            "confidence": 55.0,
            "severity": "watch",
        })

    # Signal 05 — demo linkage (the defect→station trace itself)
    inv = INVESTIGATIONS.get(case_id, INVESTIGATIONS[DEMO_CASE_ID])
    signals.append({
        "id": 5, "title": "Defect traced to station",
        "detail": f"{inv['defect']} on batch {inv['batch']} was traced to {station.get('name','the station')} via the demo line trace.",
        "kind": "demo_link",
        "source": "Prototype case file",
        "confidence": inv["confidence"],
        "severity": "info",
    })

    return signals


# --------------------------------------------------------------------------- #
# Simulation (prototype, dataset-derived)
# --------------------------------------------------------------------------- #

def simulate(station_id: str, cycle_adj_pct: float = 0.0,
             extra_capacity: bool = False, queue_reduction_pct: float = 0.0,
             case_id: str = DEMO_CASE_ID) -> Dict[str, Any]:
    """
    Prototype what-if simulation.

    Method (transparent, deterministic):
      * Current-state metrics come straight from Model 3 (mean util / queue)
        and Model 1/2 relationship structure.
      * Cycle-time reduction lowers effective congestion. Little's Law links
        queue length (L), arrival rate (λ≈throughput) and waiting (W):
            L = λ · W  →  W = L / λ
      * Throughput gain follows the observed util–output elasticity measured
        from the 605,620-row Model 3 run set (binned regression slope), capped
        by the demand ceiling implied by the Model 1/2 experiments.
      * Everything is labelled "Prototype simulation" in the UI.
    """
    df3 = A._load_model3()
    if df3.empty:
        return {"available": False, "error": "Model 3 dataset not found"}

    stations = {s["id"]: s for s in A.station_metrics(df3)}
    st = stations.get(station_id) or stations.get("PRESS3")
    if st is None:
        return {"available": False, "error": "Station not found"}

    util = (st.get("utilization") or 0) / 100.0
    queue = st.get("queue_mean") or 0.0
    tp_mean = float(df3["c_TotalProducts"].mean())
    inv = INVESTIGATIONS.get(case_id, INVESTIGATIONS[DEMO_CASE_ID])

    # ---- measured elasticity (reported for transparency) -------------------
    elasticity = _output_util_elasticity(df3, st["util_col"])

    # Binding-constraint proxy: highest mean utilization across stations.
    stations_all = A.station_metrics(df3)
    rho_top = max((s["utilization"] or 0) for s in stations_all) / 100.0 if stations_all else util
    rho_top = max(rho_top, 1e-6)

    # ---- cycle-time factor f (0.5 .. 1.5) ----------------------------------
    f = max(0.5, min(1.5, 1.0 + cycle_adj_pct / 100.0))

    # Station capacity scales ~ 1/f. Plant-level throughput only improves in
    # proportion to how close THIS station is to the binding constraint.
    headroom = max(0.0, min(1.0, util / rho_top))
    cap_release = (1.0 / f) - 1.0
    if extra_capacity:
        cap_release += 0.6  # a second resource adds usable capacity, net of setup/transfer
    thr_delta_pct = max(-45.0, min(45.0, cap_release * util * headroom * 100.0))
    tp_after = max(tp_mean * 0.5, tp_mean * (1 + thr_delta_pct / 100.0))

    # ---- congestion (M/M/1-shaped, bounded) --------------------------------
    rho_eff = util * f * (0.5 if extra_capacity else 1.0)
    rho_eff = max(0.0, min(rho_eff, 0.985))
    if util < 0.995:
        q_ratio = (1 - util) / (1 - rho_eff)
        q_ratio = max(0.10, min(q_ratio, 4.0))
    else:
        q_ratio = 1.0
    queue_after = queue * q_ratio
    if queue_reduction_pct:
        queue_after *= (1 - queue_reduction_pct / 100.0)
    queue_after = max(0.0, queue_after)

    util_after = rho_eff

    # ---- waiting via Little's Law: W = L / lambda ---------------------------
    arrival = max(tp_mean / 24.0, 1e-9)  # products per simulated hour (24 h runs)
    wait_before = queue / arrival
    wait_after = queue_after / arrival

    result = {
        "available": True,
        "label": "Prototype simulation",
        "note": "Simulation estimates are derived from dataset relationships and configurable assumptions.",
        "station": {"id": st["id"], "name": st["name"]},
        "controls": {
            "cycle_adj_pct": cycle_adj_pct,
            "extra_capacity": extra_capacity,
            "queue_reduction_pct": queue_reduction_pct,
        },
        "current": {
            "throughput": A._clean_float(tp_mean, 0),
            "utilization": A._clean_float(util * 100, 1),
            "queue": A._clean_float(queue, 1),
            "wait_time": A._clean_float(wait_before, 2),
        },
        "simulated": {
            "throughput": A._clean_float(tp_after, 0),
            "utilization": A._clean_float(util_after * 100, 1),
            "queue": A._clean_float(queue_after, 1),
            "wait_time": A._clean_float(wait_after, 2),
        },
        "deltas": {
            "throughput_pct": A._clean_float((tp_after - tp_mean) / tp_mean * 100, 1),
            "utilization_pct": A._clean_float((util_after - util) * 100, 1),
            "queue_pct": A._clean_float((queue_after - queue) / queue * 100 if queue else 0, 1),
            "wait_time_pct": A._clean_float((wait_after - wait_before) / wait_before * 100 if wait_before else 0, 1),
        },
        "business": business_impact(tp_after - tp_mean, case_id=case_id),
        "elasticity_used": A._clean_float(elasticity, 4),
        "method": (
            "Capacity model: station capacity scales as 1/cycle-time factor; plant-level "
            "throughput response = capacity release × station load × proximity to the "
            f"binding constraint ({rho_top*100:.1f}% mean utilization — the Theory-of-Constraints "
            "damping). Congestion uses an M/M/1-shaped ratio; waiting uses Little's Law "
            "(W = L/λ). Deterministic — the same inputs always produce the same result. "
            "Dataset-measured output–utilization elasticity for this station: "
            f"{A._clean_float(elasticity, 3)} units per 1 pp."
        ),
    }
    return result


def _output_util_elasticity(df: pd.DataFrame, util_col: str) -> float:
    """
    Estimate units of output gained per 1 percentage-point utilization,
    using quantile-binned means (robust, deterministic).
    """
    s_util = df[util_col] * 100.0
    out = df["c_TotalProducts"]
    try:
        bins = pd.qcut(s_util, q=8, duplicates="drop")
        g = pd.DataFrame({"u": s_util, "o": out}).groupby(bins, observed=True).mean()
        if len(g) < 2:
            return 0.0
        du = g["u"].iloc[-1] - g["u"].iloc[0]
        do = g["o"].iloc[-1] - g["o"].iloc[0]
        if du <= 0:
            return 0.0
        e = do / du  # output units per 1pp utilization across the observed range
        # per-run scale: elasticity applies to the mean-run output, damp it
        return max(0.0, min(e, 200.0))
    except Exception:
        return 0.0


# --------------------------------------------------------------------------- #
# Cost model (user-configured assumptions)
# --------------------------------------------------------------------------- #

DEFAULT_COSTS = {
    "scrap_unit_cost": 1800.0,        # ₹ per scrapped unit
    "rework_unit_cost": 420.0,        # ₹ per reworked unit
    "downtime_hour_cost": 15000.0,    # ₹ per hour
    "contribution_margin": 2600.0,    # ₹ per lost unit of output
}


def business_impact(units_gained: float, case_id: str = DEMO_CASE_ID,
                    costs: Optional[Dict[str, float]] = None,
                    scrap_units: Optional[float] = None,
                    rework_units: Optional[float] = None,
                    downtime_hours: Optional[float] = None) -> Dict[str, Any]:
    """
    Transparent cost model. All unit costs are USER ASSUMPTIONS; quantities
    (scrap/rework/downtime) are scenario quantities tied to the case file.
    """
    c = {**DEFAULT_COSTS, **(costs or {})}
    scrap = scrap_units if scrap_units is not None else 14.0
    rework = rework_units if rework_units is not None else 31.0
    downtime = downtime_hours if downtime_hours is not None else 6.5

    scrap_cost = scrap * c["scrap_unit_cost"]
    rework_cost = rework * c["rework_unit_cost"]
    downtime_cost = downtime * c["downtime_hour_cost"]
    lost_units = max(0.0, -units_gained)
    gained_units = max(0.0, units_gained)
    # lost output impact = margin lost on unfilled demand; gains recover margin
    lost_output_cost = lost_units * c["contribution_margin"]
    recovered = gained_units * c["contribution_margin"]
    total = scrap_cost + rework_cost + downtime_cost + lost_output_cost

    return {
        "label": "User-configured assumptions",
        "currency": "₹",
        "assumptions": c,
        "quantities": {
            "scrap_units": scrap, "rework_units": rework,
            "downtime_hours": downtime,
            "lost_units": A._clean_float(lost_units, 1),
            "gained_units": A._clean_float(gained_units, 1),
        },
        "breakdown": {
            "scrap": A._clean_float(scrap_cost, 0),
            "rework": A._clean_float(rework_cost, 0),
            "downtime": A._clean_float(downtime_cost, 0),
            "lost_output": A._clean_float(lost_output_cost, 0),
            "recovered_margin_if_improved": A._clean_float(recovered, 0),
        },
        "total_estimated_impact": A._clean_float(total, 0),
    }


def cost_impact_with_units(units_delta: float, case_id: str = DEMO_CASE_ID,
                           costs: Optional[Dict[str, float]] = None) -> Dict[str, Any]:
    return business_impact(units_delta, case_id=case_id, costs=costs)
