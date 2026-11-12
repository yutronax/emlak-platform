# -*- coding: utf-8 -*-
"""Ayrıştırma çıktısı sözleşmesi (AC-12). Parser ve önbellek ortak kullanır."""

import math
from typing import Any, Dict, Optional

NULLABLE_FIELDS = (
    "title",
    "price",
    "currency",
    "rooms",
    "area_m2",
    "city",
    "district",
    "neighborhood",
    "description",
)
_NUMERIC_FIELDS = ("price", "area_m2")
_TEXT_FIELDS = ("title", "rooms", "city", "district", "neighborhood", "description")
_ALLOWED_KEYS = frozenset(("is_listing",) + NULLABLE_FIELDS)


def _is_finite_number(value: Any) -> bool:
    if not isinstance(value, (int, float)) or isinstance(value, bool):
        return False
    try:
        return math.isfinite(value)
    except OverflowError:
        return False


def validate_parsed(obj: Any) -> Optional[Dict[str, Any]]:
    """Şemaya uyan nesneyi eksik nullable alanlar None ile tamamlanmış yeni dict olarak döndürür.

    Şema dışı, yanlış türde veya sonlu olmayan değer içeren girdi için None döner.
    """
    if not isinstance(obj, dict) or not set(obj) <= _ALLOWED_KEYS:
        return None
    is_listing = obj.get("is_listing")
    if not isinstance(is_listing, bool):
        return None

    result: Dict[str, Any] = {"is_listing": is_listing}
    for field in _NUMERIC_FIELDS:
        value = obj.get(field)
        if value is not None and not _is_finite_number(value):
            return None
        result[field] = value
    for field in _TEXT_FIELDS:
        value = obj.get(field)
        if value is not None and not isinstance(value, str):
            return None
        result[field] = value

    currency = obj.get("currency")
    if currency is not None and currency != "TRY":
        return None
    result["currency"] = currency
    return result
