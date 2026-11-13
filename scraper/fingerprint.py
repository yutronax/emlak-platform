# -*- coding: utf-8 -*-
"""İlan parmak izi: aynı ilanın farklı gruplarda/zamanlarda tekrar
paylaşılmasını yakalamak için konum+fiyat+oda+m2 normalize edilip hash'lenir.

maviLojistik/src/services/submission_queue.py'deki fingerprint desenine karşılık gelir.

Yeterli bilgi yoksa (bkz. _has_sufficient_info) farklı ilanlar aynı hash'e düşer; bu durumda
normalize edilmiş ham mesaj metninin hash'i karıştırılır (raw_text verilmişse). Yeterli bilgili
girdilerde çıktı eski algoritmayla birebir aynıdır (tek fark: integral float -> int yazımı).
"""

import hashlib
import re
import unicodedata
from typing import Any, Dict, Optional

# Hash'e giren beş alandan en az bu kadarı dolu olmalı VE en az biri sayısal (fiyat / m2) olmalı.
# Gerekçe: yalnız konum/oda ("İstanbul|Kadıköy|2+1||") ya da 1-2 alan, aynı bölgedeki farklı
# ilanları tek hash'e indirger; fiyat veya m2 olmadan ilan ayırt edilemez.
MIN_FINGERPRINT_FIELDS = 3
_NUMERIC_INDEXES = (3, 4)


def _normalize(value: str) -> str:
    value = unicodedata.normalize("NFKD", value.lower().strip())
    value = "".join(c for c in value if not unicodedata.combining(c))
    return re.sub(r"\s+", "", value)


def _number(value: Any) -> str:
    """Sayıyı kararlı yazar: integral float (2500000.0) int ile aynı ("2500000"); diğerleri str()."""
    if isinstance(value, float) and value.is_integer():
        return str(int(value))
    return str(value)


def _has_sufficient_info(parts: list) -> bool:
    filled = sum(1 for part in parts if part)
    return filled >= MIN_FINGERPRINT_FIELDS and any(parts[i] for i in _NUMERIC_INDEXES)


def compute_fingerprint(parsed: Dict[str, Any], raw_text: Optional[str] = None) -> str:
    parts = [
        _normalize(str(parsed.get("city") or "")),
        _normalize(str(parsed.get("district") or "")),
        _normalize(str(parsed.get("rooms") or "")),
        _number(parsed.get("price") or ""),
        _number(parsed.get("area_m2") or ""),
    ]
    raw = "|".join(parts)
    text = _normalize(raw_text) if isinstance(raw_text, str) else ""
    if text and not _has_sufficient_info(parts):
        raw += "|t:" + hashlib.sha256(text.encode("utf-8")).hexdigest()
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()
