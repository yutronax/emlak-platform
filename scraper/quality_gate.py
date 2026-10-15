# -*- coding: utf-8 -*-
"""Emlak ilanı için kural-bazlı doğrulama (quality gate).

maviLojistik/src/utils/quality_gate.py'deki "ayrı LLM ile gözlemci ajan"
deseninin aksine, burada MVP için ucuz/hızlı kural-bazlı bir skor kullanılıyor
(fiyat/oda/m2 tutarlılığı). İkinci bir LLM çağrısı sonraki fazda eklenebilir.
"""

import re
from typing import Any, Dict, Tuple

ROOM_PATTERN = re.compile(r"^\d+\+\d+(\s?\(?\w*\)?)?$")


def score_listing(parsed: Dict[str, Any]) -> Tuple[float, list]:
    """0-1 güven skoru + sorun listesi döndürür."""
    issues = []
    score = 1.0

    price = parsed.get("price")
    if price is not None:
        if price <= 0 or price > 500_000_000:
            issues.append("price_out_of_range")
            score -= 0.4
    else:
        issues.append("price_missing")
        score -= 0.1

    rooms = parsed.get("rooms")
    if rooms and not ROOM_PATTERN.match(rooms.strip()):
        issues.append("rooms_format_unexpected")
        score -= 0.1

    area_m2 = parsed.get("area_m2")
    if area_m2 is not None and (area_m2 <= 0 or area_m2 > 10_000):
        issues.append("area_out_of_range")
        score -= 0.2

    if not parsed.get("city"):
        issues.append("city_missing")
        score -= 0.3

    return max(0.0, round(score, 2)), issues


def is_safe_to_auto_approve(score: float, threshold: float = 0.5) -> bool:
    return score >= threshold
