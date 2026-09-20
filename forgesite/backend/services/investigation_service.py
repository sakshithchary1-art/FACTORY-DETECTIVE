"""
Forge SIGHT — image-driven investigation service.

Chains: image analysis → production context (honest) → process signals from
existing analytics → possible contributing factors → what-if pointer.
Every claim is either a dataset metric, a labelled association or explicitly
unavailable. Never claims causation.
"""

from __future__ import annotations

import services.image_dataset_service as IDS
import services.vision_service as VS
import services.manufacturing_service as MS
import analytics as AN
import data_engine as DE


def build_investigation(record_id: str) -> dict:
    """Full chain for one real dataset image."""
    vision = VS.analyze_image_record(record_id)
    ctx = MS.production_context()

    df = DE.model3()
    stations = AN.station_metrics(df) if not df.empty else []

    # process signals — straight from existing analytics (no new "sources")
    signals = []
    if stations:
        worst = max(stations, key=lambda s: s["utilization"])
        signals.append({
            "id": 1,
            "title": f"{worst['name']} shows the highest machine usage",
            "detail": f"Machine usage {worst['utilization']}% across the event stream — the strongest load signal in the plant.",
            "kind": "DATASET METRIC",
        })
        bk = AN.bottleneck_ranking({})
        if bk.get("available"):
            top = (bk.get("stations") or [None])[0]
            if top:
                signals.append({
                    "id": 2,
                    "title": f"{top['name']} carries the highest constraint risk",
                    "detail": f"Transparent multi-signal score {top['score']}/100 (machine usage, waiting, queue, cycle signals).",
                    "kind": "DERIVED",
                })
        signals.append({
            "id": 3,
            "title": "Association, not causation",
            "detail": ("The image finding and these signals come from different data sources "
                       "with no shared identifier — treat any pattern as a lead for validation, "
                       "not a proven cause."),
            "kind": "METHODOLOGY",
        })

    inv_id = f"INV-IMG-{record_id[:24]}"

    return {
        "available": True,
        "id": inv_id,
        "image": {"id": vision["image_id"], "filename": vision["filename"],
                  "ground_truth": vision["ground_truth"], "prediction": vision["prediction"],
                  "confidence": vision["confidence"], "model_status": vision["model_status"]},
        "production_context": ctx,
        "process_signals": signals,
        "possible_factors": [
            {"station_id": s["id"], "station_name": s["name"], "constraint_risk": s["score"]}
            for s in stations[:1]
        ],
        "what_if": {"page": "simulate", "note": ("Run the What-If Test on the associated station "
                                                 "to see projected responses — labelled PROJECTED.")},
        "disclaimer": ("Image and production data are independent sources here; links are "
                       "manual associations for investigation, not measured causal chains."),
    }
