"""
Forge SIGHT — manufacturing linkage service.

Connects an image-analysis result to the EXISTING manufacturing analytics.
Data integrity rule: the image dataset carries no batch/SKU/station/timestamp
identifiers, so no linkage is fabricated. The service reports exactly what is
and is not possible and exposes the existing analytics for manual association.
"""

from __future__ import annotations

import services.image_dataset_service as IDS
import analytics as AN
import data_engine as DE


def production_context() -> dict:
    """Current production snapshot from the existing analytics (honest linkage).

    Returns linked=false with the measured reason when the image dataset has no
    linking key — the UI then offers manual station association instead.
    """
    df = DE.model3()
    if df.empty:
        return {"linked": False, "reason": "Manufacturing dataset unavailable.",
                "manual_available": False}

    link = IDS.linking_key_summary()
    stations = AN.station_metrics(df)
    bk = AN.bottleneck_ranking({})
    top = bk.get("stations", [None])[0] if bk.get("available") else None

    context = {
        "machine_usage_mean": round(sum(s["utilization"] for s in stations) / len(stations), 1) if stations else None,
        "top_constraints": [
            {"id": s["id"], "name": s["name"], "constraint_risk": s["score"], "utilization": s["utilization"]}
            for s in (bk.get("stations") or [])[:3]
        ] if bk.get("available") else [],
        "suggested_focus": top["name"] if top else None,
    }

    if not link.get("linked"):
        return {
            "linked": False,
            "reason": link.get("reason"),
            "manual_available": True,
            "production_snapshot": context,
            "note": ("Investigate by associating the finding with a station manually — "
                     "the analytics below are live manufacturing data."),
        }

    # (A real key would be resolved here per image; none exists in this dataset.)
    return {"linked": True, "keys": link.get("keys", []), "production_snapshot": context}
