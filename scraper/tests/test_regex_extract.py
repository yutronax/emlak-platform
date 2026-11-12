# -*- coding: utf-8 -*-
"""scraper/regex_extract.py::extract_fields testleri (ATDD gemini-parse-maliyet).

Kapsam: AC-6 (açık ve tek anlamlı price+currency, area_m2, rooms; telefon, URL
ve ilan no hariç), AC-7/AC-8 için belirsizlik kuralı (birden çok aday, net/brüt
ayrımı -> o alan çıkarılmaz). Davranış Sözleşmesi satır 4 regex tarafı.

Kontrat varsayımı: çıkarılamayan alan sonuç sözlüğünde HİÇ anahtar olarak bulunmaz
("o alan yok (çıkarılmaz)"); sonuç tam sözlük olarak karşılaştırılır.

Red step: scraper/regex_extract.py henüz yok; her test ImportError ile başarısız olmalı.
"""

import pytest


def _extract(text):
    from regex_extract import extract_fields

    return extract_fields(text)


# ---------------------------------------------------------------------------
# Açık değerlerin doğru türlere dönüştürülmesi
# ---------------------------------------------------------------------------


def test_price_with_thousand_separators_and_try_currency():
    assert _extract("2.500.000 TL") == {"price": 2500000, "currency": "TRY"}


def test_price_currency_is_case_insensitive():
    assert _extract("2.500.000 tl") == {"price": 2500000, "currency": "TRY"}


def test_area_with_superscript_m2_returns_integer_120():
    assert _extract("120 m²") == {"area_m2": 120}


def test_area_with_plain_m2_returns_integer_120():
    assert _extract("120 m2") == {"area_m2": 120}


def test_rooms_plus_notation_kept_as_string():
    assert _extract("3+1") == {"rooms": "3+1"}


def test_rooms_inside_sentence_extracted_as_2_plus_1():
    assert _extract("Satılık 2+1 daire") == {"rooms": "2+1"}


def test_all_four_explicit_fields_extracted_together():
    text = "Satılık 3+1 daire 120 m² 2.500.000 TL Kadıköy"
    assert _extract(text) == {
        "price": 2500000,
        "currency": "TRY",
        "area_m2": 120,
        "rooms": "3+1",
    }


def test_no_explicit_fields_returns_empty_dict():
    assert _extract("satılık daire kadıköy temiz") == {}


# ---------------------------------------------------------------------------
# Telefon, URL ve ilan numarası fiyat/alan olarak yorumlanmaz
# ---------------------------------------------------------------------------


def test_phone_number_alone_is_not_price_or_area():
    assert _extract("0532 111 22 33") == {}


def test_phone_number_does_not_pollute_real_price():
    assert _extract("0532 111 22 33 2.500.000 TL") == {"price": 2500000, "currency": "TRY"}


def test_url_number_followed_by_try_is_not_price():
    assert _extract("https://ornek.example/ilan/2500000 TL") == {}


def test_number_without_currency_is_not_price():
    assert _extract("fiyat 2500000") == {}


# ---------------------------------------------------------------------------
# Belirsizlik: birden çok aday / net-brüt -> o alan çıkarılmaz
# ---------------------------------------------------------------------------


def test_two_price_candidates_yield_no_price_or_currency():
    assert _extract("2.500.000 TL veya 2.300.000 TL") == {}


def test_net_and_gross_price_yield_no_price_or_currency():
    assert _extract("2.500.000 TL net 3.000.000 TL brüt") == {}


def test_two_area_candidates_yield_no_area():
    assert _extract("120 m² 150 m²") == {}


def test_net_and_gross_area_yield_no_area():
    assert _extract("120 m² net 150 m² brüt") == {}


def test_two_room_candidates_yield_no_rooms():
    assert _extract("2+1 veya 3+1") == {}


def test_ambiguity_in_one_field_does_not_block_unambiguous_field():
    result = _extract("2+1 veya 3+1, 120 m²")
    assert result == {"area_m2": 120}


def test_currency_word_without_amount_is_not_extracted():
    assert _extract("TL") == {}


# ---------------------------------------------------------------------------
# Determinizm
# ---------------------------------------------------------------------------


def test_extraction_is_deterministic_for_same_input():
    text = "Satılık 3+1 daire 120 m² 2.500.000 TL"
    assert _extract(text) == _extract(text)


@pytest.mark.parametrize("text", ["", "   "])
def test_empty_or_blank_text_returns_empty_dict(text):
    assert _extract(text) == {}


# ---------------------------------------------------------------------------
# AC-6 ek: ilan numarası fiyat değildir; birleşik oda ifadesi belirsizdir
# ---------------------------------------------------------------------------


def test_ilan_no_followed_by_tl_is_not_price_or_currency():
    """Madde 1: "Ilan no: 123456 TL" ilan numarasıdır, fiyat değildir; alan anahtarı yok."""
    assert _extract("Ilan no: 123456 TL, satilik daire") == {}


def test_turkish_ilan_no_without_colon_followed_by_tl_is_not_price():
    """Madde 2: Türkçe "İlan No" (büyük İ, iki nokta yok) ilan numarasıdır; fiyat anahtarı yok."""
    assert _extract("İlan No 987654 TL") == {}


def test_compound_rooms_3_plus_1_plus_1_yields_no_rooms():
    """Madde 3: "3+1+1" birleşik oda ifadesi belirsizdir; rooms anahtarı yok."""
    assert _extract("Satilik 3+1+1 daire") == {}


def test_regression_explicit_fields_with_thousand_separators_exact_dict():
    """Madde 4 (regresyon): açık değerler tam sözlük olarak çıkarılır."""
    assert _extract("Satilik 3+1 daire 2.500.000 TL 120 m2") == {
        "price": 2500000,
        "currency": "TRY",
        "rooms": "3+1",
        "area_m2": 120,
    }


# ---------------------------------------------------------------------------
# AC-6 ek (red-team F): boşluklu birleşik oda ifadesi belirsizdir
# ---------------------------------------------------------------------------


def test_spaced_compound_rooms_3_plus_1_plus_1_with_spaces_yields_no_rooms():
    """"Satilik 3 + 1 + 1 daire": birleşik oda ifadesi, boşluklu biçimde de belirsiz; rooms yok."""
    assert _extract("Satilik 3 + 1 + 1 daire") == {}


def test_adjacent_compound_rooms_2_plus_1_plus_1_yields_no_rooms():
    """"Satilik 2+1+1 daire": bitişik birleşik ifade; ortadaki 2+1 parçası da tek başına kabul edilmez."""
    assert _extract("Satilik 2+1+1 daire") == {}


def test_spaced_single_rooms_3_plus_1_with_spaces_is_kept_as_3_plus_1():
    """Regresyon: tek ve boşluklu "3 + 1" açık bir oda ifadesidir; "3+1" olarak çıkarılır."""
    assert _extract("Satilik 3 + 1 daire") == {"rooms": "3+1"}
