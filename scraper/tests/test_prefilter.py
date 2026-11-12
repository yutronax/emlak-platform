# -*- coding: utf-8 -*-
"""scraper/prefilter.py::is_obviously_not_listing testleri (ATDD gemini-parse-maliyet).

Kapsam: AC-5 ve Davranış Sözleşmesi satır 3 (ön-eleme). Boş metin ve yalnız
açık selamlaşma/teşekkür mesajı True; belirsiz veya ilan içeren mesaj False.
Yanlış negatif hedefi (%0): gerçek ilan metni asla True dönmez.

Red step: scraper/prefilter.py henüz yok; her test ImportError ile başarısız olmalı.
"""

import pytest


def _is_obviously_not_listing(text):
    from prefilter import is_obviously_not_listing

    return is_obviously_not_listing(text)


# ---------------------------------------------------------------------------
# True: boş metin ve yalnız selamlaşma/teşekkür
# ---------------------------------------------------------------------------


def test_empty_text_is_obviously_not_listing():
    assert _is_obviously_not_listing("") is True


def test_whitespace_only_text_is_obviously_not_listing():
    assert _is_obviously_not_listing("   \n\t  ") is True


@pytest.mark.parametrize("greeting", ["merhaba", "selam", "teşekkürler", "teşekkür ederim"])
def test_pure_greeting_or_thanks_is_obviously_not_listing(greeting):
    assert _is_obviously_not_listing(greeting) is True


def test_greeting_surrounded_by_whitespace_is_still_obviously_not_listing():
    assert _is_obviously_not_listing("  merhaba\n") is True


# ---------------------------------------------------------------------------
# False: belirsiz veya ilan içeren mesaj ayrıştırmaya devam eder
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "text",
    [
        "merhaba 2+1 daire 2.500.000 TL Kadıköy",
        "selam satılık daire 120 m2",
        "teşekkürler, kiralık 1+1 daire var",
        "merhaba satılık daire kadıköy temiz",
    ],
)
def test_greeting_combined_with_listing_content_is_not_prefiltered(text):
    assert _is_obviously_not_listing(text) is False


def test_ambiguous_question_is_not_prefiltered():
    assert _is_obviously_not_listing("bu daire hala satılık mı") is False


def test_phone_only_message_is_not_prefiltered():
    assert _is_obviously_not_listing("0532 111 22 33") is False


def test_url_only_message_is_not_prefiltered():
    assert _is_obviously_not_listing("https://ornek.example/ilan/123") is False


def test_long_non_greeting_message_is_not_prefiltered():
    assert _is_obviously_not_listing("merhaba " + "x" * 500) is False


@pytest.mark.parametrize(
    "listing_text",
    [
        "Satılık 3+1 daire Kadıköy 120 m2 2.500.000 TL",
        "Kiralık 2+1 eşyalı daire, Beşiktaş, 15.000 TL",
        "Satılık arsa Çekmeköy 500 m² 0532 111 22 33",
        "3+1 dubleks satılık, Üsküdar, net 130 m²",
        "Acil satılık daire fiyat 1.800.000 TL pazarlık yok",
    ],
)
def test_real_listing_text_is_never_prefiltered(listing_text):
    """Yanlış negatif hedefi: gerçek ilan ön-elemede reddedilmez (AC-5, %0)."""
    assert _is_obviously_not_listing(listing_text) is False


def test_result_is_strict_bool():
    result = _is_obviously_not_listing("merhaba")
    assert type(result) is bool
    assert result is True
