# -*- coding: utf-8 -*-
"""İlan parmak izi: aynı ilanın farklı gruplarda/zamanlarda tekrar
paylaşılmasını yakalamak için konum+fiyat+oda+m2 normalize edilip hash'lenir.

maviLojistik/src/services/submission_queue.py'deki fingerprint desenine karşılık gelir.
"""

import hashlib
import re
import unicodedata
from typing import Any, Dict


def _normalize(value: str) -> str:
    value = unicodedata.normalize("NFKD", value.lower().strip())
    value = "".join(c for c in value if not unicodedata.combining(c))
    return re.sub(r"\s+", "", value)


def compute_fingerprint(parsed: Dict[str, Any]) -> str:
    parts = [
        _normalize(str(parsed.get("city") or "")),
        _normalize(str(parsed.get("district") or "")),
        _normalize(str(parsed.get("rooms") or "")),
        str(parsed.get("price") or ""),
        str(parsed.get("area_m2") or ""),
    ]
    raw = "|".join(parts)
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()
