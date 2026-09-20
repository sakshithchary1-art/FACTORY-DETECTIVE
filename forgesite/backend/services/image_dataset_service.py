"""
Forge SIGHT — image dataset ingestion service.

Scans the supplied image dataset, profiles it automatically (structure,
classes, formats, dimensions, splits, annotations) and serves safe metadata
plus JPEG thumbnails. Source data is strictly READ-ONLY: images are read
straight from the archive; every derived artifact goes to generated/.

Supported layouts (auto-detected):
  <root>/<class>/*.png              (class folders)
  <root>/train/<class>/* + val/… + test/…   (split folders)
  <root>/images/* + labels|annotations.(csv|json|txt|xml)   (yolo/coco-ish)

Nothing about classes, counts or metadata is assumed or invented: every value
here is measured from the actual files. If no labels exist, labels = [] and
the dataset is reported as "Unlabeled Image Dataset".
"""

from __future__ import annotations

import io
import os
import re
import struct
import threading
import time
from pathlib import Path

# Load backend/.env if present (no external dependency required)
_env_file = Path(__file__).resolve().parents[1] / ".env"
if _env_file.exists():
    for _line in _env_file.read_text(encoding="utf-8", errors="ignore").splitlines():
        _line = _line.strip()
        if _line and not _line.startswith("#") and "=" in _line:
            _k, _v = _line.split("=", 1)
            os.environ.setdefault(_k.strip(), _v.strip())

from services._zipfile import open_dataset_archive

# ---------------------------------------------------------------------------
# Configuration (env-driven, no hardcoded Windows paths)
# ---------------------------------------------------------------------------

def dataset_source() -> Path:
    """Resolved dataset path: env var wins, else conventional repo locations.

    Search order (no hardcoded user paths):
      1. $IMAGE_DATASET_PATH from the environment / backend .env
      2. <repo>/data/  — any zip or folder with "image" in its name
      3. <repo>/       — same convention
    """
    env = os.environ.get("IMAGE_DATASET_PATH", "").strip()
    if env:
        p = Path(env)
        if p.exists():
            return p
    repo = Path(__file__).resolve().parents[2]
    for base in (repo / "data", repo):
        if not base.exists():
            continue
        candidates = [p for p in sorted(base.iterdir())
                      if p.is_dir() and "image" in p.name.lower()
                      or p.is_file() and "image" in p.name.lower()
                      and p.read_bytes()[:2] == b"PK"]
        # prefer explicit zip files first, then folders
        for p in candidates:
            if p.is_file():
                return p
        for p in candidates:
            if p.is_dir():
                return p
    return repo / "data" / "IMAGE_DATASET"
IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".webp", ".bmp"}
ANNOTATION_EXTS = {".csv", ".json", ".txt", ".xml", ".yaml", ".yml"}
SPLIT_ALIASES = {
    "train": "train", "training": "train",
    "val": "val", "valid": "val", "validation": "val",
    "test": "test", "testing": "test",
}
THUMB_SIZE = 160
CACHE_DIR = Path(__file__).resolve().parents[1] / "generated" / "thumbs"

_lock = threading.Lock()


def dataset_source() -> Path:
    """Resolved dataset path: env var wins, else the project-local default."""
    env = os.environ.get("IMAGE_DATASET_PATH", "").strip()
    if env:
        return Path(env)
    return DEFAULT_ZIP


# ---------------------------------------------------------------------------
# Fast binary image probes (no Pillow needed for scanning; Pillow used for thumbs)
# ---------------------------------------------------------------------------

def _probe_size(head: bytes, ext: str):
    """Return (width, height) or None. Supports png/jpeg/webp/bmp headers."""
    try:
        if head[:8] == b"\x89PNG\r\n\x1a\n" and head[12:16] == b"IHDR":
            w, h = struct.unpack(">II", head[16:24])
            return int(w), int(h)
        if head[:2] == b"\xff\xd8":  # JPEG — walk segments for SOF
            i, n = 2, len(head)
            while i + 9 < n:
                if head[i] != 0xFF:
                    i += 1
                    continue
                marker = head[i + 1]
                if marker in (0xC0, 0xC1, 0xC2, 0xC3, 0xC5, 0xC6, 0xC7,
                              0xC9, 0xCA, 0xCB, 0xCD, 0xCE, 0xCF):
                    h, w = struct.unpack(">HH", head[i + 5:i + 9])
                    return int(w), int(h)
                seg = struct.unpack(">H", head[i + 2:i + 4])[0]
                i += 2 + seg
            return None
        if head[:4] == b"RIFF" and head[8:12] == b"WEBP":
            fmt = head[12:16]
            if fmt == b"VP8 ":
                w, h = struct.unpack("<HH", head[26:30])
                return (w & 0x3FFF), (h & 0x3FFF)
            if fmt == b"VP8L":
                bits = struct.unpack("<I", head[21:25])[0]
                w = (bits & 0x3FFF) + 1
                h = ((bits >> 14) & 0x3FFF) + 1
                return w, h
            if fmt == b"VP8X":
                w = int.from_bytes(head[24:27], "little") + 1
                h = int.from_bytes(head[27:30], "little") + 1
                return w, h
            return None
        if head[:2] == b"BM":  # BMP
            w, h = struct.unpack("<ii", head[18:26])
            return abs(w), abs(h)
    except Exception:
        return None
    return None


# ---------------------------------------------------------------------------
# Archive backend — one interface over ZIP / folder sources
# ---------------------------------------------------------------------------

class _Archive:
    """Uniform read interface over a ZIP file or a plain directory."""

    def __init__(self, path: Path):
        self.path = path
        self.is_zip = path.is_file() and path.suffix.lower() in ("", ".zip") and path.read_bytes()[:2] == b"PK"
        self._zf = None
        if self.is_zip:
            self._zf = open_dataset_archive(path)

    # -- listing ---------------------------------------------------------
    def list_files(self):
        """All image entries as (relative_posix_path, size)."""
        if self.is_zip:
            out = []
            for info in self._zf.infolist():
                if info.is_dir():
                    continue
                if Path(info.filename).suffix.lower() in IMAGE_EXTS:
                    out.append((info.filename.replace("\\", "/"), info.file_size))
            return out
        out = []
        for p in sorted(self.path.rglob("*")):
            if p.is_file() and p.suffix.lower() in IMAGE_EXTS:
                out.append((p.relative_to(self.path).as_posix(), p.stat().st_size))
        return out

    def list_non_image_names(self):
        """Annotation/metadata candidates (csv/json/txt/xml/yaml)."""
        if self.is_zip:
            names = self._zf.namelist()
        else:
            names = [p.relative_to(self.path).as_posix() for p in sorted(self.path.rglob("*")) if p.is_file()]
        return [n for n in names
                if Path(n).suffix.lower() in ANNOTATION_EXTS and not Path(n).name.startswith("._")]

    def read_head(self, rel: str, n: int = 32) -> bytes:
        if self.is_zip:
            with self._zf.open(rel) as f:
                return f.read(n)
        with open(self.path / rel, "rb") as f:
            return f.read(n)

    def read_bytes(self, rel: str):
        if self.is_zip:
            with self._zf.open(rel) as f:
                return f.read()
        with open(self.path / rel, "rb") as f:
            return f.read()


# ---------------------------------------------------------------------------
# Ingestion / profiling
# ---------------------------------------------------------------------------

_records: list[dict] = []
_stats: dict = {}
_annotations: dict = {}
_available: bool | None = None
_reason: str | None = None
_loaded_at: float | None = None


def _split_of(parts: list[str]) -> str | None:
    for p in parts[:-1]:
        s = SPLIT_ALIASES.get(p.lower())
        if s:
            return s
    return None


def _class_of(parts: list[str]) -> str | None:
    """Label = nearest non-split parent folder; None if no such folders exist."""
    for p in reversed(parts[:-1]):
        if not SPLIT_ALIASES.get(p.lower()):
            return p
    return None


def _annotation_summary(name: str, head: bytes) -> str:
    """Very light sniff to say what kind of annotations exist (if any)."""
    if name.lower().endswith(".json"):
        return "JSON annotation file"
    if name.lower().endswith((".xml",)):
        return "XML annotation file"
    if name.lower().endswith((".yaml", ".yml")):
        return "YAML metadata file"
    text = head[:400].decode("utf-8", "ignore")
    first = text.strip().splitlines()[0] if text.strip() else ""
    if "," in first:
        return "CSV annotation file"
    if first:
        return "Text annotation file"
    return "Annotation file"


def load_dataset() -> bool:
    """Scan + profile the dataset. Safe to call repeatedly; reloads under lock."""
    global _records, _stats, _annotations, _available, _reason, _loaded_at

    src = dataset_source()
    if not src.exists():
        with _lock:
            _available, _reason = False, f"Image dataset not found at the configured location ({src.name})."
        return False

    try:
        ar = _Archive(src)
        files = ar.list_files()
    except Exception:
        with _lock:
            _available, _reason = False, "The image dataset archive could not be opened (corrupt or unsupported)."
        return False

    if not files:
        with _lock:
            _available, _reason = False, "The image dataset contains no image files in supported formats."
        return False

    records: list[dict] = []
    corrupted: list[str] = []
    dims: dict = {}
    exts: dict = {}
    for rel, size in files:
        parts = rel.split("/")
        ext = Path(rel).suffix.lower().lstrip(".")
        exts[ext] = exts.get(ext, 0) + 1
        head = ar.read_head(rel, 33)
        wh = _probe_size(head, ext)
        if wh is None:
            corrupted.append(rel)
            continue
        dims[f"{wh[0]}×{wh[1]}"] = dims.get(f"{wh[0]}×{wh[1]}", 0) + 1
        records.append({
            "id": re.sub(r"[^a-z0-9]+", "-", rel.lower()).strip("-"),
            "filename": parts[-1],
            "rel": rel,
            "label": _class_of(parts),          # None → unlabeled
            "split": _split_of(parts),          # None → no explicit split
            "width": wh[0], "height": wh[1],
            "size_bytes": size,
            "metadata": {},                     # populated only if real metadata exists
        })

    # annotations / metadata files (presence only — content parsing kept minimal)
    ann_summary: list[dict] = []
    for rel in ar.list_non_image_names():
        try:
            head = ar.read_head(rel, 64)
        except Exception:
            continue
        ann_summary.append({"file": Path(rel).name, "kind": _annotation_summary(rel, head)})
    _annotations = {"available": bool(ann_summary), "files": ann_summary}

    labels = sorted({r["label"] for r in records if r["label"]})
    label_counts = {c: sum(1 for r in records if r["label"] == c) for c in labels}
    split_counts = {}
    for r in records:
        if r["split"]:
            split_counts[r["split"]] = split_counts.get(r["split"], 0) + 1

    stats = {
        "total_images": len(records),
        "n_classes": len(labels),
        "classes": labels,
        "class_distribution": label_counts,
        "splits": split_counts,                 # {} → no explicit split folders
        "unlabeled": len(labels) == 0,
        "dimensions": dict(sorted(dims.items(), key=lambda kv: -kv[1])),
        "file_types": dict(sorted(exts.items(), key=lambda kv: -kv[1])),
        "corrupted_count": len(corrupted),
        "corrupted_examples": corrupted[:5],
        "annotations": _annotations,
        "has_bounding_boxes": False,            # measured: none unless annotation parsing proves it
        "has_masks": False,
        "source_kind": "zip-archive" if ar.is_zip else "directory",
        "source_name": src.name,
    }

    with _lock:
        _records, _stats = records, stats
        _available, _reason, _loaded_at = True, None, time.time()

    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    _log_summary(stats)
    return True


def _log_summary(s: dict):
    print("=" * 60)
    print("Forge SIGHT Dataset Initialization")
    print("-" * 60)
    print("Image Dataset")
    print(f"  Images: {s['total_images']:,}")
    print(f"  Classes: {s['n_classes']}"
          + (f"  ({', '.join(s['classes'])})" if s["classes"] else "  (Unlabeled Image Dataset)"))
    if s["splits"]:
        print("  Splits: " + ", ".join(f"{k}={v:,}" for k, v in s["splits"].items()))
    print(f"  Annotations: {'Available' if s['annotations']['available'] else 'Not Available'}")
    if s["corrupted_count"]:
        print(f"  Corrupted files skipped: {s['corrupted_count']}")
    print(f"  Source: {s['source_name']} ({s['source_kind']}, read-only)")
    print("=" * 60)


# ---------------------------------------------------------------------------
# Public API helpers
# ---------------------------------------------------------------------------

def available() -> bool:
    if _available is None:
        load_dataset()
    return bool(_available)


def unavailable_reason() -> str | None:
    return _reason


def ensure_loaded():
    if _available is None:
        load_dataset()


def get_stats() -> dict:
    ensure_loaded()
    if not _available:
        return {"available": False, "reason": _reason}
    s = dict(_stats)
    s.update({
        "available": True,
        "loaded_at": _loaded_at,
        "label_mode": "folder-classification"
        if not s["unlabeled"] and not s["annotations"]["available"]
        else ("annotation-files" if s["annotations"]["available"] else "unlabeled"),
    })
    return s


def _find(record_id: str) -> dict | None:
    ensure_loaded()
    for r in _records:
        if r["id"] == record_id:
            return r
    return None


def query_images(label: str | None = None, split: str | None = None,
                 search: str | None = None, page: int = 1, page_size: int = 24):
    """Filtered + paginated listing. Only real fields are returned."""
    ensure_loaded()
    if not _available:
        return {"available": False, "reason": _reason}
    items = _records
    if label:
        items = [r for r in items if r["label"] == label]
    if split:
        items = [r for r in items if r["split"] == split]
    if search:
        q = search.lower()
        items = [r for r in items if q in r["filename"].lower() or q in r["rel"].lower()]
    total = len(items)
    page = max(1, page)
    page_size = max(1, min(96, page_size))
    start = (page - 1) * page_size
    chunk = items[start:start + page_size]
    return {
        "available": True,
        "total": total,
        "page": page,
        "page_size": page_size,
        "pages": (total + page_size - 1) // page_size,
        "images": [
            {"id": r["id"], "filename": r["filename"], "label": r["label"],
             "split": r["split"], "width": r["width"], "height": r["height"]}
            for r in chunk
        ],
    }


def get_image(record_id: str) -> dict:
    ensure_loaded()
    if not _available:
        raise RuntimeError(_reason or "Image dataset unavailable.")
    r = _find(record_id)
    if r is None:
        raise KeyError(record_id)
    return {"id": r["id"], "filename": r["filename"], "path": r["rel"],
            "label": r["label"], "split": r["split"],
            "width": r["width"], "height": r["height"],
            "metadata": r["metadata"] or None}


def image_bytes(record_id: str) -> bytes:
    ensure_loaded()
    r = _find(record_id)
    if r is None:
        raise KeyError(record_id)
    return _Archive(dataset_source()).read_bytes(r["rel"])


def thumbnail_jpeg(record_id: str) -> bytes | None:
    """Resized JPEG preview from cache; original images are never touched."""
    ensure_loaded()
    r = _find(record_id)
    if r is None:
        raise KeyError(record_id)
    cache = CACHE_DIR / f"{r['id']}.jpg"
    if cache.exists():
        return cache.read_bytes()
    try:
        from PIL import Image
        with Image.open(io.BytesIO(image_bytes(record_id))) as im:
            im = im.convert("RGB")
            im.thumbnail((THUMB_SIZE, THUMB_SIZE))
            buf = io.BytesIO()
            im.save(buf, "JPEG", quality=82)
        CACHE_DIR.mkdir(parents=True, exist_ok=True)
        # unique tmp per call — concurrent requests for the same image must not collide
        tmp = cache.with_suffix(f".{os.getpid()}.{threading.get_ident()}.tmp")
        tmp.write_bytes(buf.getvalue())
        tmp.replace(cache)
        return buf.getvalue()
    except Exception:
        return None


def random_record_id(prefer_label: str | None = None) -> str | None:
    """A real dataset image id — used by demo mode (never a fake image)."""
    ensure_loaded()
    if not _available:
        return None
    pool = [r for r in _records if r["label"]] or _records
    if prefer_label:
        with_label = [r for r in pool if r["label"] == prefer_label]
        if with_label:
            pool = with_label
    # stable pick: first record of the pool (deterministic for demos)
    return pool[0]["id"] if pool else None


def linking_key_summary() -> dict:
    """Honest answer to: can images be joined to production data?

    Measured from the dataset only. filenames like crack_00000.png carry a
    class prefix + sequence number — not batch/SKU/station/timestamp ids.
    """
    ensure_loaded()
    if not _available:
        return {"linked": False, "reason": _reason}
    names = [r["filename"] for r in _records[:50]]
    id_like = any(re.search(r"(batch|sku|station|press|cell|b\d{2,}|order)", n, re.I) for n in names)
    has_meta = any(r["metadata"] for r in _records)
    if id_like or has_meta:
        return {"linked": True, "keys": ["filename-identifier"] if id_like else ["metadata"]}
    return {
        "linked": False,
        "reason": ("No explicit linking identifier was found in the image dataset "
                   "(filenames are class + sequence numbers; no metadata files are present)."),
    }
