"""
Factory Detective — analytics core.

Loads the supplied discrete-event simulation datasets (Model 1, Model 2,
Model 3 CSVs + the 3000Samplesv3.mat predictor/response workbook), computes
descriptive statistics, correlations, utilization / queue indicators and
bottleneck candidates, and exposes everything as JSON-ready structures.

Data honesty:
  * Every number served by this module is DERIVED FROM THE SUPPLIED DATASET.
  * The bottleneck score is a transparent, configurable heuristic labelled
    "Prototype Bottleneck Score" in the UI — not a validated metric.
  * No model accuracy / precision / recall figures are invented anywhere.
"""

from __future__ import annotations

import json
import os
import time
from functools import lru_cache
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
import pandas as pd

# --------------------------------------------------------------------------- #
# Paths
# --------------------------------------------------------------------------- #

BACKEND_DIR = Path(__file__).resolve().parent

# project root = backend/..  (i.e. factory-detective/)
PROJECT_ROOT = BACKEND_DIR.parent

# candidate dataset locations, relative to the project root
_DATASET_DIR_CANDIDATES = [
    os.environ.get("DATA_DIR", ""),
    PROJECT_ROOT / "data",
    PROJECT_ROOT
    / "Manufacturing Data Shared Facility - Discrete-Event Simulation (1)"
    / "Manufacturing Data Shared Facility - Discrete-Event Simulation",
]


def dataset_dir() -> Path:
    """Resolve the dataset folder (first existing candidate wins)."""
    for cand in _DATASET_DIR_CANDIDATES:
        if not cand:
            continue
        p = Path(cand)
        if p.exists():
            return p
    return PROJECT_ROOT  # will simply yield "no datasets found"


# --------------------------------------------------------------------------- #
# Small helpers
# --------------------------------------------------------------------------- #

def _clean_float(x: Any, nd: int = 4) -> Optional[float]:
    """NaN-safe float for JSON."""
    try:
        v = float(x)
    except (TypeError, ValueError):
        return None
    if not np.isfinite(v):
        return None
    return round(v, nd)


def _safe_corr(a: pd.Series, b: pd.Series) -> Optional[float]:
    """Pearson r that returns None instead of NaN when variance is zero."""
    try:
        if a.nunique() < 2 or b.nunique() < 2:
            return None
        r = a.corr(b)
        if r is None or not np.isfinite(r):
            return None
        return float(r)
    except Exception:
        return None


def _percentile(x: float, arr: np.ndarray) -> float:
    """Percentile rank of x within arr (0-100)."""
    if arr.size == 0:
        return 0.0
    return float(np.mean(arr <= x) * 100.0)


# --------------------------------------------------------------------------- #
# Column groups for Model 3 (station registry)
# --------------------------------------------------------------------------- #

STATIONS: List[Dict[str, Any]] = [
    # id, display name, util column, queue column, group, zone
    {"id": "BLANKING",  "name": "Blanking",     "util": "Blanking_Util", "queue": "Blanking_Queue",       "group": "Blanking",        "zone": "fabrication"},
    {"id": "PRESS1",    "name": "Press 1",      "util": "Press1_Util",   "queue": "Press1_Queue",         "group": "Presses",         "zone": "fabrication"},
    {"id": "PRESS2",    "name": "Press 2",      "util": "Press2_Util",   "queue": "Press2_Queue",         "group": "Presses",         "zone": "fabrication"},
    {"id": "PRESS3",    "name": "Press 3",      "util": "Press3_Util",   "queue": "Press3_Queue",         "group": "Presses",         "zone": "fabrication"},
    {"id": "PRESS4",    "name": "Press 4",      "util": "Press4_Util",   "queue": "Press4_Queue",         "group": "Presses",         "zone": "fabrication"},
    {"id": "CELL1",     "name": "Assembly Cell 1", "util": "Cell1_Util", "queue": None,                   "group": "Assembly Cells",  "zone": "assembly"},
    {"id": "CELL2",     "name": "Assembly Cell 2", "util": "Cell2_Util", "queue": None,                   "group": "Assembly Cells",  "zone": "assembly"},
    {"id": "CELL3",     "name": "Assembly Cell 3", "util": "Cell3_Util", "queue": None,                   "group": "Assembly Cells",  "zone": "assembly"},
    {"id": "CELL4",     "name": "Assembly Cell 4", "util": "Cell4_Util", "queue": None,                   "group": "Assembly Cells",  "zone": "assembly"},
    {"id": "PAINT1",    "name": "Paint 1",      "util": "Paint1_Util",   "queue": None,                   "group": "Paint & Quality", "zone": "finishing"},
    {"id": "PAINT2",    "name": "Paint 2",      "util": "Paint2_Util",   "queue": None,                   "group": "Paint & Quality", "zone": "finishing"},
    {"id": "QUALITY",   "name": "Quality",      "util": "Quality_Util",  "queue": "Quality_Queue",        "group": "Paint & Quality", "zone": "finishing"},
    {"id": "FORKLIFT",  "name": "Forklift Fleet", "util": "Forklift_Util", "queue": None,                 "group": "Material Handling", "zone": "logistics"},
]

# queue-like columns that DO carry signal in Model 3
M3_QUEUE_COLS = [
    "Blanking_Queue", "Press1_Queue", "Press2_Queue", "Press3_Queue",
    "Press4_Queue", "Quality_Queue", "Warehouse1_Queue", "Warehouse_3_Queue",
    "Warehouse_4_Queue", "Forklift_Blanking_Queue", "Forklift_Press_Queue",
    "Forklift_Assembly_Queue",
]

M3_UTIL_COLS = [s["util"] for s in STATIONS]

M3_CYCLE_COLS = ["c_Cycle1", "c_Cycle2", "c_Cycle3", "c_Cycle4"]

M3_SKU_TIME_GROUPS = ["VA_Time", "NVA_Time", "Transport_Time", "Wait_Time", "Other_Time"]


# --------------------------------------------------------------------------- #
# Loading
# --------------------------------------------------------------------------- #

@lru_cache(maxsize=1)
def _load_model1() -> pd.DataFrame:
    p = dataset_dir() / "Model 1" / "Model_1.csv"
    if not p.exists():
        return pd.DataFrame()
    df = pd.read_csv(p)
    df = df.dropna(axis=1, how="all").dropna(axis=0, how="all")
    return df


@lru_cache(maxsize=1)
def _load_model2() -> pd.DataFrame:
    p = dataset_dir() / "Model 2" / "Model_2.csv"
    if not p.exists():
        return pd.DataFrame()
    df = pd.read_csv(p)
    df = df.dropna(axis=1, how="all").dropna(axis=0, how="all")
    return df


@lru_cache(maxsize=1)
def _load_model3() -> pd.DataFrame:
    p = dataset_dir() / "Model 3" / "Model_3.csv"
    if not p.exists():
        return pd.DataFrame()
    # 605k x 78 — a fast read; only needed columns get touched downstream
    df = pd.read_csv(p)
    return df


@lru_cache(maxsize=1)
def _load_mat() -> Dict[str, Any]:
    """Load the 3000-sample predictor/response workbook (via scipy)."""
    p = dataset_dir() / "3000Samplesv3.mat"
    out: Dict[str, Any] = {"available": False}
    if not p.exists():
        return out
    try:
        import scipy.io as sio

        m = sio.loadmat(str(p))
        out = {"available": True, "arrays": {}}
        for k, v in m.items():
            if k.startswith("__"):
                continue
            if isinstance(v, np.ndarray) and v.dtype.kind in "iuf":
                out["arrays"][k] = {
                    "shape": list(v.shape),
                    "dtype": str(v.dtype),
                    "sample": v.ravel()[:6].astype(float).tolist(),
                }
    except Exception as e:  # pragma: no cover
        out = {"available": False, "error": str(e)}
    return out


def datasets_status() -> List[Dict[str, Any]]:
    base = dataset_dir()
    m1 = base / "Model 1" / "Model_1.csv"
    m2 = base / "Model 2" / "Model_2.csv"
    m3 = base / "Model 3" / "Model_3.csv"
    mat = base / "3000Samplesv3.mat"
    return [
        {"id": "model1", "name": "Model 1 — Drilling / Milling / Assembly line",
         "file": "Model 1/Model_1.csv", "available": m1.exists(),
         "size_bytes": m1.stat().st_size if m1.exists() else None},
        {"id": "model2", "name": "Model 2 — Two-part assembly line",
         "file": "Model 2/Model_2.csv", "available": m2.exists(),
         "size_bytes": m2.stat().st_size if m2.exists() else None},
        {"id": "model3", "name": "Model 3 — Full plant (Blanking→Press→Cells→Paint→Quality→Warehouse)",
         "file": "Model 3/Model_3.csv", "available": m3.exists(),
         "size_bytes": m3.stat().st_size if m3.exists() else None},
        {"id": "mat", "name": "3000-sample predictor / response workbook",
         "file": "3000Samplesv3.mat", "available": mat.exists(),
         "size_bytes": mat.stat().st_size if mat.exists() else None},
    ]


# --------------------------------------------------------------------------- #
# Generic dataframe -> JSON helpers
# --------------------------------------------------------------------------- #

def _series_stats(s: pd.Series) -> Dict[str, Any]:
    num = pd.to_numeric(s, errors="coerce").dropna()
    if num.empty:
        return {"mean": None, "std": None, "min": None, "p05": None, "median": None,
                "p95": None, "max": None}
    q = num.quantile([0.05, 0.5, 0.95])
    return {
        "mean": _clean_float(num.mean()),
        "std": _clean_float(num.std()),
        "min": _clean_float(num.min()),
        "p05": _clean_float(q.loc[0.05]),
        "median": _clean_float(q.loc[0.5]),
        "p95": _clean_float(q.loc[0.95]),
        "max": _clean_float(num.max()),
        "count": int(num.count()),
    }


def _histogram(s: pd.Series, bins: int = 24) -> List[Dict[str, float]]:
    num = pd.to_numeric(s, errors="coerce").dropna()
    if num.empty:
        return []
    counts, edges = np.histogram(num, bins=bins)
    return [
        {"bin": round(float((edges[i] + edges[i + 1]) / 2), 4),
         "count": int(counts[i])}
        for i in range(len(counts))
    ]


# --------------------------------------------------------------------------- #
# Model summaries
# --------------------------------------------------------------------------- #

def model_summary(model_id: int) -> Dict[str, Any]:
    if model_id == 1:
        return _summary_model1()
    if model_id == 2:
        return _summary_model2()
    if model_id == 3:
        return _summary_model3()
    raise ValueError(f"unknown model {model_id}")


def _summary_model1() -> Dict[str, Any]:
    df = _load_model1()
    if df.empty:
        return {"model": 1, "available": False}
    stats = {c: _series_stats(df[c]) for c in df.columns}
    hist = {c: _histogram(df[c], 20) for c in
            ["Demand", "Parts per hour", "Assembly Waiting Time", "Drilling Util"] if c in df}
    return {
        "model": 1,
        "available": True,
        "rows": int(len(df)),
        "features": list(df.columns),
        "stats": stats,
        "histograms": hist,
        "kpi": {
            "throughput_pph_mean": _clean_float(df["Parts per hour"].mean(), 1),
            "drilling_util_mean": _clean_float(df["Drilling Util"].mean() * 100, 1),
            "milling_util_mean": _clean_float(df["Milling Util"].mean() * 100, 1),
            "assembly_util_mean": _clean_float(df["Assembly Util"].mean() * 100, 1),
            "assembly_wait_mean": _clean_float(df["Assembly Waiting Time"].mean(), 2),
            "va_time_mean": _clean_float(df["VA Time"].mean(), 3),
            "demand_mean": _clean_float(df["Demand"].mean(), 1),
        },
    }


def _summary_model2() -> Dict[str, Any]:
    df = _load_model2()
    if df.empty:
        return {"model": 2, "available": False}
    stats = {c: _series_stats(df[c]) for c in df.columns}
    hist = {c: _histogram(df[c], 20) for c in
            ["Demand", "Entities Out", "Assembly Utilization", "Drilling Utilization",
             "Part 1 Stored"] if c in df}
    return {
        "model": 2,
        "available": True,
        "rows": int(len(df)),
        "features": list(df.columns),
        "stats": stats,
        "histograms": hist,
        "kpi": {
            "entities_out_mean": _clean_float(df["Entities Out"].mean(), 0),
            "drilling_util_mean": _clean_float(df["Drilling Utilization"].mean() * 100, 1),
            "milling_util_mean": _clean_float(df["Milling Utilization"].mean() * 100, 1),
            "assembly_util_mean": _clean_float(df["Assembly Utilization"].mean() * 100, 1),
            "drilling_queue_mean": _clean_float(df["Drilling Queue Time"].mean(), 2),
            "assembly_queue_mean": _clean_float(df["Assembly Queue Time"].mean(), 2),
            "part1_stored_mean": _clean_float(df["Part 1 Stored"].mean(), 0),
            "demand_mean": _clean_float(df["Demand"].mean(), 1),
        },
    }


def _summary_model3() -> Dict[str, Any]:
    df = _load_model3()
    if df.empty:
        return {"model": 3, "available": False}

    stations = station_metrics(df)
    out_mean = _clean_float(df["c_TotalProducts"].mean(), 0)

    # group features by prefix family for the Dataset Explorer
    groups: Dict[str, List[str]] = {
        "Utilization": M3_UTIL_COLS,
        "Queues": M3_QUEUE_COLS,
        "Cycle Times": M3_CYCLE_COLS,
        "SKU Production Counters": [c for c in df.columns if c.startswith("c_Cell") or c.startswith("c_Cell")],
        "SKU Time Accounting": [f"SKU{s}_{g}" for s in range(1, 5) for g in M3_SKU_TIME_GROUPS],
        "Output": ["c_TotalProducts", "Time_Now"],
    }

    return {
        "model": 3,
        "available": True,
        "rows": int(len(df)),
        "features": list(df.columns),
        "n_features": len(df.columns),
        "groups": groups,
        "stations": stations,
        "kpi": {
            "total_products_mean": out_mean,
            "blanking_util_mean": _clean_float(df["Blanking_Util"].mean() * 100, 1),
            "cell1_util_mean": _clean_float(df["Cell1_Util"].mean() * 100, 1),
            "cell4_util_mean": _clean_float(df["Cell4_Util"].mean() * 100, 1),
            "quality_util_mean": _clean_float(df["Quality_Util"].mean() * 100, 1),
            "warehouse1_queue_mean": _clean_float(df["Warehouse1_Queue"].mean(), 1),
            "quality_queue_mean": _clean_float(df["Quality_Queue"].mean(), 1),
            "blanking_queue_mean": _clean_float(df["Blanking_Queue"].mean(), 1),
            "sku1_wait_mean": _clean_float(df["SKU1_Wait_Time"].mean(), 2),
            "sku1_transport_mean": _clean_float(df["SKU1_Transport_Time"].mean(), 3),
        },
    }


# --------------------------------------------------------------------------- #
# Station metrics + bottleneck scoring (Model 3)
# --------------------------------------------------------------------------- #

def station_metrics(df: Optional[pd.DataFrame] = None) -> List[Dict[str, Any]]:
    """Per-station utilization / queue / status derived from Model 3 data."""
    if df is None:
        df = _load_model3()
    if df.empty:
        return []

    result: List[Dict[str, Any]] = []
    for st in STATIONS:
        util_col = st["util"]
        if util_col not in df.columns:
            continue
        util_s = pd.to_numeric(df[util_col], errors="coerce").dropna()
        util_mean = float(util_s.mean()) if not util_s.empty else None
        util_p95 = float(util_s.quantile(0.95)) if not util_s.empty else None

        queue_col = st["queue"]
        q_mean = q_p95 = q_max = None
        queue_hist: List[Dict[str, float]] = []
        if queue_col and queue_col in df.columns:
            qs = pd.to_numeric(df[queue_col], errors="coerce").dropna()
            if not qs.empty and qs.std() > 1e-9:
                q_mean = float(qs.mean())
                q_p95 = float(qs.quantile(0.95))
                q_max = float(qs.max())
                queue_hist = _histogram(qs, 18)

        result.append({
            "id": st["id"],
            "name": st["name"],
            "group": st["group"],
            "zone": st["zone"],
            "util_col": util_col,
            "queue_col": queue_col,
            "utilization": _clean_float(util_mean * 100 if util_mean is not None else None, 1),
            "utilization_p95": _clean_float(util_p95 * 100 if util_p95 is not None else None, 1),
            "queue_mean": _clean_float(q_mean, 1),
            "queue_p95": _clean_float(q_p95, 1),
            "queue_max": _clean_float(q_max, 1),
            "queue_hist": queue_hist,
            "util_hist": _histogram(util_s, 18),
        })
    return result


def _bottleneck_scores(df: pd.DataFrame, weights: Dict[str, float]) -> List[Dict[str, Any]]:
    """
    Prototype Bottleneck Score =
        w_u * norm(utilization) + w_q * norm(queue) + w_w * norm(wait)
    All three components come from Model 3 data; waits use per-SKU wait-time
    means as a plant-wide pressure proxy for stations without a direct queue.
    """
    stations = station_metrics(df)
    utils = np.array([s["utilization"] or 0 for s in stations], dtype=float)
    queues = np.array([s["queue_mean"] or 0 for s in stations], dtype=float)

    # wait proxy: mean of SKU wait times, plus queue p95 where available
    waits = np.array(
        [(s["queue_p95"] or 0) + (s["queue_mean"] or 0) * 0.5 for s in stations],
        dtype=float,
    )

    def _norm(arr: np.ndarray) -> np.ndarray:
        mx = arr.max()
        return arr / mx if mx > 0 else arr * 0

    nu, nq, nw = _norm(utils), _norm(queues), _norm(waits)
    wu = weights.get("utilization", 0.5)
    wq = weights.get("queue", 0.3)
    ww = weights.get("wait", 0.2)
    total = (wu + wq + ww) or 1.0

    scores = (wu * nu + wq * nq + ww * nw) / total * 100

    out = []
    for i, s in enumerate(stations):
        out.append({
            **s,
            "bottleneck_score": _clean_float(scores[i], 1),
            "components": {
                "utilization_norm": _clean_float(nu[i], 3),
                "queue_norm": _clean_float(nq[i], 3),
                "wait_norm": _clean_float(nw[i], 3),
            },
        })
    out.sort(key=lambda x: x["bottleneck_score"], reverse=True)
    return out


DEFAULT_WEIGHTS = {"utilization": 0.5, "queue": 0.3, "wait": 0.2}


def bottlenecks(weights: Optional[Dict[str, float]] = None) -> Dict[str, Any]:
    df = _load_model3()
    if df.empty:
        return {"available": False, "stations": []}
    w = {**DEFAULT_WEIGHTS, **(weights or {})}
    ranked = _bottleneck_scores(df, w)
    return {
        "available": True,
        "weights": w,
        "label": "Prototype Bottleneck Score",
        "stations": ranked,
        "top": ranked[0] if ranked else None,
    }


# --------------------------------------------------------------------------- #
# Correlations
# --------------------------------------------------------------------------- #

def _correlation_pairs(df: pd.DataFrame, pairs: List[Tuple[str, str]]) -> List[Dict[str, Any]]:
    out = []
    for a, b in pairs:
        if a in df.columns and b in df.columns:
            r = _safe_corr(df[a], df[b])
            if r is not None:
                out.append({"a": a, "b": b, "r": _clean_float(r, 3),
                            "abs_r": _clean_float(abs(r), 3)})
    out.sort(key=lambda x: x["abs_r"], reverse=True)
    return out


def correlations(model_id: int) -> Dict[str, Any]:
    if model_id == 1:
        df = _load_model1()
        if df.empty:
            return {"available": False}
        pairs = [
            ("Demand", "Parts per hour"),
            ("Demand", "Drilling Waiting Time"),
            ("Demand", "Assembly Waiting Time"),
            ("Demand", "Assembly Util"),
            ("Demand", "Drilling Util"),
            ("Parts per hour", "Assembly Util"),
            ("Parts per hour", "Drilling Util"),
            ("Parts per hour", "Milling Util"),
            ("Drilling Util", "Assembly Util"),
            ("Drilling Waiting Time", "Assembly Waiting Time"),
            ("Drilling Util", "Drilling Waiting Time"),
            ("Total parts", "Assembly Waiting Time"),
        ]
        return {"available": True, "model": 1, "pairs": _correlation_pairs(df, pairs)}

    if model_id == 2:
        df = _load_model2()
        if df.empty:
            return {"available": False}
        pairs = [
            ("Demand", "Entities Out"),
            ("Demand", "Assembly Utilization"),
            ("Demand", "Assembly Queue Time"),
            ("Demand", "Drilling Queue Time"),
            ("Demand", "Milling Queue Time"),
            ("Demand", "Part 1 Stored"),
            ("Demand", "Part 2 Stored"),
            ("Drilling Queue Time", "Assembly Queue Time"),
            ("Drilling Utilization", "Assembly Utilization"),
            ("Part 1 Storage Time", "Drilling Queue Time"),
            ("Entities Out", "Assembly Utilization"),
        ]
        return {"available": True, "model": 2, "pairs": _correlation_pairs(df, pairs)}

    if model_id == 3:
        df = _load_model3()
        if df.empty:
            return {"available": False}
        tp = "c_TotalProducts"
        targets = ["Blanking_Util", "Cell1_Util", "Cell2_Util", "Cell4_Util",
                   "Paint1_Util", "Paint2_Util", "Quality_Util", "Forklift_Util",
                   "Quality_Queue", "Blanking_Queue", "Warehouse1_Queue",
                   "Press1_Queue", "Forklift_Assembly_Queue"]
        pairs = [(t, tp) for t in targets]
        pairs += [
            ("Quality_Queue", "Cell1_Util"),
            ("Blanking_Queue", "Blanking_Util"),
            ("Warehouse1_Queue", "Quality_Util"),
            ("SKU1_Wait_Time", "Quality_Queue"),
            ("SKU4_Wait_Time", "Cell4_Util"),
        ]
        return {"available": True, "model": 3, "pairs": _correlation_pairs(df, pairs)}

    raise ValueError(f"unknown model {model_id}")


def scatter(model_id: int, x: str, y: str, max_points: int = 1500) -> Dict[str, Any]:
    """Downsampled scatter for the explorer / investigate pages."""
    dfs = {1: _load_model1, 2: _load_model2, 3: _load_model3}
    loader = dfs.get(model_id)
    if loader is None:
        raise ValueError(f"unknown model {model_id}")
    df = loader()
    if df.empty or x not in df.columns or y not in df.columns:
        return {"available": False, "points": []}
    sub = df[[x, y]].dropna()
    if len(sub) > max_points:
        sub = sub.sample(max_points, random_state=42)
    return {
        "available": True,
        "x": x, "y": y,
        "r": _safe_corr(df[x], df[y]),
        "points": [
            {"x": _clean_float(rx, 3), "y": _clean_float(ry, 3)}
            for rx, ry in zip(sub[x], sub[y])
        ],
    }


def feature_table(model_id: int, search: str = "", group: str = "",
                  page: int = 1, page_size: int = 25) -> Dict[str, Any]:
    """Feature catalogue with stats + optional search (Dataset Explorer)."""
    loaders = {1: _load_model1, 2: _load_model2, 3: _load_model3}
    loader = loaders.get(model_id)
    if loader is None:
        raise ValueError(f"unknown model {model_id}")
    df = loader()
    if df.empty:
        return {"available": False, "items": []}

    cols = list(df.columns)
    if search:
        q = search.lower()
        cols = [c for c in cols if q in c.lower()]

    items = [{"name": c, "stats": _series_stats(df[c])} for c in cols]

    total = len(items)
    start = (max(page, 1) - 1) * page_size
    return {
        "available": True,
        "total": total,
        "page": page,
        "page_size": page_size,
        "items": items[start:start + page_size],
    }
