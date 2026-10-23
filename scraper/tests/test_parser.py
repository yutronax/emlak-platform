# -*- coding: utf-8 -*-
"""scraper/parser.py::parse_listing_message testleri (ATDD EML-59, AC-11..16).

ZORUNLU mock-patch kuralı: parser.py `from google import genai` ile import
ediyor -> patch hedefi `parser.genai` olmalı, `google.genai` DEĞİL.

GeminiKeyManager: gerçek sınıf kullanılır (MagicMock DEĞİL) —
`monkeypatch.setenv("GEMINI_API_KEYS", ...)` ile gerçek key enjekte edilip
`manager.load_keys()` çağrılır; round-robin/cooldown gerçek davranışı
AC-14/15'in parçası.

Not: parser.py mevcut davranışı DEĞİŞTİRİLMİYOR, sadece test ekleniyor
(GREEN geçmeli).
"""

import asyncio
import json
from unittest.mock import MagicMock, patch

from api_key_manager import GeminiKeyManager
from parser import parse_listing_message

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

NOT_LISTING_JSON = json.dumps({"is_listing": False})


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
# AC-11: is_listing:true içeren geçerli JSON -> parsed dict döner
# ---------------------------------------------------------------------------

def test_valid_listing_response_returns_parsed_dict(monkeypatch):
    manager = _make_key_manager(monkeypatch)

    with patch("parser.genai") as mocked_genai:
        mocked_client = MagicMock()
        mocked_client.models.generate_content.return_value = _mock_response(VALID_LISTING_JSON)
        mocked_genai.Client.return_value = mocked_client

        result = _run(parse_listing_message("2+1 daire 2.500.000 TL Kadıköy", manager))

    assert result is not None
    assert result["is_listing"] is True
    assert result["price"] == 2500000
    assert result["city"] == "İstanbul"


# ---------------------------------------------------------------------------
# AC-12: is_listing:false -> None döner
# ---------------------------------------------------------------------------

def test_is_listing_false_returns_none(monkeypatch):
    manager = _make_key_manager(monkeypatch)

    with patch("parser.genai") as mocked_genai:
        mocked_client = MagicMock()
        mocked_client.models.generate_content.return_value = _mock_response(NOT_LISTING_JSON)
        mocked_genai.Client.return_value = mocked_client

        result = _run(parse_listing_message("merhaba naber", manager))

    assert result is None


# ---------------------------------------------------------------------------
# AC-13: JSON parse edilemiyor (regex eşleşmiyor veya json.loads patlıyor)
# -> None döner, exception yukarı sızmaz
# ---------------------------------------------------------------------------

def test_response_text_without_json_braces_returns_none(monkeypatch):
    manager = _make_key_manager(monkeypatch)

    with patch("parser.genai") as mocked_genai:
        mocked_client = MagicMock()
        mocked_client.models.generate_content.return_value = _mock_response("sadece düz metin, JSON yok")
        mocked_genai.Client.return_value = mocked_client

        result = _run(parse_listing_message("bir mesaj", manager))

    assert result is None


def test_response_text_with_malformed_json_returns_none_without_raising(monkeypatch):
    manager = _make_key_manager(monkeypatch)

    with patch("parser.genai") as mocked_genai:
        mocked_client = MagicMock()
        mocked_client.models.generate_content.return_value = _mock_response('{"is_listing": true,}')
        mocked_genai.Client.return_value = mocked_client

        result = _run(parse_listing_message("bir mesaj", manager))

    assert result is None


# ---------------------------------------------------------------------------
# AC-14: ilk key 429/RESOURCE_EXHAUSTED fırlatıyor, rotasyon sonrası
# ikinci key başarılı -> switch_to_next_async bir kez çağrılır, ikinci
# denemenin sonucu döner
# ---------------------------------------------------------------------------

def test_rate_limit_then_successful_rotation_calls_switch_once_and_returns_second_result(monkeypatch):
    manager = _make_key_manager(monkeypatch, keys="key-1,key-2")

    rate_limited_client = MagicMock()
    rate_limited_client.models.generate_content.side_effect = Exception("429 RESOURCE_EXHAUSTED")

    successful_client = MagicMock()
    successful_client.models.generate_content.return_value = _mock_response(VALID_LISTING_JSON)

    with patch("parser.genai") as mocked_genai, \
         patch.object(manager, "switch_to_next_async", wraps=manager.switch_to_next_async) as mocked_switch:
        mocked_genai.Client.side_effect = [rate_limited_client, successful_client]

        result = _run(parse_listing_message("2+1 daire satılık", manager))

    assert result is not None
    assert result["is_listing"] is True
    mocked_switch.assert_called_once()
    assert mocked_genai.Client.call_count == 2


# ---------------------------------------------------------------------------
# AC-15: key_manager tükenmiş/boş (get_active_key() hep None) -> None döner,
# genai.Client HİÇ ÇAĞRILMAZ
# ---------------------------------------------------------------------------

def test_no_available_keys_returns_none_without_calling_genai_client(monkeypatch):
    monkeypatch.delenv("GEMINI_API_KEYS", raising=False)
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    manager = GeminiKeyManager()
    manager.load_keys()  # hiç key yok -> get_all_keys() == []

    with patch("parser.genai") as mocked_genai:
        result = _run(parse_listing_message("bir mesaj", manager))

    assert result is None
    mocked_genai.Client.assert_not_called()


# ---------------------------------------------------------------------------
# AC-16: 429 DIŞINDA bir exception (ör. ağ hatası) -> rotasyon denenmez,
# direkt None döner
# ---------------------------------------------------------------------------

def test_non_rate_limit_exception_returns_none_without_rotation(monkeypatch):
    manager = _make_key_manager(monkeypatch, keys="key-1,key-2")

    with patch("parser.genai") as mocked_genai, \
         patch.object(manager, "switch_to_next_async", wraps=manager.switch_to_next_async) as mocked_switch:
        mocked_client = MagicMock()
        mocked_client.models.generate_content.side_effect = Exception("network timeout")
        mocked_genai.Client.return_value = mocked_client

        result = _run(parse_listing_message("bir mesaj", manager))

    assert result is None
    mocked_switch.assert_not_called()
    assert mocked_genai.Client.call_count == 1
