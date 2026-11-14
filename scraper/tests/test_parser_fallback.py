# -*- coding: utf-8 -*-
"""scraper/parser.py::_generate yedek model (FALLBACK_MODEL) sözleşmesi testleri.

Kural: ana model (MODEL) geçici hata verirse (timeout/network ya da 500/502/503/504/
UNAVAILABLE/INTERNAL) ve FALLBACK_MODEL doluysa aynı anahtarla HEMEN bir kez yedek denenir.
Ana model tüm anahtarlarda 429 ile tükenirse, dönmeden önce anahtarlar yedekle bir tur daha
denenir. Kalıcı hatalarda yedek denenmez. FALLBACK_MODEL boşsa davranış yedeksizdir.

Mock kuralları test_parse_outcome.py / test_parser.py ile aynı: patch hedefi `parser.genai`,
GeminiKeyManager gerçek sınıftır. Çağrılan model `generate_content(model=...)` kwarg'ından
sırayla toplanır. Loglarda mesaj metni bulunmamalıdır.
"""

import asyncio
import json
import logging
from unittest.mock import MagicMock, patch

import pytest

from api_key_manager import GeminiKeyManager
import parser as parser_mod
from parser import parse_listing_message

FLAG = "GEMINI_PARSE_OPTIMIZATION_ENABLED"
MODEL = parser_mod.MODEL
FALLBACK = "gemini-3.5-flash-lite"
PROMPT = "satılık daire kadıköy temiz"
SECRET_TEXT = "GIZLI-ILAN-METNI 3+1 Kadıköy 5321234512"

D = {
    "is_listing": True,
    "title": "Satılık daire",
    "price": 2500000,
    "currency": "TRY",
    "rooms": "3+1",
    "area_m2": 120,
    "city": "İstanbul",
    "district": "Kadıköy",
    "neighborhood": None,
    "description": "Temiz daire",
}
D_JSON = json.dumps(D)


def _manager(monkeypatch, keys="test-key-1"):
    monkeypatch.setenv("GEMINI_API_KEYS", keys)
    manager = GeminiKeyManager()
    manager.load_keys()
    return manager


def _script(genai, outcomes):
    """generate_content sırayla `outcomes` öğelerini uygular: str -> yanıt metni, Exception -> fırlat.

    Döner: çağrılan modellerin (generate_content model= kwarg'ı) canlı listesi.
    """
    models = []
    queue = list(outcomes)

    def _generate_content(model, contents):
        models.append(model)
        item = queue.pop(0) if queue else Exception("unscripted call")
        if isinstance(item, BaseException):
            raise item
        response = MagicMock()
        response.text = item
        return response

    client = MagicMock(name="genai_client")
    client.models.generate_content.side_effect = _generate_content
    genai.Client.return_value = client
    return models


def _gen(manager):
    return asyncio.run(parser_mod._generate(PROMPT, manager))


@pytest.fixture
def genai():
    with patch("parser.genai") as mocked:
        yield mocked


@pytest.fixture
def fallback_on(monkeypatch):
    monkeypatch.setattr(parser_mod, "FALLBACK_MODEL", FALLBACK)


@pytest.fixture
def fallback_off(monkeypatch):
    monkeypatch.setattr(parser_mod, "FALLBACK_MODEL", "")


@pytest.fixture(autouse=True)
def _log_capture(caplog):
    caplog.set_level(logging.DEBUG)
    yield


# ---------------------------------------------------------------------------
# Geçici hata -> yedek model
# ---------------------------------------------------------------------------


def test_503_then_fallback_success_returns_text(monkeypatch, genai, fallback_on, caplog):
    manager = _manager(monkeypatch)
    models = _script(genai, [Exception("503 UNAVAILABLE"), D_JSON])

    result = _gen(manager)

    assert result == (D_JSON, None)
    assert models == [MODEL, FALLBACK]
    assert "gemini_fallback model=gemini-3.5-flash-lite reason=provider_error" in caplog.text


def test_504_gateway_timeout_then_fallback_success_logs_timeout(monkeypatch, genai, fallback_on, caplog):
    manager = _manager(monkeypatch)
    models = _script(genai, [Exception("504 Gateway Timeout"), D_JSON])

    result = _gen(manager)

    assert result == (D_JSON, None)
    assert models == [MODEL, FALLBACK]
    assert "gemini_fallback model=gemini-3.5-flash-lite reason=timeout" in caplog.text


def test_timeout_error_then_fallback_503_yields_provider_error(monkeypatch, genai, fallback_on):
    manager = _manager(monkeypatch)
    models = _script(genai, [TimeoutError("read timed out"), Exception("503 UNAVAILABLE")])

    result = _gen(manager)

    assert result == (None, "provider_error")
    assert models == [MODEL, FALLBACK]


def test_permanent_400_invalid_argument_does_not_try_fallback(monkeypatch, genai, fallback_on, caplog):
    manager = _manager(monkeypatch)
    models = _script(genai, [Exception("400 INVALID_ARGUMENT")])

    result = _gen(manager)

    assert result == (None, "provider_error")
    assert models == [MODEL]
    assert "gemini_fallback" not in caplog.text


def test_empty_fallback_model_disables_fallback_on_503(monkeypatch, genai, fallback_off, caplog):
    manager = _manager(monkeypatch)
    models = _script(genai, [Exception("503 UNAVAILABLE")])

    result = _gen(manager)

    assert result == (None, "provider_error")
    assert models == [MODEL]
    assert "gemini_fallback" not in caplog.text


# ---------------------------------------------------------------------------
# 429 tükenmesi -> yedek tur
# ---------------------------------------------------------------------------


def test_all_keys_rate_limited_then_fallback_turn_success(monkeypatch, genai, fallback_on, caplog):
    manager = _manager(monkeypatch, keys="key-1,key-2")
    models = _script(
        genai,
        [Exception("429 RESOURCE_EXHAUSTED"), Exception("429 RESOURCE_EXHAUSTED"), D_JSON],
    )

    result = _gen(manager)

    assert result == (D_JSON, None)
    assert models == [MODEL, MODEL, FALLBACK]
    assert "gemini_fallback model=gemini-3.5-flash-lite reason=rate_limit" in caplog.text


def test_all_keys_rate_limited_fallback_also_rate_limited_yields_rate_limit(monkeypatch, genai, fallback_on):
    manager = _manager(monkeypatch, keys="key-1,key-2")
    models = _script(
        genai,
        [
            Exception("429 RESOURCE_EXHAUSTED"),
            Exception("429 RESOURCE_EXHAUSTED"),
            Exception("429 RESOURCE_EXHAUSTED"),
            Exception("429 RESOURCE_EXHAUSTED"),
        ],
    )

    result = _gen(manager)

    assert result == (None, "rate_limit")
    assert models == [MODEL, MODEL, FALLBACK, FALLBACK]


def test_all_keys_rate_limited_without_fallback_stops_after_main_turn(monkeypatch, genai, fallback_off):
    manager = _manager(monkeypatch, keys="key-1,key-2")
    models = _script(genai, [Exception("429 RESOURCE_EXHAUSTED"), Exception("429 RESOURCE_EXHAUSTED")])

    result = _gen(manager)

    assert result == (None, "rate_limit")
    assert models == [MODEL, MODEL]


def test_first_key_rate_limited_second_key_main_model_success_skips_fallback(monkeypatch, genai, fallback_on):
    manager = _manager(monkeypatch, keys="key-1,key-2")
    models = _script(genai, [Exception("429 RESOURCE_EXHAUSTED"), D_JSON])

    result = _gen(manager)

    assert result == (D_JSON, None)
    assert models == [MODEL, MODEL]


# ---------------------------------------------------------------------------
# Üst düzey: parse_listing_message yedekten gelen ilanı döndürür
# ---------------------------------------------------------------------------


def test_parse_listing_message_503_then_fallback_listing_returned(monkeypatch, genai, fallback_on):
    monkeypatch.setenv(FLAG, "false")
    manager = _manager(monkeypatch)
    models = _script(genai, [Exception("503 UNAVAILABLE"), D_JSON])

    result = asyncio.run(parse_listing_message(PROMPT, manager))

    assert result is not None
    assert result["is_listing"] is True
    assert result["price"] == 2500000
    assert result["city"] == "İstanbul"
    assert models == [MODEL, FALLBACK]


# ---------------------------------------------------------------------------
# Gizlilik: fallback logları içeriksizdir
# ---------------------------------------------------------------------------


def test_fallback_logs_contain_no_message_text(monkeypatch, genai, fallback_on, caplog):
    manager = _manager(monkeypatch)
    _script(genai, [Exception(f"503 UNAVAILABLE {SECRET_TEXT}"), D_JSON])

    _gen(manager)

    assert "gemini_fallback model=gemini-3.5-flash-lite reason=provider_error" in caplog.text
    assert SECRET_TEXT not in caplog.text
    assert "UNAVAILABLE" not in caplog.text
