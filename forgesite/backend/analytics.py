"""
ForgeSite — analytics layer.

KPIs, factory health, station metrics, the ForgeSite Bottleneck Score,
anomaly detection and the correlation engine. Every value is derived from
the real dataset; unavailable metrics are reported as such.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional

import numpy as np
import pandas as pd

import data_engine as DE

# --------------------------------------------------------------------------- #
# Configuration (backend-configurable weights)
# --------------------------------------------------------------------------- #

BOTTLENECK_WEIGHTS = {
    "utilization": 0.35,
    "queue": 0.30,
    "waiting": 0.15,
    "cycle": 0.10,
    "throughput_penalty": 0.10,
}

HEALTH_THRESHOLDS = {
    # utilization bands (percent)
    "util_watch": 70, "util_warning": 85, "util_critical": 95,
    # queue accumulation as multiple of the fleet median (relative)
    "queue_watch": 1.5, "queue_warning": 2.5, "queue_critical": 4.0,
}


def _num(x: Any, nd: int = 4) -> Optional[float]:
    try:
        v = float(x)
    except (TypeError, ValueError):
        return None
    if not np.isfinite(v):
        return None
    return round(v, nd)


def _is_constant(s: pd.Series) -> bool:
    """Fast constant check without nunique() (605k-row nunique is very slow)."""
    v = s.dropna()
    if len(v) < 2:
        return True
    first = v.iloc[0]
    return bool((v == first).all())


def _safe_corr(a: pd.Series, b: pd.Series, method: str = "pearson") -> Optional[float]:
    try:
        if _is_constant(a) or _is_constant(b):
            return None
        r = a.corr(b, method=method)
        return None if r is None or not np.isfinite(r) else float(r)
    except Exception:
        return None


# --------------------------------------------------------------------------- #
# Station metrics
# --------------------------------------------------------------------------- #

def station_metrics(df: Optional[pd.DataFrame] = None) -> List[Dict[str, Any]]:
    if df is None:
        df = DE.model3()
    if df.empty:
        return []
    out: List[Dict[str, Any]] = []
    zeros = pd.Series(np.zeros(len(df)), index=df.index)
    for st in DE.STATIONS:
        util_col = st["util"]
        if util_col not in df.columns:
            continue
        u = df[util_col].astype(float)
        qcols = DE.station_queues(st)
        qmeans = [float(df[q].mean()) for q in qcols if q in df.columns]
        q_mean = float(np.mean(qmeans)) if qmeans else None
        q_p95 = None
        if qcols:
            # vectorized sum (avoid DataFrame.sum(axis=1) on 605k rows)
            acc = zeros.copy()
            for q in qcols:
                if q in df.columns:
                    acc = acc + df[q].astype(float)
            q_p95 = float(acc.quantile(0.95)) if not acc.empty else None
        # cycle: nearest SKU cycle column (cell-indexed) else plant mean
        cyc = None
        if st["id"].startswith("CELL"):
            i = int(st["id"][-1])
            cyc_col = f"c_Cycle{i}"
            if cyc_col in df.columns:
                cyc = _num(df[cyc_col].mean(), 1)
        # waiting: SKU wait mapped by cell index, else NaN
        wait = None
        if st["id"].startswith("CELL"):
            i = int(st["id"][-1])
            wcol = f"SKU{i}_Wait_Time"
            if wcol in df.columns:
                wait = _num(df[wcol].mean(), 3)
        out.append({
            "id": st["id"], "name": st["name"], "zone": st["zone"],
            "util_col": util_col,
            "utilization": _num(u.mean() * 100, 1),
            "utilization_p95": _num(u.quantile(0.95) * 100, 1),
            "queue_cols": qcols,
            "queue_mean": _num(q_mean, 1),
            "queue_p95": _num(q_p95, 1),
            "cycle_mean": cyc,
            "wait_mean": wait,
        })
    return out


def _station_series_metrics(df: pd.DataFrame) -> List[Dict[str, Any]]:
    """Per-station time-series metrics for correlation/cycle signals."""
    out = []
    zeros = pd.Series(np.zeros(len(df)), index=df.index)
    for st in station_metrics(df):
        row = {"id": st["id"], "name": st["name"]}
        u = df[st["util_col"]].astype(float)
        row["util"] = u
        if st["queue_cols"]:
            q = zeros.copy()
            for qcol in st["queue_cols"]:
                if qcol in df.columns:
                    q = q + df[qcol].astype(float)
        else:
            q = zeros.copy()
        row["queue"] = q
        out.append(row)
    return out


# --------------------------------------------------------------------------- #
# Bottleneck engine — multi-signal, normalized, configurable
# --------------------------------------------------------------------------- #

def bottleneck_ranking(weights: Optional[Dict[str, float]] = None) -> Dict[str, Any]:
    df = DE.model3()
    if df.empty:
        return {"available": False}
    w = {**BOTTLENECK_WEIGHTS, **(weights or {})}
    sm = _station_series_metrics(df)
    if not sm:
        return {"available": False}

    util_m = np.array([float(s["util"].mean()) * 100 for s in sm])
    queue_m = np.array([float(s["queue"].mean()) for s in sm])
    # waiting proxy: p95 of station queue series (accumulation pressure)
    wait_m = np.array([float(s["queue"].quantile(0.95)) for s in sm])
    # cycle: cell-indexed cycle cols; other stations get plant mean cycle share
    cyc = np.zeros(len(sm))
    for i, s in enumerate(sm):
        if s["id"].startswith("CELL"):
            cyc[i] = float(df[f"c_Cycle{s['id'][-1]}"].mean())
        elif s["id"] == "BLANKING":
            cyc[i] = float(df["Blanking_Queue"].mean())  # accumulation at blanking
    cyc = cyc / (cyc.max() or 1.0) * 100

    def norm(a: np.ndarray) -> np.ndarray:
        return a / a.max() if a.max() > 0 else a * 0

    nu, nq, nw, nc = norm(util_m), norm(queue_m), norm(wait_m), norm(cyc)
    # throughput efficiency: 1 - normalized production contribution (higher at low-output stations)
    prod = df["c_TotalProducts"].astype(float)
    thr_eff = np.array([
        _safe_corr(s["util"], prod) or 0.0 for s in sm
    ])
    thr_eff_n = (thr_eff - thr_eff.min()) / ((thr_eff.max() - thr_eff.min()) or 1.0)

    score = (
        w["utilization"] * nu
        + w["queue"] * nq
        + w["waiting"] * nw
        + w["cycle"] * nc
        - w["throughput_penalty"] * thr_eff_n
    )
    score = (score - score.min()) / ((score.max() - score.min()) or 1.0) * 100

    ranked = []
    metrics_by_id = {m["id"]: m for m in station_metrics(df)}
    for i, s in enumerate(sm):
        m = metrics_by_id[s["id"]]
        if m is None:
            continue
        ranked.append({
            **m,
            "score": _num(score[i], 1),
            "components": {
                "utilization_norm": _num(nu[i], 3), "queue_norm": _num(nq[i], 3),
                "waiting_norm": _num(nw[i], 3), "cycle_norm": _num(nc[i], 3),
                "throughput_efficiency": _num(thr_eff[i], 3),
            },
        })
    ranked.sort(key=lambda x: x["score"], reverse=True)
    return {
        "available": True,
        "label": "Forge SIGHT Constraint Risk",
        "note": ("Transparent multi-signal indicator — NOT a scientifically validated metric. "
                 "Weights are configurable in the backend."),
        "weights": w,
        "stations": ranked,
        "top": ranked[0] if ranked else None,
    }


# --------------------------------------------------------------------------- #
# KPIs + factory health
# --------------------------------------------------------------------------- #

def kpis() -> Dict[str, Any]:
    df = DE.model3()
    if df.empty:
        return {"available": False}
    prof = DE.profile(3)
    util_cols = prof["field_classes"]["utilization"]
    util_vals = [float(df[c].mean()) * 100 for c in util_cols if c in df.columns]
    factory_util = float(np.mean(util_vals)) if util_vals else None

    throughput = _num(df["c_TotalProducts"].mean(), 0) if "c_TotalProducts" in df.columns else None

    # critical queue: strongest accumulation vs fleet
    qstats = []
    for q in DE.VARIANT_QUEUES:
        if q in df.columns:
            s = df[q].astype(float)
            qstats.append({"queue": q, "mean": float(s.mean()), "p95": float(s.quantile(0.95)),
                           "max": float(s.max())})
    qstats.sort(key=lambda x: x["p95"], reverse=True)
    critical_queue = qstats[0] if qstats else None

    bk = bottleneck_ranking()
    top_station = bk.get("top")

    # waiting: mean of SKU wait times
    wait_cols = [c for c in df.columns if c.endswith("_Wait_Time")]
    wait_mean = _num(float(np.mean([df[c].mean() for c in wait_cols])) * 60, 1) if wait_cols else None  # minutes

    # ---- production-flow health (the "flow progress" bar) -----------------
    # The dataset tracks queues and machine usage, not per-job completion, so a
    # literal "percent of jobs through the line" does not exist. What CAN be
    # measured, per main-line stage, is how unimpeded the flow is:
    #   · congestion-free share — event samples where the stage queue is empty
    #     (always-empty stages legitimately score 100: material never waits)
    #   · machine readiness — 100 minus mean machine usage
    # Flow share = mean of the two; a stage can only score high when material
    # moves freely AND machines have headroom. Clearly labelled as a derived
    # flow-health indicator, not a job-completion percentage.
    stages_flow = []
    for st in DE.STATIONS:
        if st["id"] == "FORKLIFT":
            continue
        util_col = st["util"]
        if util_col not in df.columns:
            continue
        u = df[util_col].astype(float)
        readiness = float(100.0 - u.mean() * 100)
        qcols = [q for q in st["queues"] if q in df.columns]
        if qcols:
            acc = pd.Series(np.zeros(len(df)), index=df.index)
            for q in qcols:
                acc = acc + df[q].astype(float)
            free_share = float((acc == 0).mean() * 100)
        else:
            free_share = readiness  # no queue signal for this stage
        flow_pct = _num((free_share + readiness) / 2, 1)
        stages_flow.append({
            "id": st["id"], "name": st["name"], "flow_pct": flow_pct,
            "queue_free_share": _num(free_share, 1),
            "machine_readiness": _num(readiness, 1),
            "queue_mean": _num(float(acc.mean()), 2) if qcols else 0.0,
            "note": "derived flow health: congestion-free share and machine readiness",
        })
    flow_overall = _num(float(np.mean([s["flow_pct"] for s in stages_flow])), 1) if stages_flow else None

    return {
        "available": True,
        "factory_utilization": _num(factory_util, 1),
        "throughput_mean": throughput,
        "critical_queue": critical_queue,
        "bottleneck_station": {"id": top_station["id"], "name": top_station["name"],
                               "score": top_station["score"]} if top_station else None,
        "waiting_mean_min": wait_mean,
        "queue_fleet": qstats[:8],
        "flow_progress": {
            "overall": flow_overall,
            "stages": stages_flow,
            "method": ("derived flow health per stage — mean of congestion-free "
                       "share (event samples with empty queue) and machine "
                       "readiness (100 − usage). Not a job-completion percentage."),
        },
    }


def factory_health() -> Dict[str, Any]:
    df = DE.model3()
    if df.empty:
        return {"available": False}
    t = HEALTH_THRESHOLDS
    sm = station_metrics(df)
    utils = [s["utilization"] for s in sm if s["utilization"] is not None]
    util_mean = float(np.mean(utils))

    def util_band(v: float) -> str:
        if v >= t["util_critical"]: return "CRITICAL"
        if v >= t["util_warning"]: return "WARNING"
        if v >= t["util_watch"]: return "WATCH"
        return "HEALTHY"

    # queue pressure: fleet p95 accumulation vs median station
    qs = []
    for s in sm:
        if s["queue_p95"] is not None:
            qs.append(s["queue_p95"])
    q_med = float(np.median(qs)) if qs else 0
    q_max = max(qs) if qs else 0
    q_ratio = q_max / q_med if q_med > 0 else 0

    def ratio_band(r: float) -> str:
        if r >= t["queue_critical"]: return "CRITICAL"
        if r >= t["queue_warning"]: return "WARNING"
        if r >= t["queue_watch"]: return "WATCH"
        return "HEALTHY"

    # waiting / cycle components from SKU accounting
    wait_cols = [c for c in df.columns if c.endswith("_Wait_Time")]
    waits = [float(df[c].mean()) for c in wait_cols] if wait_cols else []
    wait_mean = float(np.mean(waits)) if waits else 0.0
    va_cols = [c for c in df.columns if c.endswith("_VA_Time")]
    vas = [float(df[c].mean()) for c in va_cols] if va_cols else [1.0]
    va_mean = float(np.mean(vas)) if vas else 1.0
    wait_ratio = wait_mean / va_mean if va_mean > 0 else 0

    cycle_cols = DE.SKU_CYCLE_COLS.values()
    cycles = [float(df[c].mean()) for c in cycle_cols if c in df.columns]
    cycle_cv = float(np.std(cycles) / np.mean(cycles)) if cycles and np.mean(cycles) > 0 else 0

    def wait_band(r: float) -> str:
        if r >= 2.0: return "CRITICAL"
        if r >= 1.0: return "WARNING"
        if r >= 0.5: return "WATCH"
        return "HEALTHY"

    def cycle_band(cv: float) -> str:
        if cv >= 0.6: return "CRITICAL"
        if cv >= 0.4: return "WARNING"
        if cv >= 0.25: return "WATCH"
        return "HEALTHY"

    flow = util_band(util_mean)
    bands = {
        "Production Flow": util_band(util_mean),
        "Resource Utilization": util_band(util_mean),
        "Queue Pressure": ratio_band(q_ratio),
        "Waiting Time": wait_band(wait_ratio),
        "Cycle Performance": cycle_band(cycle_cv),
    }
    order = {"HEALTHY": 0, "WATCH": 1, "WARNING": 2, "CRITICAL": 3}
    overall = max(bands.values(), key=lambda b: order[b])
    # overall score: 100 healthy → 0 critical
    score = 100 - order[overall] * 25 + (10 if overall == "HEALTHY" else 0)
    return {
        "available": True,
        "overall": overall,
        "score": min(100, max(0, score)),
        "components": bands,
        "detail": {
            "utilization_mean": _num(util_mean, 1),
            "queue_p95_max": _num(q_max, 1),
            "queue_ratio_to_median": _num(q_ratio, 2),
            "wait_to_va_ratio": _num(wait_ratio, 2),
            "cycle_cv": _num(cycle_cv, 3),
        },
        "thresholds": t,
    }


# --------------------------------------------------------------------------- #
# Anomaly engine
# --------------------------------------------------------------------------- #

def _mad_z(s: pd.Series) -> pd.Series:
    med = s.median()
    mad = (s - med).abs().median()
    if mad < 1e-9:
        return pd.Series(np.zeros(len(s)), index=s.index)
    return 0.6745 * (s - med) / mad


_ANOMALY_CACHE: Dict[tuple, Dict[str, Any]] = {}


def detect_anomalies(metric: Optional[str] = None, method: str = "auto",
                     max_report: int = 40) -> Dict[str, Any]:
    """
    Anomaly detection on Model 3 operational metrics.
    method: auto | zscore | iqr | rolling | isolation_forest
    Returns anomalies with expected range vs observed value and deviation.
    Full-scan results are cached per (metric, method) — the scan is deterministic.
    """
    key = (metric, method)
    if key in _ANOMALY_CACHE:
        return _ANOMALY_CACHE[key]
    df = DE.model3()
    if df.empty:
        return {"available": False}

    candidates = {
        "Queues": DE.VARIANT_QUEUES,
        "Utilization": [st["util"] for st in DE.STATIONS if st["util"] in df.columns],
        "Production": ["c_TotalProducts"],
        "Cycle": list(DE.SKU_CYCLE_COLS.values()),
        "Waiting": [c for c in df.columns if c.endswith("_Wait_Time")],
    }

    results: List[Dict[str, Any]] = []
    rng = np.random.default_rng(42)

    def scan(col: str, group: str, forced: Optional[str] = None):
        s = df[col].astype(float).dropna()
        if len(s) < 30 or s.nunique() < 5:
            return
        m = forced or method
        if m == "auto":
            # skewed count-like metrics → IQR; continuous ratios → rolling z
            m = "iqr" if (s.min() >= 0 and s.skew() > 1.5) else "rolling"
        anomalies: List[Dict[str, Any]] = []
        if m == "zscore":
            z = (s - s.mean()) / (s.std() or 1)
            mask = z.abs() > 4
            expected = (float(s.mean() - 3 * s.std()), float(s.mean() + 3 * s.std()))
        elif m == "iqr":
            q1, q3 = s.quantile(0.25), s.quantile(0.75)
            iqr = q3 - q1
            hi = q3 + 3.0 * iqr
            mask = s > hi
            expected = (float(q1 - 1.5 * iqr), float(q3 + 1.5 * iqr))
        elif m == "rolling":
            # stride-5 downsample for the rolling baseline (event stream is dense;
            # 121k points is ample for a robust rolling-median residual test)
            ss = s.iloc[::5]
            win = min(501, max(101, len(ss) // 20))
            if win % 2 == 0:
                win += 1
            roll_med = ss.rolling(win, center=True, min_periods=win // 2).median()
            resid = (ss - roll_med).dropna()
            z = (resid - resid.mean()) / (resid.std() or 1)
            outliers = z[abs(z) > 4.5]
            mask = pd.Series(False, index=s.index)
            mask.loc[outliers.index] = True
            expected = (float(roll_med.quantile(0.01)), float(roll_med.quantile(0.99)))
        elif m == "isolation_forest":
            from sklearn.ensemble import IsolationForest
            X = s.to_numpy().reshape(-1, 4 if False else 1)
            iso = IsolationForest(n_estimators=100, contamination=0.01, random_state=42)
            labels = iso.fit_predict(X)
            mask = pd.Series(labels == -1, index=s.index)
            expected = (float(s.quantile(0.005)), float(s.quantile(0.995)))
        else:
            return

        idxs = s.index[mask]
        for i in idxs[: max_report]:
            v = float(s.loc[i])
            dev = _num((v - np.mean(expected)) / (np.std(expected) or 1.0), 2)
            anomalies.append({
                "metric": col, "group": group, "index": int(i),
                "observed": _num(v, 2),
                "expected_low": _num(expected[0], 2),
                "expected_high": _num(expected[1], 2),
                "deviation_sigma": dev,
                "method": m,
            })
        if anomalies:
            sev = "CRITICAL" if any(abs(a["deviation_sigma"] or 0) > 8 for a in anomalies) else "WARNING"
            results.append({
                "metric": col, "group": group, "method": m,
                "n_anomalies": int(mask.sum()),
                "n_total": int(len(s)),
                "anomaly_rate_pct": _num(mask.mean() * 100, 3),
                "severity": sev,
                "samples": anomalies[:6],
            })

    for group, cols in candidates.items():
        for c in cols:
            if metric and c != metric:
                continue
            scan(c, group)

    results.sort(key=lambda r: (r["severity"] != "CRITICAL", -r["anomaly_rate_pct"]))
    out = {"available": True, "scan": results, "n_metrics_scanned": len(results)}
    _ANOMALY_CACHE[key] = out
    return out


# --------------------------------------------------------------------------- #
# Correlation engine
# --------------------------------------------------------------------------- #

def _shortname(col: str) -> str:
    return (col.replace("_Util", " Util").replace("_Queue", " Queue")
               .replace("c_TotalProducts", "Total Products")
               .replace("c_Cycle", "Cycle ")
               .replace("_Wait_Time", " Wait").replace("_VA_Time", " VA")
               .replace("_Transport_Time", " Transport"))


def correlation_matrix(model_id: int = 3, max_vars: int = 10) -> Dict[str, Any]:
    df = DE.get_model(model_id)
    if df.empty:
        return {"available": False}
    prof = DE.profile(model_id)
    # curated variable set: representative columns per class
    classes = prof["field_classes"]
    vars_: List[str] = []
    def pick(cols: List[str], k: int = 2):
        for c in cols[:k]:
            if c in df.columns and c not in vars_ and not prof["stats"].get(c, {}).get("constant", False):
                vars_.append(c)
    pick(classes["utilization"], 4)
    pick(classes["queue"], 3)
    pick(classes["cycle"], 2)
    pick(classes["production"], 1)
    pick(classes["waiting"], 1)
    vars_ = vars_[:max_vars]
    if len(vars_) < 2:
        return {"available": False, "reason": "Insufficient data for this analysis."}
    sub = df[vars_].astype(float).dropna()
    n = len(sub)
    corr = sub.corr(method="pearson")
    cells = []
    for i, a in enumerate(vars_):
        for j, b in enumerate(vars_):
            cells.append({"a": a, "b": b, "a_short": _shortname(a), "b_short": _shortname(b),
                          "r": _num(corr.iloc[i, j], 3), "i": i, "j": j})
    return {
        "available": True, "model": model_id, "variables": vars_,
        "variables_short": [_shortname(v) for v in vars_],
        "n": int(n), "cells": cells,
    }


def correlation_detail(model_id: int, a: str, b: str, method: str = "pearson",
                       lag: int = 0) -> Dict[str, Any]:
    df = DE.get_model(model_id)
    if df.empty or a not in df.columns or b not in df.columns:
        return {"available": False, "reason": "Required field unavailable in current dataset."}
    x = df[a].astype(float)
    y = df[b].astype(float).shift(-lag) if lag else df[b].astype(float)
    both = pd.concat([x, y], axis=1).dropna()
    if len(both) < 30 or both.iloc[:, 0].nunique() < 2 or both.iloc[:, 1].nunique() < 2:
        return {"available": False, "reason": "Insufficient data for this analysis."}
    try:
        from scipy import stats as st
        if method == "spearman":
            r, p = st.spearmanr(both.iloc[:, 0], both.iloc[:, 1])
        else:
            r, p = st.pearsonr(both.iloc[:, 0], both.iloc[:, 1])
        z = np.arctanh(np.clip(r, -0.9999, 0.9999))
        se = 1 / np.sqrt(len(both) - 3)
        lo, hi = np.tanh(z - 1.96 * se), np.tanh(z + 1.96 * se)
        return {
            "available": True, "a": a, "b": b, "method": method, "lag": lag,
            "r": _num(float(r), 4), "p_value": _num(float(p), 8),
            "n": int(len(both)),
            "ci95": [_num(float(lo), 3), _num(float(hi), 3)],
            "interpretation": _interpret(float(r), float(p)),
        }
    except Exception:
        # scipy fallback: numpy pearson, no p-value
        r = _safe_corr(both.iloc[:, 0], both.iloc[:, 1], method="pearson")
        if r is None:
            return {"available": False, "reason": "Insufficient data for this analysis."}
        return {"available": True, "a": a, "b": b, "method": "pearson", "lag": lag,
                "r": _num(r, 4), "p_value": None, "n": int(len(both)),
                "ci95": None,
                "interpretation": _interpret(r, None)}


def _interpret(r: float, p: Optional[float]) -> str:
    mag = abs(r)
    strength = ("very strong" if mag >= 0.8 else "strong" if mag >= 0.6 else
                "moderate" if mag >= 0.4 else "weak" if mag >= 0.2 else "negligible")
    direction = "positive" if r >= 0 else "negative"
    sig = ""
    if p is not None:
        sig = " — statistically significant" if p < 0.05 else " — not statistically significant"
    return (f"{strength.title()} {direction} association (observed relationship; "
            f"correlation does not establish causation){sig}.")


def top_relationships(model_id: int = 3, limit: int = 12) -> Dict[str, Any]:
    """Scan numeric fields (constants removed) for strongest meaningful pairs."""
    df = DE.get_model(model_id)
    if df.empty:
        return {"available": False}
    prof = DE.profile(model_id)
    classes = prof["field_classes"]
    pool: List[str] = []
    def take(cols: List[str], k: int):
        for c in cols[:k]:
            if c in df.columns and not prof["stats"].get(c, {}).get("constant", False) and c not in pool:
                pool.append(c)
    take(classes["utilization"], 6)
    take(classes["queue"], 6)
    take(classes["cycle"], 4)
    take(classes["production"], 1)
    take(classes["waiting"], 2)
    take(classes["sku"], 4)
    pool = pool[:20]
    pairs = []
    for i in range(len(pool)):
        for j in range(i + 1, len(pool)):
            r = _safe_corr(df[pool[i]].astype(float), df[pool[j]].astype(float))
            if r is None:
                continue
            pairs.append({"a": pool[i], "b": pool[j], "a_short": _shortname(pool[i]),
                          "b_short": _shortname(pool[j]), "r": _num(r, 3)})
    pairs.sort(key=lambda x: abs(x["r"]), reverse=True)
    return {"available": True, "pairs": pairs[:limit], "n_pairs_computed": len(pairs)}
