# -*- coding: utf-8 -*-
"""Gemini'ye gitmeden önce yalnız açıkça ilan olmayan mesajları eler (AC-5).

Yanlış negatif (gerçek ilanı eleme) riskini sıfırlamak için liste bilerek kısa tutulur:
boş metin veya tam olarak bu selamlaşma/teşekkür ifadelerinden oluşan mesaj.
"""

from typing import Any

_NOT_LISTING_PHRASES = frozenset(
    {
        "merhaba",
        "selam",
        "selamlar",
        "iyi günler",
        "teşekkürler",
        "teşekkür ederim",
        "teşekkür ederiz",
        "sağ olun",
        "sağ ol",
    }
)


def is_obviously_not_listing(text: Any) -> bool:
    cleaned = " ".join((text or "").split()).lower().rstrip(".!?… ")
    return cleaned == "" or cleaned in _NOT_LISTING_PHRASES
