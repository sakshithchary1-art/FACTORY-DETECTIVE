"""
Forge SIGHT — vision service.

Two honest modes:
  MODE A  "trained"    — a real model produced by train_vision_model() and stored
                         under VISION_MODEL_PATH (or backend/generated/vision_model.joblib).
                         Evaluation metrics are measured on a held-out split of the
                         real dataset and stored WITH the model file.
  MODE B  "prototype"  — deterministic feature-based classifier (labelled
                         "Prototype Vision Analysis"). Uses measured image features
                         (edge statistics, saturation, darkness, color variance)
                         mapped to the dataset's ACTUAL classes via a small logistic
                         model trained on real labeled images when available —
                         never on invented labels.

Nothing here invents labels, accuracies, IoU or localization. If the dataset has
no bounding boxes, `localization` stays null and the UI says so.
"""

from __future__ import annotations

import io
import os
import re
from pathlib import Path

import numpy as np

import services.image_dataset_service as IDS

GENERATED = Path(__file__).resolve().parents[1] / "generated"
MODEL_PATH = Path(os.environ.get("VISION_MODEL_PATH", "")).expanduser() if os.environ.get("VISION_MODEL_PATH") \
    else GENERATED / "vision_model.joblib"

FEATURE_KEYS = ["edge_density", "dark_ratio", "saturation", "color_var", "brightness_var"]
_cache: dict = {"model": None, "path": None}


# ---------------------------------------------------------------------------
# Feature extraction (measured from real pixels)
# ---------------------------------------------------------------------------

def extract_features(im) -> dict:
    """Measured image features. No randomness — same image in, same features out."""
    im = im.convert("RGB").resize((128, 128))
    a = np.asarray(im, dtype=np.float32) / 255.0
    gray = a.mean(axis=2)

    # gradient magnitude (simple Sobel, vectorized)
    gx = np.abs(np.diff(gray, axis=1)).sum()
    gy = np.abs(np.diff(gray, axis=0)).sum()
    edge_density = float((gx + gy) / (127 * 127))

    dark_ratio = float((gray < 0.35).mean())
    hsv_max = a.max(axis=2)
    hsv_min = a.min(axis=2)
    sat = np.where(hsv_max > 0, (hsv_max - hsv_min) / np.maximum(hsv_max, 1e-6), 0.0)
    saturation = float(sat.mean())
    color_var = float(a.std(axis=(0, 1)).mean())
    brightness_var = float(gray.std())

    return {
        "edge_density": round(edge_density, 5),
        "dark_ratio": round(dark_ratio, 5),
        "saturation": round(saturation, 5),
        "color_var": round(color_var, 5),
        "brightness_var": round(brightness_var, 5),
    }


# ---------------------------------------------------------------------------
# Training (only when the real dataset provides labels)
# ---------------------------------------------------------------------------

def train_vision_model(max_per_class: int = 300, test_size: float = 0.25) -> dict:
    """Train a small logistic classifier on REAL labeled images.

    Returns a summary incl. held-out metrics MEASURED on the test split.
    Raises RuntimeError if the dataset is unlabeled or unavailable.
    """
    from joblib import dump
    from PIL import Image
    from sklearn.linear_model import LogisticRegression
    from sklearn.metrics import (accuracy_score, confusion_matrix, f1_score,
                                 precision_score, recall_score)
    from sklearn.model_selection import train_test_split
    from sklearn.preprocessing import StandardScaler
    from sklearn.pipeline import Pipeline

    IDS.ensure_loaded()
    if not IDS.available():
        raise RuntimeError(IDS.unavailable_reason() or "Image dataset unavailable.")
    stats = IDS.get_stats()
    if stats.get("unlabeled"):
        raise RuntimeError("Dataset is unlabeled — supervised training is not possible without inventing labels.")

    import random
    rng = random.Random(42)  # fixed seed: reproducible sampling of real images
    X, y, used = [], [], []
    for label in stats["classes"]:
        pool = [r for r in IDS._records if r["label"] == label]
        rng.shuffle(pool)
        for r in pool[:max_per_class]:
            try:
                raw = IDS.image_bytes(r["id"])
                with Image.open(io.BytesIO(raw)) as im:
                    feats = extract_features(im)
                X.append([feats[k] for k in FEATURE_KEYS])
                y.append(label)
                used.append(r["id"])
            except Exception:
                continue  # corrupted images are skipped safely

    if not X:
        raise RuntimeError("No readable images found for training.")

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=test_size, stratify=y, random_state=42)

    pipe = Pipeline([
        ("scaler", StandardScaler()),
        ("clf", LogisticRegression(max_iter=2000, C=1.0)),
    ])
    pipe.fit(X_train, y_train)

    # evaluation — MEASURED on held-out real images, or honestly absent
    metrics = None
    if len(X_test) and len(set(y_test)) > 1:
        yp = pipe.predict(X_test)
        metrics = {
            "n_test": len(y_test),
            "accuracy": round(float(accuracy_score(y_test, yp)), 4),
            "precision_macro": round(float(precision_score(y_test, yp, average="macro", zero_division=0)), 4),
            "recall_macro": round(float(recall_score(y_test, yp, average="macro", zero_division=0)), 4),
            "f1_macro": round(float(f1_score(y_test, yp, average="macro", zero_division=0)), 4),
            "confusion_matrix": {
                "labels": sorted(set(y_test)),
                "matrix": confusion_matrix(y_test, yp, labels=sorted(set(y_test))).tolist(),
            },
        }

    payload = {
        "model": pipe,
        "classes": list(pipe.classes_),
        "features": FEATURE_KEYS,
        "trained_at": __import__("time").strftime("%Y-%m-%d %H:%M:%S"),
        "n_train": len(y_train),
        "n_eval": len(y_test),
        "metrics": metrics,
        "model_kind": "logistic-regression on measured image features",
    }
    GENERATED.mkdir(parents=True, exist_ok=True)
    dump(payload, MODEL_PATH)
    _cache["model"], _cache["path"] = payload, MODEL_PATH
    return {"status": "trained", "path": str(MODEL_PATH.name), "n_train": len(y_train),
            "n_eval": len(y_test), "metrics": metrics}


def _load_model():
    if _cache["model"] is not None and _cache["path"] == MODEL_PATH:
        return _cache["model"]
    if MODEL_PATH.exists():
        try:
            from joblib import load
            payload = load(MODEL_PATH)
            _cache["model"], _cache["path"] = payload, MODEL_PATH
            return payload
        except Exception:
            return None
    return None


# ---------------------------------------------------------------------------
# Prediction
# ---------------------------------------------------------------------------

def model_status() -> dict:
    m = _load_model()
    stats = IDS.get_stats()
    if m:
        return {
            "mode": "trained",
            "label": "REAL MODEL PREDICTION",
            "model_kind": m.get("model_kind"),
            "trained_at": m.get("trained_at"),
            "n_train": m.get("n_train"),
            "metrics": m.get("metrics"),     # None → UI shows "not available"
            "classes": m.get("classes"),
        }
    return {
        "mode": "prototype",
        "label": "PROTOTYPE VISION ANALYSIS",
        "model_kind": "deterministic feature heuristic over measured image features",
        "classes": stats.get("classes", []),
        "metrics": None,
        "note": ("No trained model is installed. Results are a transparent prototype "
                 "computed from measured image features — not a validated defect classifier."),
    }


def analyze_image_record(record_id: str) -> dict:
    """Analyze one REAL dataset image. Returns only fields that truly exist."""
    import io as _io
    from PIL import Image

    IDS.ensure_loaded()
    if not IDS.available():
        raise RuntimeError(IDS.unavailable_reason() or "Image dataset unavailable.")
    rec = IDS.get_image(record_id)
    raw = IDS.image_bytes(record_id)

    with Image.open(_io.BytesIO(raw)) as im:
        feats = extract_features(im)

    m = _load_model()
    ground_truth = rec["label"]  # may be None (unlabeled dataset) — reported as such

    if m:
        model_type, model_status_label = "trained", "REAL MODEL PREDICTION"
        proba = m["model"].predict_proba([[feats[k] for k in m["features"]]])[0]
        order = np.argsort(proba)[::-1]
        classes = m["classes"]
        prediction = classes[order[0]]
        confidence = float(proba[order[0]])
        top = [{"label": classes[i], "p": round(float(proba[i]), 4)} for i in order[:3]]
    else:
        model_type, model_status_label = "prototype", "PROTOTYPE VISION ANALYSIS"
        prediction, confidence, top = _prototype_predict(feats)

    return {
        "image_id": rec["id"],
        "filename": rec["filename"],
        "ground_truth": ground_truth,
        "prediction": prediction,
        "confidence": round(confidence, 4),
        "top_predictions": top,
        "features": feats,
        "localization": None,   # dataset has no bbox/mask annotations → never fabricated
        "model_type": model_type,
        "model_status": model_status_label,
        "metadata": rec.get("metadata"),
    }


def _prototype_predict(feats: dict):
    """Deterministic fallback over the dataset's ACTUAL classes.

    Scores each class by measured-feature tendencies of this very dataset
    (computed lazily from a small real sample) — no invented label list.
    """
    stats = IDS.get_stats()
    classes = stats.get("classes") or []
    if not classes:
        return None, 0.0, []

    ref = _class_feature_profiles(classes)
    x = np.array([feats[k] for k in FEATURE_KEYS])

    scores, explained = [], {}
    for cls, prof in ref.items():
        mu = np.array([prof[k] for k in FEATURE_KEYS])
        sd = np.array([prof.get(k + "_sd", 1e-6) for k in FEATURE_KEYS])
        z = (x - mu) / np.maximum(sd, 1e-6)
        scores.append(-float(np.mean(np.abs(z))))  # closer to class profile → higher
        explained[cls] = round(float(np.mean(np.abs(z))), 3)

    scores = np.array(scores)
    shift = scores - scores.max()
    p = np.exp(shift * 3)
    p = p / p.sum()
    order = np.argsort(p)[::-1]
    top = [{"label": classes[i], "p": round(float(p[i]), 4)} for i in order[:3]]
    return classes[order[0]], float(p[order[0]]), top


_profiles: dict | None = None


def _class_feature_profiles(classes, per_class: int = 40):
    """Lazily measured per-class feature profiles from REAL dataset images."""
    global _profiles
    if _profiles is not None:
        return _profiles
    from PIL import Image

    profs = {}
    for cls in classes:
        rows = []
        pool = [r for r in IDS._records if r["label"] == cls][:per_class]
        for r in pool:
            try:
                with Image.open(io.BytesIO(IDS.image_bytes(r["id"]))) as im:
                    rows.append([extract_features(im)[k] for k in FEATURE_KEYS])
            except Exception:
                continue
        if rows:
            arr = np.array(rows)
            profs[cls] = {**{k: float(arr[:, i].mean()) for i, k in enumerate(FEATURE_KEYS)},
                          **{k + "_sd": float(arr[:, i].std()) for i, k in enumerate(FEATURE_KEYS)}}
    _profiles = profs or None
    return _profiles


def analyze_uploaded(image_base64: str) -> dict:
    """Analyze a user-provided image (no ground truth exists for uploads)."""
    import base64
    from PIL import Image

    m = re.match(r"^data:image/[^;]+;base64,(.+)$", image_base64)
    payload = m.group(1) if m else image_base64
    try:
        raw = base64.b64decode(payload)
        with Image.open(io.BytesIO(raw)) as im:
            feats = extract_features(im)
    except Exception:
        raise RuntimeError("The provided file could not be read as an image.")

    m_model = _load_model()
    if m_model:
        model_type, model_status_label = "trained", "REAL MODEL PREDICTION"
        proba = m_model["model"].predict_proba([[feats[k] for k in m_model["features"]]])[0]
        order = np.argsort(proba)[::-1]
        classes = m_model["classes"]
        prediction, confidence = classes[order[0]], float(proba[order[0]])
        top = [{"label": classes[i], "p": round(float(proba[i]), 4)} for i in order[:3]]
    else:
        model_type, model_status_label = "prototype", "PROTOTYPE VISION ANALYSIS"
        prediction, confidence, top = _prototype_predict(feats)

    return {
        "image_id": None,
        "filename": "user-upload",
        "ground_truth": None,
        "prediction": prediction,
        "confidence": round(confidence, 4),
        "top_predictions": top,
        "features": feats,
        "localization": None,
        "model_type": model_type,
        "model_status": model_status_label,
        "metadata": None,
    }
