"""
ForgeSite — what-if simulation + predictive model.

SIMULATION: transparent, deterministic scenario analysis derived from Model 3
relationships (no fabricated outcomes — results labelled PROJECTED).

PREDICTIVE MODEL: if the MAT workbook provides a legitimate predictor/response
structure we train a real model (GradientBoosting) and report honest validation
metrics. Otherwise we report that the predictive path is unavailable.
"""

from __future__ import annotations

from typing import Any, Dict, Optional

import numpy as np
import pandas as pd

import analytics as AN
import data_engine as DE


def _num(x: Any, nd: int = 4) -> Optional[float]:
    try:
        v = float(x)
    except (TypeError, ValueError):
        return None
    if not np.isfinite(v):
        return None
    return round(v, nd)


# --------------------------------------------------------------------------- #
# What-if scenario engine
# --------------------------------------------------------------------------- #

SIMULABLE_STATIONS = [st["id"] for st in DE.STATIONS]


def what_if(station_id: str = "PRESS3", cycle_adj_pct: float = 0.0,
            capacity_add: float = 0.0, queue_reduction_pct: float = 0.0,
            demand_adj_pct: float = 0.0) -> Dict[str, Any]:
    """
    Deterministic scenario projection.

    Mechanics (all disclosed in the response):
      * Station capacity scales as 1/cycle_factor, plus fractional capacity add.
      * Plant throughput response = capacity release × station load × proximity
        to the binding constraint (Theory-of-Constraints damping).
      * Congestion (queue) changes follow an M/M/1-shaped ratio.
      * Waiting follows Little's Law: W = L / λ, λ scaled by demand scenario.
    """
    df = DE.model3()
    if df.empty:
        return {"available": False}
    st = next((s for s in DE.STATIONS if s["id"] == station_id), None)
    if st is None:
        return {"available": False, "reason": "Unknown station."}

    util_col = st["util"]
    util = float(df[util_col].mean())
    qcols = DE.station_queues(st)
    queue = float(pd.concat([df[q] for q in qcols], axis=1).sum(axis=1).mean()) if qcols else 0.0
    tp_mean = float(df["c_TotalProducts"].mean())

    # binding constraint = max mean utilization across stations
    all_utils = [float(df[s["util"]].mean()) for s in DE.STATIONS if s["util"] in df.columns]
    rho_top = max(all_utils)

    f = max(0.5, min(1.5, 1.0 + cycle_adj_pct / 100.0))
    cap = max(0.0, min(1.0, capacity_add / 100.0))
    headroom = max(0.0, min(1.0, util / rho_top))

    cap_release = ((1.0 / f) - 1.0) + cap
    thr_delta_pct = max(-45.0, min(45.0, cap_release * util * headroom * 100.0))
    demand_factor = 1.0 + demand_adj_pct / 100.0
    # demand up with fixed capacity reduces realized throughput gain
    tp_delta_pct = thr_delta_pct / demand_factor
    tp_after = tp_mean * (1 + tp_delta_pct / 100.0)

    # congestion
    rho_eff = min(0.985, max(0.0, util * f * (1 - cap)))
    if util < 0.995:
        q_ratio = max(0.10, min(4.0, (1 - util) / (1 - rho_eff)))
    else:
        q_ratio = 1.0
    queue_after = queue * q_ratio * (1 - max(0.0, min(90.0, queue_reduction_pct)) / 100.0)
    queue_after = max(0.0, queue_after * (1 + (demand_factor - 1) * 0.8))

    util_after = rho_eff * 100
    arrival = tp_mean / 24.0
    wait_before = queue / arrival
    wait_after = queue_after / max(arrival * demand_factor, 1e-9)

    # cycle time (cell-indexed if available)
    cyc = None
    if station_id.startswith("CELL"):
        cyc_col = f"c_Cycle{station_id[-1]}"
        if cyc_col in df.columns:
            cyc = {"col": cyc_col, "before": _num(float(df[cyc_col].mean()), 0),
                   "after": _num(float(df[cyc_col].mean()) * f / (1 + cap), 0)}

    return {
        "available": True,
        "label": "PROJECTED — analytical scenario, not a measured result",
        "station": {"id": st["id"], "name": st["name"]},
        "controls": {"cycle_adj_pct": cycle_adj_pct, "capacity_add_pct": capacity_add,
                     "queue_reduction_pct": queue_reduction_pct, "demand_adj_pct": demand_adj_pct},
        "baseline": {
            "throughput": _num(tp_mean, 0), "utilization": _num(util * 100, 1),
            "queue": _num(queue, 1), "wait_min": _num(wait_before * 60, 1),
        },
        "projected": {
            "throughput": _num(tp_after, 0), "utilization": _num(util_after, 1),
            "queue": _num(queue_after, 1), "wait_min": _num(wait_after * 60, 1),
        },
        "deltas": {
            "throughput_pct": _num((tp_after - tp_mean) / tp_mean * 100, 1),
            "utilization_pp": _num(util_after - util * 100, 1),
            "queue_pct": _num((queue_after - queue) / queue * 100 if queue else 0, 1),
            "wait_pct": _num((wait_after - wait_before) / wait_before * 100 if wait_before else 0, 1),
        },
        "cycle": cyc,
        "method": (
            "Capacity model: station capacity scales as 1/cycle-time factor (+ fractional capacity add). "
            f"Plant throughput response = capacity release × station load ({util*100:.0f}%) × proximity to the "
            f"binding constraint ({rho_top*100:.0f}% — Theory-of-Constraints damping). Congestion follows an "
            "M/M/1-shaped ratio; waiting uses Little's Law (W = L/λ). Deterministic: identical inputs "
            "always produce identical outputs."
        ),
    }


# --------------------------------------------------------------------------- #
# Predictive model — trained & evaluated on the real MAT experiment data
# --------------------------------------------------------------------------- #

_MODEL_CACHE: Dict[str, Any] = {}


def predictive_status() -> Dict[str, Any]:
    _train_predictive()
    m = _MODEL_CACHE.get("model")
    if m is None:
        return {"available": False,
                "reason": "No valid predictor→response structure could be trained from the provided data."}
    return {"available": True, **m["meta"]}


def _train_predictive() -> None:
    if "model" in _MODEL_CACHE:
        return
    import scipy.io as sio

    p = DE.DATA_DIR / "3000Samplesv3.mat"
    if not p.exists():
        _MODEL_CACHE["model"] = None
        _MODEL_CACHE["reason"] = "MAT workbook not found."
        return
    try:
        mat = sio.loadmat(str(p))
        # Model 3 event-level data: 4 SKU-arrival predictors → 8 cell/SKU production
        # responses over 605,620 events (aligned arrays from the same simulation).
        X = mat.get("Predictors")
        Y = mat.get("Responses")
        names_x = ["SKU1 arrivals", "SKU2 arrivals", "SKU3 arrivals", "SKU4 arrivals"]
        names_y = ["Cell1·SKU1", "Cell1·SKU2", "Cell2·SKU1", "Cell2·SKU2",
                   "Cell3·SKU1", "Cell3·SKU2", "Cell4·SKU1", "Cell4·SKU2"]
        if X is None or Y is None or X.shape[0] != Y.shape[0] or Y.shape[1] < 1:
            _MODEL_CACHE["model"] = None
            return
        # subsample for training speed (deterministic), keep a stratified-like spread
        rng = np.random.default_rng(42)
        n = X.shape[0]
        idx = np.sort(rng.choice(n, size=min(60_000, n), replace=False))
        Xs, Ys = X[idx].astype(float), Y[idx].astype(float)
        from sklearn.ensemble import GradientBoostingRegressor
        from sklearn.model_selection import train_test_split
        from sklearn.metrics import r2_score, mean_absolute_error

        Xtr, Xte, Ytr, Yte = train_test_split(Xs, Ys, test_size=0.2, random_state=42)
        models, metrics = [], []
        for k in range(Ys.shape[1]):
            g = GradientBoostingRegressor(random_state=42)
            g.fit(Xtr, Ytr[:, k])
            pred = g.predict(Xte)
            metrics.append({
                "target": names_y[k] if k < len(names_y) else f"response_{k+1}",
                "r2_test": _num(r2_score(Yte[:, k], pred), 3),
                "mae_test": _num(mean_absolute_error(Yte[:, k], pred), 1),
            })
            models.append(g)
        avg_r2 = _num(float(np.mean([m["r2_test"] for m in metrics])), 3)
        _MODEL_CACHE["model"] = {
            "meta": {
                "type": "GradientBoostingRegressor (scikit-learn)",
                "trained_on": "3000Samplesv3.mat · Model 3 event-level set (605,620 events; 60k training subsample)",
                "predictors": names_x,
                "n_predictors": int(X.shape[1]),
                "n_targets": int(Y.shape[1]),
                "n_samples": int(X.shape[0]),
                "validation": "80/20 train-test split, fixed seed 42",
                "metrics": metrics,
                "mean_r2_test": avg_r2,
                "label": "PREDICTED — validated on held-out test split",
            },
            "models": models,
            "names_y": names_y,
        }
    except Exception as e:
        _MODEL_CACHE["model"] = None
        _MODEL_CACHE["reason"] = str(e)


def predict_sku_production(arrivals: Dict[str, float]) -> Dict[str, Any]:
    """PREDICTED cell/SKU production from SKU arrival inputs (validated model)."""
    _train_predictive()
    m = _MODEL_CACHE.get("model")
    if m is None:
        return {"available": False,
                "reason": _MODEL_CACHE.get("reason", "Predictive model unavailable.")}
    x = np.array([[float(arrivals.get(f"SKU{i}", 0)) for i in range(1, 5)]])
    preds = {name: _num(float(mdl.predict(x)[0]), 0)
             for name, mdl in zip(m["names_y"], m["models"])}
    return {"available": True, "label": m["meta"]["label"], "inputs": arrivals,
            "predictions": preds, "model": m["meta"]["type"],
            "validation": m["meta"]["validation"], "mean_r2_test": m["meta"]["mean_r2_test"]}


# --------------------------------------------------------------------------- #
# Operational impact (no financial data in dataset — honest operational view)
# --------------------------------------------------------------------------- #

def operational_impact(cycle_adj_pct: float = -10.0, station_id: str = "PRESS3",
                       cost_per_unit: Optional[float] = None,
                       downtime_cost_hour: Optional[float] = None) -> Dict[str, Any]:
    sim = what_if(station_id, cycle_adj_pct=cycle_adj_pct)
    if not sim.get("available"):
        return sim
    d_tp = sim["projected"]["throughput"] - sim["baseline"]["throughput"]
    d_q = sim["projected"]["queue"] - sim["baseline"]["queue"]
    d_w = sim["projected"]["wait_min"] - sim["baseline"]["wait_min"]
    d_u = sim["projected"]["utilization"] - sim["baseline"]["utilization"]

    econ = None
    if cost_per_unit and downtime_cost_hour:
        # user-defined economic estimate — clearly labelled
        econ = {
            "label": "USER-DEFINED ECONOMIC ESTIMATE",
            "recovered_margin_per_run": _num(d_tp * cost_per_unit, 0),
            "assumptions": {"cost_per_unit": cost_per_unit, "downtime_cost_hour": downtime_cost_hour},
        }
    return {
        "available": True,
        "label": "DERIVED from dataset relationships",
        "station": sim["station"],
        "scenario_pct": cycle_adj_pct,
        "production_impact": {"throughput_delta": _num(d_tp, 0), "pct": sim["deltas"]["throughput_pct"]},
        "queue_impact": {"delta": _num(d_q, 1), "pct": sim["deltas"]["queue_pct"]},
        "waiting_impact": {"delta_min": _num(d_w, 1), "pct": sim["deltas"]["wait_pct"]},
        "utilization_impact": {"delta_pp": _num(d_u, 1)},
        "economic": econ,
        "note": ("The dataset contains no financial fields; operational deltas are derived, "
                 "economic figures (if shown) are user-defined estimates."),
    }
