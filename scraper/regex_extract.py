# -*- coding: utf-8 -*-
"""Açık ve tek anlamlı fiyat/para birimi, alan (m²) ve oda değerlerini çıkarır (AC-6).

Belirsizlikte alan çıkarılmaz: birden çok farklı aday, metinde net/brüt ayrımı
(fiyat ve alan için) veya hiç eşleşme yoksa o alan sonuçta anahtar olarak bulunmaz.
Telefon, URL ve ilan numaraları önce metinden çıkarılır.
"""

import re
from typing import Any, Dict

_URL = re.compile(r"(?:https?://|www\.)\S+", re.IGNORECASE)
_PHONE = re.compile(r"(?:\+?90|0)?\s?5\d{2}[\s.-]?\d{3}[\s.-]?\d{2}[\s.-]?\d{2}(?!\d)")
_LISTING_NO = re.compile(r"[İiIı]lan\s*no\s*:?\s*\d+", re.IGNORECASE)
_PRICE = re.compile(r"(?<![\d.,])(\d{1,3}(?:\.\d{3})+|\d+)(,\d+)?\s*(?:TL|₺)(?!\w)", re.IGNORECASE)
_AREA = re.compile(r"(?<![\d.,])(\d{1,5})\s*m(?:²|2)(?!\w)", re.IGNORECASE)
_COMPOUND_ROOMS = re.compile(r"\d{1,2}(?:\s*\+\s*\d{1,2}){2,}")
_ROOMS = re.compile(r"(?<![\d+])(\d{1,2})\s*\+\s*(\d{1,2})(?!\d)")
_NET_OR_GROSS = re.compile(r"\b(?:net|br[üu]t)\b", re.IGNORECASE)


def _money(whole: str, decimals: str) -> float:
    if decimals:
        return float(f"{whole.replace('.', '')}.{decimals[1:]}")
    return int(whole.replace(".", ""))


def _single(values: list) -> Any:
    """Tek bir farklı değer varsa onu, yoksa ya da birden çoksa None döner."""
    distinct = set(values)
    return distinct.pop() if len(distinct) == 1 else None


def extract_fields(text: str) -> Dict[str, Any]:
    cleaned = _PHONE.sub(" ", _URL.sub(" ", _LISTING_NO.sub(" ", text or "")))
    cleaned = _COMPOUND_ROOMS.sub(" ", cleaned)
    result: Dict[str, Any] = {}

    if not _NET_OR_GROSS.search(cleaned):
        price = _single([_money(whole, decimals) for whole, decimals in _PRICE.findall(cleaned)])
        if price is not None:
            result["price"] = price
            result["currency"] = "TRY"

        area = _single([int(value) for value in _AREA.findall(cleaned)])
        if area is not None:
            result["area_m2"] = area

    rooms = _single([f"{first}+{second}" for first, second in _ROOMS.findall(cleaned)])
    if rooms is not None:
        result["rooms"] = rooms
    return result
