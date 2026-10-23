# -*- coding: utf-8 -*-
"""scraper/quality_gate.py::score_listing / is_safe_to_auto_approve testleri
(ATDD EML-59, AC-3..10).

Not: quality_gate.py mevcut davranışı DEĞİŞTİRİLMİYOR, sadece test ekleniyor
(GREEN geçmeli).
"""

import pytest

from quality_gate import is_safe_to_auto_approve, score_listing


def _valid_listing(**overrides):
    base = {
        "price": 1000000,
        "rooms": "2+1",
        "area_m2": 90,
        "city": "İstanbul",
    }
    base.update(overrides)
    return base


# ---------------------------------------------------------------------------
# AC-3: happy path -> score=1.0, issues=[]
# ---------------------------------------------------------------------------

def test_valid_listing_returns_score_1_and_no_issues():
    score, issues = score_listing(_valid_listing())

    assert score == 1.0
    assert issues == []


# ---------------------------------------------------------------------------
# AC-4: price<=0 veya price>500_000_000 -> "price_out_of_range", -0.4
# ---------------------------------------------------------------------------

@pytest.mark.parametrize("bad_price", [0, -1, 500_000_001])
def test_price_out_of_range_adds_issue_and_subtracts_0_4(bad_price):
    score, issues = score_listing(_valid_listing(price=bad_price))

    assert issues == ["price_out_of_range"]
    assert score == 0.6


# ---------------------------------------------------------------------------
# AC-5: price=None -> "price_missing", -0.1 (price_out_of_range ile AYRI)
# ---------------------------------------------------------------------------

def test_price_missing_adds_price_missing_issue_and_subtracts_0_1():
    score, issues = score_listing(_valid_listing(price=None))

    assert issues == ["price_missing"]
    assert score == 0.9


def test_price_missing_and_price_out_of_range_never_both_appear():
    """price=None -> yalnızca price_missing; price=0 -> yalnızca price_out_of_range."""
    _, issues_missing = score_listing(_valid_listing(price=None))
    _, issues_out_of_range = score_listing(_valid_listing(price=0))

    assert "price_out_of_range" not in issues_missing
    assert "price_missing" not in issues_out_of_range


# ---------------------------------------------------------------------------
# AC-6: rooms formatı ROOM_PATTERN'e uymuyor -> "rooms_format_unexpected", -0.1
# ---------------------------------------------------------------------------

def test_rooms_format_unexpected_adds_issue_and_subtracts_0_1():
    score, issues = score_listing(_valid_listing(rooms="abc"))

    assert issues == ["rooms_format_unexpected"]
    assert score == 0.9


def test_rooms_matching_pattern_does_not_add_issue():
    score, issues = score_listing(_valid_listing(rooms="3+1"))

    assert "rooms_format_unexpected" not in issues
    assert score == 1.0


def test_rooms_none_does_not_add_issue():
    score, issues = score_listing(_valid_listing(rooms=None))

    assert "rooms_format_unexpected" not in issues
    assert score == 1.0


# ---------------------------------------------------------------------------
# AC-7: area_m2<=0 veya >10_000 -> "area_out_of_range", -0.2
# ---------------------------------------------------------------------------

@pytest.mark.parametrize("bad_area", [0, -5, 10_001])
def test_area_out_of_range_adds_issue_and_subtracts_0_2(bad_area):
    score, issues = score_listing(_valid_listing(area_m2=bad_area))

    assert issues == ["area_out_of_range"]
    assert score == 0.8


def test_area_none_does_not_add_issue():
    score, issues = score_listing(_valid_listing(area_m2=None))

    assert "area_out_of_range" not in issues
    assert score == 1.0


# ---------------------------------------------------------------------------
# AC-8: city boş/None -> "city_missing", -0.3
# ---------------------------------------------------------------------------

@pytest.mark.parametrize("bad_city", [None, ""])
def test_city_missing_or_empty_adds_issue_and_subtracts_0_3(bad_city):
    score, issues = score_listing(_valid_listing(city=bad_city))

    assert issues == ["city_missing"]
    assert score == 0.7


# ---------------------------------------------------------------------------
# AC-9: birden fazla sorun -> kümülatif toplam, 0'ın altına düşerse 0.0'da clamp
# ---------------------------------------------------------------------------

def test_multiple_issues_are_cumulative_in_check_order():
    # price_missing(-0.1) + area_out_of_range(-0.2) + city_missing(-0.3) = -0.6
    # 1.0 - 0.6 = 0.4
    score, issues = score_listing(
        _valid_listing(price=None, area_m2=20_000, city=None)
    )

    assert score == 0.4
    assert issues == ["price_missing", "area_out_of_range", "city_missing"]


def test_all_possible_issues_combined_clamp_to_zero_not_negative():
    # price_out_of_range(-0.4) + rooms_format_unexpected(-0.1)
    # + area_out_of_range(-0.2) + city_missing(-0.3) = -1.0 -> score tam 0.0
    score, issues = score_listing(
        {
            "price": -1,
            "rooms": "abc",
            "area_m2": 20_000,
            "city": None,
        }
    )

    assert score == 0.0
    assert score >= 0.0
    assert issues == [
        "price_out_of_range",
        "rooms_format_unexpected",
        "area_out_of_range",
        "city_missing",
    ]


# ---------------------------------------------------------------------------
# AC-10: is_safe_to_auto_approve sınır testi — >= eşik True, < eşik False
# ---------------------------------------------------------------------------

def test_is_safe_to_auto_approve_above_default_threshold_is_true():
    assert is_safe_to_auto_approve(0.6) is True


def test_is_safe_to_auto_approve_below_default_threshold_is_false():
    assert is_safe_to_auto_approve(0.4) is False


def test_is_safe_to_auto_approve_exactly_at_default_threshold_is_true():
    assert is_safe_to_auto_approve(0.5) is True


def test_is_safe_to_auto_approve_with_custom_threshold():
    assert is_safe_to_auto_approve(0.8, threshold=0.9) is False
    assert is_safe_to_auto_approve(0.9, threshold=0.9) is True
    assert is_safe_to_auto_approve(0.95, threshold=0.9) is True
