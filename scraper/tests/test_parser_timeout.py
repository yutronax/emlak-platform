# -*- coding: utf-8 -*-
"""scraper/parser.py::parse_listing_message Gemini timeout testleri
(ATDD EML-66, AC-3/AC-4, Davranış Sözleşmesi #3 ve #4).

ZORUNLU mock-patch kuralı: parser.py `from google import genai` ile import
ediyor -> patch hedefi `parser.genai` (google.genai DEĞİL).

Timeout doğrulama stratejisi: Python thread'i zorla kesemez; asıl timeout
google.genai SDK'sının HTTP client'ında `http_options.timeout` (MİLİSANİYE,
30000 = 30s) ile uygulanır. Bu yüzden AC-3 testi, genai.Client constructor'ına
GERÇEKTEN `http_options=HttpOptions(timeout=30000)` geçildiğini mock çağrı
argümanları üzerinden kanıtlar (sadece "None döner" yeterli değil).

Beklenen durum: AC-3 testi BAŞARISIZ (red) — parser.py henüz http_options
geçmiyor. AC-4 regresyon testi mevcut davranış üzerinden GREEN geçmeli.
"""

import asyncio
import json
from unittest.mock import MagicMock, patch

from google.genai import types as genai_types

from api_key_manager import GeminiKeyManager
from parser import parse_listing_message

EXPECTED_TIMEOUT_MS = 30000

VALID_LISTING_JSON = json.dumps(
    {
        "is_listing": True,
        "title": "Satılık daire",
        "price": 2500000,
        "currency": "TRY",
        "rooms": "3+1",
        "area_m2": 120,
        "city": "İstanbul",
        "district": "Kadıköy",
        "neighborhood": None,
        "description": "temiz daire",
    }
)


def _make_key_manager(monkeypatch, keys="test-key-1"):
    monkeypatch.setenv("GEMINI_API_KEYS", keys)
    manager = GeminiKeyManager()
    manager.load_keys()
    return manager


def _mock_response(text):
    response = MagicMock()
    response.text = text
    return response


def _run(coro):
    return asyncio.run(coro)


# ---------------------------------------------------------------------------
# AC-3 [Critical]: genai.Client, timeout'lu HttpOptions ile oluşturulmalı
# ---------------------------------------------------------------------------

def test_ac3_genai_client_is_constructed_with_http_timeout_30000ms(monkeypatch):
    manager = _make_key_manager(monkeypatch)

    with patch("parser.genai") as mocked_genai:
        mocked_client = MagicMock()
        mocked_client.models.generate_content.return_value = _mock_response(VALID_LISTING_JSON)
        mocked_genai.Client.return_value = mocked_client

        _run(parse_listing_message("2+1 daire 2.500.000 TL Kadıköy", manager))

    # Mock'un GERÇEKTEN bu argümanla çağrıldığını kanıtla.
    assert mocked_genai.Client.called, "genai.Client hiç çağrılmadı"
    call_kwargs = mocked_genai.Client.call_args.kwargs
    assert "http_options" in call_kwargs, "genai.Client'a http_options geçilmedi (timeout yok)"

    http_options = call_kwargs["http_options"]
    assert isinstance(http_options, genai_types.HttpOptions)
    assert http_options.timeout == EXPECTED_TIMEOUT_MS


def test_ac3_timeout_is_applied_on_every_client_construction_during_rotation(monkeypatch):
    """Key rotasyonunda her yeni genai.Client da timeout'lu olmalı (retry döngüsü
    içinde yeniden oluşturuluyor)."""
    manager = _make_key_manager(monkeypatch, keys="key-1,key-2")

    rate_limited_client = MagicMock()
    rate_limited_client.models.generate_content.side_effect = Exception("429 RESOURCE_EXHAUSTED")
    successful_client = MagicMock()
    successful_client.models.generate_content.return_value = _mock_response(VALID_LISTING_JSON)

    with patch("parser.genai") as mocked_genai:
        mocked_genai.Client.side_effect = [rate_limited_client, successful_client]

        result = _run(parse_listing_message("2+1 daire satılık", manager))

    assert result is not None
    assert mocked_genai.Client.call_count == 2
    for call in mocked_genai.Client.call_args_list:
        http_options = call.kwargs.get("http_options")
        assert isinstance(http_options, genai_types.HttpOptions)
        assert http_options.timeout == EXPECTED_TIMEOUT_MS


# ---------------------------------------------------------------------------
# AC-4 [High]: normal süreli cevap -> timeout eklenmeden önceki gibi parse sonucu
# ---------------------------------------------------------------------------

def test_ac4_normal_response_still_returns_parsed_dict_unchanged(monkeypatch):
    manager = _make_key_manager(monkeypatch)

    with patch("parser.genai") as mocked_genai:
        mocked_client = MagicMock()
        mocked_client.models.generate_content.return_value = _mock_response(VALID_LISTING_JSON)
        mocked_genai.Client.return_value = mocked_client

        result = _run(parse_listing_message("2+1 daire 2.500.000 TL Kadıköy", manager))

    assert result == {
        "is_listing": True,
        "title": "Satılık daire",
        "price": 2500000,
        "currency": "TRY",
        "rooms": "3+1",
        "area_m2": 120,
        "city": "İstanbul",
        "district": "Kadıköy",
        "neighborhood": None,
        "description": "temiz daire",
    }


def test_ac4_normal_response_is_not_treated_as_timeout(monkeypatch):
    """Normal cevapta generate_content tam bir kez çağrılır, rotasyon/None yolu yok."""
    manager = _make_key_manager(monkeypatch)

    with patch("parser.genai") as mocked_genai:
        mocked_client = MagicMock()
        mocked_client.models.generate_content.return_value = _mock_response(VALID_LISTING_JSON)
        mocked_genai.Client.return_value = mocked_client

        result = _run(parse_listing_message("2+1 daire satılık", manager))

    assert result is not None
    assert mocked_client.models.generate_content.call_count == 1
