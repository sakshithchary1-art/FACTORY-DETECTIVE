"""
ForgeSite — data engine.

Loads the real supplied datasets (Model 1/2/3 CSVs + 3000Samplesv3.mat),
profiles them (columns, dtypes, missing values, field classes) and exposes
cached dataframes + derived structures to the analytics layer.

DATA HONESTY: every number downstream comes from these files. Nothing is
fabricated; when a field or calculation is unavailable we say so.
"""

from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path
from typing import Any, Dict, List, Optional

import numpy as np
import pandas as pd

BACKEND_DIR = Path(__file__).resolve().parent
DATA_DIR = Path(os.environ["FORGESITE_DATA"]) if "FORGESITE_DATA" in os.environ else BACKEND_DIR / "data"


def _clean_num(x: Any, nd: int = 4) -> Optional[float]:
    try:
        v = float(x)
    except (TypeError, ValueError):
        return None
    if not np.isfinite(v):
        return None
    return round(v, nd)


# --------------------------------------------------------------------------- #
# Loading
# --------------------------------------------------------------------------- #

@lru_cache(maxsize=1)
def model1() -> pd.DataFrame:
    p = DATA_DIR / "Model 1" / "Model_1.csv"
    if not p.exists():
        return pd.DataFrame()
    df = pd.read_csv(p)
    return df.loc[:, [c for c in df.columns if not str(c).startswith("Unnamed")]]


@lru_cache(maxsize=1)
def model2() -> pd.DataFrame:
    p = DATA_DIR / "Model 2" / "Model_2.csv"
    if not p.exists():
        return pd.DataFrame()
    df = pd.read_csv(p)
    return df.loc[:, [c for c in df.columns if not str(c).startswith("Unnamed")]]


@lru_cache(maxsize=1)
def model3() -> pd.DataFrame:
    p = DATA_DIR / "Model 3" / "Model_3.csv"
    if not p.exists():
        return pd.DataFrame()
    return pd.read_csv(p)


MODEL_LOADERS = {1: model1, 2: model2, 3: model3}


def get_model(model_id: int) -> pd.DataFrame:
    loader = MODEL_LOADERS.get(int(model_id))
    return loader() if loader else pd.DataFrame()


# --------------------------------------------------------------------------- #
# Field classification (used for smart defaults + correlation filtering)
# --------------------------------------------------------------------------- #

FIELD_CLASSES: Dict[str, Dict[str, List[str]]] = {
    1: {},
    2: {},
    3: {},
}


def _classify(model_id: int, cols: List[str]) -> Dict[str, List[str]]:
    classes: Dict[str, List[str]] = {
        "utilization": [], "queue": [], "waiting": [], "cycle": [],
        "production": [], "sku": [], "time": [], "storage": [], "other": [],
    }
    for c in cols:
        lc = c.lower()
        if "_util" in lc:
            classes["utilization"].append(c)
        elif "queue" in lc:
            classes["queue"].append(c)
        elif "wait" in lc or "waiting" in lc:
            classes["waiting"].append(c)
        elif "cycle" in lc or lc.startswith("c_cycle"):
            classes["cycle"].append(c)
        elif "totalproducts" in lc or "entities out" in lc or "total parts" in lc or "parts per hour" in lc:
            classes["production"].append(c)
        elif lc.startswith("sku") and ("_time" in lc):
            classes["waiting" if "wait" in lc else "other"].append(c)
            classes["sku"].append(c)
        elif lc.startswith(("c_cell", "c_total")) or "stored" in lc or "entities in" in lc:
            classes["production" if ("cell" in lc or "entities" in lc or "total" in lc) else "storage"].append(c)
            classes["sku"].append(c)
        elif "storage" in lc:
            classes["storage"].append(c)
        elif lc == "time_now":
            classes["time"].append(c)
        else:
            classes["other"].append(c)
    return classes


@lru_cache(maxsize=1)
def profile(model_id: int) -> Dict[str, Any]:
    df = get_model(model_id)
    if df.empty:
        return {"available": False, "model": model_id}
    num_cols = [c for c in df.columns if pd.api.types.is_numeric_dtype(df[c])]
    const_cols = [c for c in num_cols if df[c].nunique(dropna=True) <= 1]
    classes = _classify(model_id, list(df.columns))
    FIELD_CLASSES[model_id] = classes
    stats = {}
    for c in num_cols:
        s = df[c].dropna()
        if s.empty:
            continue
        q = s.quantile([0.05, 0.25, 0.5, 0.75, 0.95])
        stats[c] = {
            "mean": _clean_num(s.mean()), "std": _clean_num(s.std()),
            "min": _clean_num(s.min()), "max": _clean_num(s.max()),
            "p05": _clean_num(q[0.05]), "p25": _clean_num(q[0.25]),
            "median": _clean_num(q[0.5]), "p75": _clean_num(q[0.75]),
            "p95": _clean_num(q[0.95]),
            "missing_pct": _clean_num(df[c].isna().mean() * 100, 2),
            "constant": bool(s.nunique() <= 1),
        }
    return {
        "available": True,
        "model": model_id,
        "rows": int(len(df)),
        "columns": list(df.columns),
        "n_columns": int(df.shape[1]),
        "numeric_columns": num_cols,
        "constant_columns": const_cols,
        "field_classes": classes,
        "stats": stats,
        "missing_total": int(df.isna().sum().sum()),
        "memory_mb": _clean_num(df.memory_usage(deep=True).sum() / 1e6, 1),
    }


# --------------------------------------------------------------------------- #
# Station registry — exact columns from Model 3 (verified against the CSV)
# --------------------------------------------------------------------------- #

STATIONS: List[Dict[str, Any]] = [
    {"id": "BLANKING", "name": "Blanking", "zone": "front", "util": "Blanking_Util",
     "queues": ["Blanking_Queue", "Blanking_SKU1_Queue", "Blanking_SKU2_Queue",
                "Blanking_SKU3_Queue", "Blanking_SKU4_Queue"]},
    {"id": "PRESS1", "name": "Press 1", "zone": "pressing", "util": "Press1_Util", "queues": ["Press1_Queue"]},
    {"id": "PRESS2", "name": "Press 2", "zone": "pressing", "util": "Press2_Util", "queues": ["Press2_Queue"]},
    {"id": "PRESS3", "name": "Press 3", "zone": "pressing", "util": "Press3_Util", "queues": ["Press3_Queue"]},
    {"id": "PRESS4", "name": "Press 4", "zone": "pressing", "util": "Press4_Util", "queues": ["Press4_Queue"]},
    {"id": "CELL1", "name": "Assembly Cell 1", "zone": "assembly", "util": "Cell1_Util", "queues": ["Cell1_Queue"]},
    {"id": "CELL2", "name": "Assembly Cell 2", "zone": "assembly", "util": "Cell2_Util", "queues": ["Cell2_Queue"]},
    {"id": "CELL3", "name": "Assembly Cell 3", "zone": "assembly", "util": "Cell3_Util", "queues": ["Cell3_Queue"]},
    {"id": "CELL4", "name": "Assembly Cell 4", "zone": "assembly", "util": "Cell4_Util", "queues": ["Cell4_Queue"]},
    {"id": "PAINT1", "name": "Paint 1", "zone": "painting", "util": "Paint1_Util", "queues": ["Paint1_Queue"]},
    {"id": "PAINT2", "name": "Paint 2", "zone": "painting", "util": "Paint2_Util", "queues": ["Paint2_Queue"]},
    {"id": "QUALITY", "name": "Quality", "zone": "quality", "util": "Quality_Util", "queues": ["Quality_Queue"]},
    {"id": "FORKLIFT", "name": "Forklift Fleet", "zone": "logistics", "util": "Forklift_Util",
     "queues": ["Forklift_Blanking_Queue", "Forklift_Press_Queue", "Forklift_Assembly_Queue"]},
]

# Warehouses tracked as pure queues (no util column)
WAREHOUSE_QUEUES = ["Warehouse1_Queue", "Warehouse_2_Queue", "Warehouse_3_Queue", "Warehouse_4_Queue"]

SKU_CYCLE_COLS = {"SKU1": "c_Cycle1", "SKU2": "c_Cycle2", "SKU3": "c_Cycle3", "SKU4": "c_Cycle4"}
SKU_TIME_GROUPS = ["VA_Time", "NVA_Time", "Transport_Time", "Wait_Time", "Other_Time"]

# queue columns that actually vary (verified: Cell queues & Paint queues are all zero)
VARIANT_QUEUES = ["Blanking_Queue", "Press1_Queue", "Press2_Queue", "Press3_Queue",
                  "Press4_Queue", "Quality_Queue", "Warehouse1_Queue", "Warehouse_3_Queue",
                  "Warehouse_4_Queue", "Forklift_Blanking_Queue", "Forklift_Press_Queue",
                  "Forklift_Assembly_Queue"]


def station_queues(st: Dict[str, Any]) -> List[str]:
    """Queue columns for a station that exist and carry signal."""
    return [q for q in st["queues"] if q in VARIANT_QUEUES]


# --------------------------------------------------------------------------- #
# MAT workbook
# --------------------------------------------------------------------------- #

@lru_cache(maxsize=1)
def mat_inventory() -> Dict[str, Any]:
    p = DATA_DIR / "3000Samplesv3.mat"
    out: Dict[str, Any] = {"available": False, "file": p.name}
    if not p.exists():
        return out
    try:
        import scipy.io as sio
        m = sio.loadmat(str(p))
        arrays = {}
        for k, v in m.items():
            if k.startswith("__"):
                continue
            if isinstance(v, np.ndarray) and v.dtype.kind in "iuf":
                arrays[k] = {"shape": [int(x) for x in v.shape], "dtype": str(v.dtype)}
        out.update({"available": True, "arrays": arrays, "n_arrays": len(arrays)})
    except Exception as e:
        out["error"] = str(e)
    return out


# --------------------------------------------------------------------------- #
# Series / trend helpers (summarized — never send full data)
# --------------------------------------------------------------------------- #

def series_summary(df: pd.DataFrame, col: str, max_points: int = 300) -> Dict[str, Any]:
    """Downsampled trend series with real timestamps (row index as time)."""
    if col not in df.columns:
        return {"available": False, "reason": f"Required field unavailable in current dataset: {col}"}
    s = df[col].astype(float)
    n = len(s)
    step = max(1, n // max_points)
    sub = s.iloc[::step]
    idx = sub.index.to_numpy()
    return {
        "available": True,
        "column": col,
        "n": int(n),
        "points": [
            {"t": int(i), "v": _clean_num(v, 4)} for i, v in zip(idx, sub.to_numpy())
        ],
    }


def histogram(df: pd.DataFrame, col: str, bins: int = 24) -> List[Dict[str, float]]:
    if col not in df.columns:
        return []
    s = df[col].dropna().astype(float)
    if s.empty:
        return []
    counts, edges = np.histogram(s, bins=bins)
    return [{"bin": _clean_num((edges[i] + edges[i + 1]) / 2, 4), "count": int(counts[i])}
            for i in range(len(counts))]
