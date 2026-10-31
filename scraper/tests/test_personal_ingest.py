# -*- coding: utf-8 -*-
"""scraper/orchestrator.py kişisel ilan yolu testleri (ATDD EML-107, AC-3, AC-6,
AC-S3, AC-S4; Davranış Sözleşmesi "Sidecar mesaj işleme" satır 1-4, 8, 9).

Sözleşme (implementasyonun uyması gereken):
  - payload["agentId"] varsa handle_message, supabase_client.ingest_personal_listing
    (client, agent_id, record) çağırır. owner kaynağı agentId'dir; payload'daki
    herhangi bir owner alanına GÜVENİLMEZ (AC-S3).
  - agentId yoksa eski ortak yol (insert_raw_listing) değişmez; owner null kalır.
  - parse None -> hiçbir yazma yok, sonuç "personal_not_listing".
  - ingest_personal_listing dönüşü: "approved" | "pending" | "duplicate".
    handle_message sayaç anahtarını döndürür:
      approved                       -> "personal_auto_approved"  (satır 1)
      pending + quality_score None   -> "personal_queued_noscore" (satır 3)
      pending + skor var             -> "personal_queued"         (satır 2)
      duplicate                      -> "personal_duplicate"      (satır 7)
    Exception -> "personal_write_error" (satır 8), içeriksiz error log.
  - Tek transaction RPC hatası: insert_raw_listing ile FALLBACK YOK (kısmi yazım yok).

Patch hedefi KULLANILDIĞI yer: orchestrator modülündeki isimler
(orchestrator.ingest_personal_listing, orchestrator.insert_raw_listing ...).

Bu dosya kasıtlı olarak KIRMIZI (red): ingest_personal_listing henüz yok /
orchestrator henüz kişisel yolu bilmiyor.
"""

import json
import logging
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from postgrest.exceptions import APIError

import orchestrator
import supabase_client

AGENT_A = "11111111-2222-4333-8444-555555555555"
SPOOF_OWNER = "66666666-7777-4888-8999-aaaaaaaaaaaa"
GROUP_JID = "120363000000000001@g.us"
MSG_ID = "msg-personal-1"
SENDER_FULL = "905321234512"
RAW_TEXT = "KIŞISEL-ILAN-METNI 3+1 Kadıköy 5321234512"
FINGERPRINT = "fp-personal-1"


def _payload(**overrides):
    base = {
        "id": MSG_ID,
        "text": RAW_TEXT,
        "group": GROUP_JID,
        "groupName": "Kadıköy Emlak",
        "agentId": AGENT_A,
    }
    base.update(overrides)
    return base


def _parsed():
    return {"ilce": "Kadıköy", "fiyat": 1000000}


class _Harness:
    """handle_message bağımlılıklarının tamamını mock'lar; test sonunda
    ingest_personal_listing / insert_raw_listing çağrıları incelenir."""

    def __init__(self, *, parsed=None, score=0.9, ingest_return="approved",
                 ingest_side_effect=None, common_return=({"id": "row-1"}, True)):
        self.client = MagicMock(name="client")
        self.parse = AsyncMock(return_value=_parsed() if parsed is None else parsed)
        self.ingest = MagicMock(name="ingest_personal_listing")
        if ingest_side_effect is not None:
            self.ingest.side_effect = ingest_side_effect
        else:
            self.ingest.return_value = ingest_return
        self.insert = MagicMock(name="insert_raw_listing", return_value=common_return)
        self.score = score
        self._patches = [
            patch("orchestrator.get_client", return_value=self.client),
            patch("orchestrator.get_default_manager", return_value=MagicMock()),
            patch("orchestrator.parse_listing_message", new=self.parse),
            patch("orchestrator.compute_fingerprint", return_value=FINGERPRINT),
            patch("orchestrator.fingerprint_exists", return_value=False),
            patch("orchestrator.score_listing", return_value=(score, [])),
            patch("orchestrator.ingest_personal_listing", new=self.ingest),
            patch("orchestrator.insert_raw_listing", new=self.insert),
        ]

    def __enter__(self):
        for p in self._patches:
            p.start()
        return self

    def __exit__(self, *exc):
        for p in reversed(self._patches):
            p.stop()
        return False

    def run(self, payload):
        return orchestrator.handle_message(payload)

    def ingest_record(self):
        assert self.ingest.call_count == 1, "ingest_personal_listing tam 1 kez çağrılmalı"
        return self.ingest.call_args.args[2]


# ---------------------------------------------------------------------------
# AC-3 / AC-S3: agentId varsa kişisel yol; owner agentId'den türetilir
# ---------------------------------------------------------------------------

def test_agent_id_routes_to_ingest_personal_listing_with_client_and_agent():
    with _Harness(score=0.9, ingest_return="approved") as h:
        h.run(_payload())

        assert h.ingest.call_count == 1
        args = h.ingest.call_args.args
        assert args[0] is h.client, "ilk argüman supabase client olmalı"
        assert args[1] == AGENT_A, "ikinci argüman oturum sahibinin agentId'si olmalı"
        assert isinstance(args[2], dict), "üçüncü argüman record (dict) olmalı"
        assert args[2]["raw_text"] == RAW_TEXT


def test_agent_id_path_never_calls_common_insert_raw_listing():
    with _Harness(score=0.9, ingest_return="approved") as h:
        h.run(_payload())
        assert h.insert.call_count == 0, "kişisel yolda ortak insert_raw_listing çağrılmamalı"


def test_owner_is_derived_from_agent_id_not_from_payload():
    """AC-S3: payload'daki owner alanı (başka emlakçının id'si) yok sayılır."""
    payload = _payload(owner_agent_id=SPOOF_OWNER, ownerAgentId=SPOOF_OWNER, agent_id=SPOOF_OWNER)
    with _Harness(score=0.9, ingest_return="approved") as h:
        h.run(payload)

        assert h.ingest.call_args.args[1] == AGENT_A, "RPC'ye giden agent_id payload'dan değil agentId'den gelmeli"
        record = h.ingest_record()
        owner = record.get("owner_agent_id")
        assert owner != SPOOF_OWNER, "record'a payload'daki owner yazılmamalı"
        assert owner is None or owner == AGENT_A, "record'daki owner en fazla oturum sahibi olabilir"
        assert SPOOF_OWNER not in repr(record), "sahte owner hiçbir yerde taşınmamalı"


# ---------------------------------------------------------------------------
# agentId yok -> eski ortak yol değişmez
# ---------------------------------------------------------------------------

def test_without_agent_id_uses_common_path_and_not_personal_ingest():
    payload = _payload()
    payload.pop("agentId")
    with _Harness(score=0.9) as h:
        h.run(payload)

        assert h.ingest.call_count == 0, "agentId yokken kişisel RPC çağrılmamalı"
        assert h.insert.call_count == 1, "eski ortak insert_raw_listing yolu çalışmalı"
        record = h.insert.call_args.args[1]
        assert record.get("owner_agent_id") is None, "ortak havuz kaydı owner'sız olmalı"


# ---------------------------------------------------------------------------
# Satır 4: parse boş -> hiçbir yazma yok, sayaç personal_not_listing
# ---------------------------------------------------------------------------

def test_parse_none_on_personal_message_writes_nothing_and_counts_not_listing():
    with _Harness(parsed=None) as h:
        h.parse.return_value = None
        outcome = h.run(_payload())

        assert h.ingest.call_count == 0, "parse None iken kişisel RPC çağrılmamalı"
        assert h.insert.call_count == 0, "parse None iken hiçbir yazma olmamalı"
        assert outcome == "personal_not_listing", "sayaç personal_not_listing olmalı (sessiz geçiş yok)"


# ---------------------------------------------------------------------------
# Satır 1-3, 7: sonuç -> sayaç eşlemesi (AC-3, AC-6, AC-11)
# ---------------------------------------------------------------------------

@pytest.mark.parametrize(
    ("ingest_return", "score", "expected_counter"),
    [
        ("approved", 0.9, "personal_auto_approved"),
        ("pending", 0.3, "personal_queued"),
        ("pending", None, "personal_queued_noscore"),
        ("duplicate", 0.9, "personal_duplicate"),
    ],
)
def test_outcome_maps_to_exact_counter_key(ingest_return, score, expected_counter):
    with _Harness(score=score, ingest_return=ingest_return) as h:
        outcome = h.run(_payload())
        assert outcome == expected_counter


def test_null_score_is_never_auto_approved_by_python_path():
    """AC-6: quality_score null -> pending kalır; Python tarafı approved sayaç üretmez."""
    with _Harness(score=None, ingest_return="pending") as h:
        outcome = h.run(_payload())
        record = h.ingest_record()
        assert record["quality_score"] is None
        assert record["status"] == "pending", "null skor kaydı pending olarak gönderilmeli"
        assert outcome == "personal_queued_noscore"


# ---------------------------------------------------------------------------
# AC-S4: kişisel kayıtta gönderen numarası saklanmaz
# ---------------------------------------------------------------------------

def test_sender_number_is_not_persisted_in_personal_record():
    payload = _payload(sender=SENDER_FULL, participant=f"{SENDER_FULL}@s.whatsapp.net")
    with _Harness(score=0.9, ingest_return="approved") as h:
        h.run(payload)
        record = h.ingest_record()
        assert SENDER_FULL not in json.dumps(record, ensure_ascii=False, default=str), (
            "gönderen numarası record'da (parsed dahil) bulunmamalı"
        )


# ---------------------------------------------------------------------------
# Satır 8 + AC-S4 log: yazma hatası yutulur, içeriksiz loglanır, fallback YOK
# ---------------------------------------------------------------------------

def test_ingest_exception_is_swallowed_logged_without_content_and_counted(caplog):
    caplog.set_level(logging.DEBUG)
    with _Harness(score=0.9, ingest_side_effect=RuntimeError("db unavailable")) as h:
        with patch.object(orchestrator.logger, "exception") as log_exc:
            outcome = h.run(_payload())  # exception fırlatmamalı

        assert outcome == "personal_write_error", "sayaç personal_write_error olmalı"
        assert log_exc.call_count == 1, "hata logger.exception ile kayda geçmeli"
        logged_args = log_exc.call_args.args
        assert all(RAW_TEXT not in str(a) for a in logged_args), "log argümanlarında metin olmamalı"
        assert RAW_TEXT not in caplog.text, "yakalanan log çıktısında metin olmamalı"
        assert "5321234512" not in caplog.text, "yakalanan log çıktısında numara olmamalı"
        assert SENDER_FULL not in caplog.text


def test_ingest_exception_does_not_fallback_to_common_insert():
    """AC-3 / satır 9: tek transaction RPC hatasında raw yazılıp listings yazılamaması
    gibi kısmi durum oluşmaz; ortak insert_raw_listing ile FALLBACK YAPILMAZ."""
    rpc_error = APIError({"message": "rpc failed", "code": "XX000", "hint": None, "details": None})
    with _Harness(score=0.9, ingest_side_effect=rpc_error) as h:
        with patch.object(orchestrator.logger, "exception"):
            outcome = h.run(_payload())

        assert h.insert.call_count == 0, "RPC hatasında insert_raw_listing fallback çağrısı YAPILMAMALI"
        assert outcome == "personal_write_error"


def test_ingest_connection_error_is_swallowed_not_raised_to_worker():
    with _Harness(score=0.9, ingest_side_effect=ConnectionError("network unreachable")) as h:
        with patch.object(orchestrator.logger, "exception"):
            outcome = h.run(_payload())  # worker thread'i düşürmemeli
        assert outcome == "personal_write_error"
        assert h.insert.call_count == 0


# ---------------------------------------------------------------------------
# supabase_client.ingest_personal_listing: service-role RPC sarmalayıcısı
# (plan: ingest_personal_listing(p_agent_id, p_record jsonb), tek transaction)
# ---------------------------------------------------------------------------

def test_ingest_personal_listing_calls_rpc_with_agent_and_record_and_returns_status():
    client = MagicMock(name="client")
    client.rpc.return_value.execute.return_value.data = "approved"
    record = {"raw_text": "x", "quality_score": 0.9, "status": "pending"}

    status = supabase_client.ingest_personal_listing(client, AGENT_A, record)

    client.rpc.assert_called_once_with(
        "ingest_personal_listing", {"p_agent_id": AGENT_A, "p_record": record}
    )
    assert status == "approved"
