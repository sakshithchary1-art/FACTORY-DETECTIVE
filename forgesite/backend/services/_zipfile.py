"""ZIP reader for the supplied image dataset.

Prefers the Python stdlib zipfile module. Any decompression backend can be
swapped here without touching the ingestion service.
"""

from __future__ import annotations

import zipfile


def open_dataset_archive(path):
    return zipfile.ZipFile(path)
