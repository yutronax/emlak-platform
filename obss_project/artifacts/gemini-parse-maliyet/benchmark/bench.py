# -*- coding: utf-8 -*-
"""AC-20 benchmark: bayrak kapalı (baseline) vs açık, gerçek Gemini + gerçek Supabase.

Çalıştırma (scraper/ içinden):
    python ../obss_project/artifacts/gemini-parse-maliyet/benchmark/bench.py

- Her gerçek SDK isteği (429 tekrarı dahil) parser.genai.Client sarmalanarak sayılır.
- Benchmark önbellek kayıtları ayrı bir CACHE_VERSION ile yazılır, sonda silinir.
- Ek gecikme = parse_listing_message toplam süresi - o mesajdaki Gemini bekleme süresi.
- Çıktı: yanındaki results.json (mesaj metni/çıktısı içermez, yalnız kimlik + metrik).
"""

import asyncio
import json
import logging
import os
import statistics
import sys
import time
import tracemalloc
import uuid
from pathlib import Path

HERE = Path(__file__).resolve().parent
SCRAPER = HERE.parents[3] / "scraper"
sys.path.insert(0, str(SCRAPER))

from dotenv import load_dotenv  # noqa: E402

load_dotenv(SCRAPER / ".env")
logging.disable(logging.CRITICAL)

import parse_cache  # noqa: E402
import parser as P  # noqa: E402
import prefilter  # noqa: E402
import supabase_client  # noqa: E402
from api_key_manager import get_default_manager  # noqa: E402

PAUSE_S = float(os.getenv("BENCH_PAUSE_S", "0.4"))


class Meter:
    calls = 0
    rate_limited = 0
    in_tokens = 0
    out_tokens = 0
    msg_gemini_s = 0.0


_RealClient = P.genai.Client

# BENCH_FAKE_GEMINI=1: Gemini yerine etikete göre doğru yanıt veren sahte model.
# Çağrı sayısı, ek gecikme ve bellek modelin içeriğinden bağımsızdır; kalite ölçülmez.
FAKE = os.getenv("BENCH_FAKE_GEMINI") == "1"
FAKE_LATENCY_S = 0.6
_FAKE_LABELS = []  # (normalize edilmiş metin, etiket) — main() doldurur


class _FakeResponse:
    usage_metadata = None

    def __init__(self, text):
        self.text = text


def _fake_generate(contents):
    time.sleep(FAKE_LATENCY_S)
    prompt = " ".join(str(contents).split())
    label = next((lab for norm, lab in _FAKE_LABELS if norm in prompt), None)
    if label is None or not label["is_listing"]:
        body = {"is_listing": False}
    else:
        body = {"is_listing": True, "currency": "TRY" if "price" in label else None}
        for field in ("price", "area_m2", "rooms"):
            body[field] = label.get(field)
        body.update({"title": "ilan", "city": "İstanbul", "district": None, "neighborhood": None, "description": None})
    for field in ("title", "price", "currency", "rooms", "area_m2", "city", "district", "neighborhood", "description"):
        body.setdefault(field, None)
    return _FakeResponse(json.dumps(body, ensure_ascii=False))


class _CountingModels:
    def __init__(self, real):
        self._real = real

    def generate_content(self, *args, **kwargs):
        started = time.perf_counter()
        try:
            if FAKE:
                response = _fake_generate(kwargs.get("contents", args[1] if len(args) > 1 else ""))
            else:
                response = self._real.models.generate_content(*args, **kwargs)
        except Exception as exc:
            if "429" in str(exc) or "RESOURCE_EXHAUSTED" in str(exc):
                Meter.rate_limited += 1
            raise
        finally:
            Meter.calls += 1
            Meter.msg_gemini_s += time.perf_counter() - started
        usage = getattr(response, "usage_metadata", None)
        if usage is not None:
            Meter.in_tokens += getattr(usage, "prompt_token_count", 0) or 0
            Meter.out_tokens += getattr(usage, "candidates_token_count", 0) or 0
        return response


class _CountingClient:
    def __init__(self, *args, **kwargs):
        self.models = _CountingModels(None if FAKE else _RealClient(*args, **kwargs))


P.genai.Client = _CountingClient


def _norm_ws(text):
    return " ".join(text.split())


def build_stream(data):
    by_id = {m["id"]: m for m in data["messages"]}
    stream = []
    for token in data["stream_temsili"]["order"]:
        variant = token.startswith("ws:")
        msg = by_id[token[3:] if variant else token]
        text = msg["text"]
        if variant:
            # Aynı mesaj, yalnız boşluk/satır sonu farkıyla iletilmiş.
            text = "  " + text.replace("\n", " \n ").replace(" ", "  ") + "\n"
        stream.append((msg["id"], text))
    return by_id, stream


def pct(values, q):
    if not values:
        return None
    ordered = sorted(values)
    idx = min(len(ordered) - 1, max(0, round(q / 100 * (len(ordered) - 1))))
    return round(ordered[idx], 2)


def stats_ms(values):
    return {
        "n": len(values),
        "p50": pct(values, 50),
        "p95": pct(values, 95),
        "max": round(max(values), 2) if values else None,
        "mean": round(statistics.mean(values), 2) if values else None,
    }


async def run(stream, flag_on, km):
    os.environ[P.FLAG_ENV] = "true" if flag_on else "false"
    start_calls, start_rl = Meter.calls, Meter.rate_limited
    start_in, start_out = Meter.in_tokens, Meter.out_tokens
    rows = []
    for msg_id, text in stream:
        Meter.msg_gemini_s = 0.0
        calls_before = Meter.calls
        started = time.perf_counter()
        error = None
        try:
            result = await P.parse_listing_message(text, km)
        except Exception as exc:  # benchmark kaydı; içerik loglanmaz
            result, error = None, type(exc).__name__
        total_s = time.perf_counter() - started
        made = Meter.calls - calls_before
        rows.append({
            "id": msg_id,
            "gemini_calls": made,
            "total_ms": total_s * 1000,
            "gemini_ms": Meter.msg_gemini_s * 1000,
            "overhead_ms": (total_s - Meter.msg_gemini_s) * 1000,
            "result": result,
            "error": error,
        })
        if made and not FAKE:
            await asyncio.sleep(PAUSE_S)
    return {
        "calls": Meter.calls - start_calls,
        "rate_limited": Meter.rate_limited - start_rl,
        "in_tokens": Meter.in_tokens - start_in,
        "out_tokens": Meter.out_tokens - start_out,
        "rows": rows,
    }


def _field_eq(label, got):
    if got is None:
        return False
    return str(label).replace(" ", "") == str(got).replace(" ", "")


def quality(by_id, rows):
    """Her farklı mesaj için ilk sonucu etiketle karşılaştırır."""
    first = {}
    for row in rows:
        first.setdefault(row["id"], row)
    out = {"is_listing": [0, 0], "price": [0, 0], "area_m2": [0, 0], "rooms": [0, 0], "errors": 0}
    per_msg = {}
    for msg_id, row in first.items():
        label = by_id[msg_id]
        res = row["result"]
        if row["error"]:
            out["errors"] += 1
        got_listing = res is not None
        out["is_listing"][1] += 1
        ok = got_listing == label["is_listing"]
        out["is_listing"][0] += ok
        mark = {"is_listing": ok}
        if label["is_listing"] and got_listing:
            for field in ("price", "area_m2", "rooms"):
                if field in label:
                    out[field][1] += 1
                    hit = _field_eq(label[field], res.get(field))
                    out[field][0] += hit
                    mark[field] = hit
        elif label["is_listing"]:
            for field in ("price", "area_m2", "rooms"):
                if field in label:
                    out[field][1] += 1
                    mark[field] = False
        per_msg[msg_id] = mark
    return out, per_msg


def overhead(rows):
    return [r["overhead_ms"] for r in rows if not r["error"]]


async def main():
    data = json.loads((HERE / "dataset.json").read_text(encoding="utf-8"))
    by_id, stream = build_stream(data)
    distinct_stream = [(m["id"], m["text"]) for m in data["messages"]]
    km = get_default_manager()
    if FAKE:
        _FAKE_LABELS.extend((" ".join(m["text"].split()), m) for m in data["messages"])
        # Uzun metinler önce: kısa bir mesaj (örn. "👍") başka bir prompt'un içinde eşleşmesin.
        _FAKE_LABELS.sort(key=lambda pair: -len(pair[0]))

    bench_version = f"bench-{uuid.uuid4().hex[:10]}"
    P.CACHE_VERSION = bench_version

    norm_keys = [parse_cache.normalize(t) for _, t in stream]
    report = {
        "env": {
            "model": P.MODEL,
            "python": sys.version.split()[0],
            "platform": sys.platform,
            "cache_version": bench_version,
            "pause_between_calls_s": PAUSE_S,
            "gemini": "SAHTE (etiket tabanli, 600 ms)" if FAKE else "gercek",
        },
        "dataset": {
            "distinct_messages": len(data["messages"]),
            "listings": sum(1 for m in data["messages"] if m["is_listing"]),
            "non_listings": sum(1 for m in data["messages"] if not m["is_listing"]),
            "stream_len": len(stream),
            "stream_distinct_normalized": len(set(norm_keys)),
            "stream_repeat_rate_pct": round(100 * (1 - len(set(norm_keys)) / len(stream)), 1),
            "stream_listing_occurrences": sum(1 for i, _ in stream if by_id[i]["is_listing"]),
        },
    }

    # Ön-eleme yanlış negatifi: gerçek ilanlardan reddedilen.
    fn = [m["id"] for m in data["messages"] if m["is_listing"] and prefilter.is_obviously_not_listing(m["text"])]
    rejected_non = [m["id"] for m in data["messages"] if not m["is_listing"] and prefilter.is_obviously_not_listing(m["text"])]
    report["prefilter"] = {
        "false_negatives": fn,
        "false_negative_pct": round(100 * len(fn) / report["dataset"]["listings"], 1),
        "rejected_non_listings": rejected_non,
    }

    try:
        # 1) Temsili akış: baseline, sonra optimize soğuk / sıcak / yeniden başlatma.
        base = await run(stream, False, km)
        parse_cache.clear()
        tracemalloc.start()
        cold = await run(stream, True, km)
        _, peak = tracemalloc.get_traced_memory()
        tracemalloc.stop()
        warm = await run(stream, True, km)
        parse_cache.clear()  # süreç yeniden başlatma: LRU boş, Supabase dolu
        restart = await run(stream, True, km)

        # 2) Tekrarsız akış (her mesaj bir kez): azalmanın tekrar oranına bağlılığı.
        P.CACHE_VERSION = bench_version + "-u"
        parse_cache.clear()
        base_u = await run(distinct_stream, False, km)
        opt_u = await run(distinct_stream, True, km)
    finally:
        cleaned = 0
        try:
            client = supabase_client.get_client()
            for version in (bench_version, bench_version + "-u"):
                resp = client.table("parse_cache").delete().eq("version", version).execute()
                cleaned += len(resp.data or [])
        except Exception as exc:  # noqa: BLE001
            report["cleanup_error"] = type(exc).__name__
        report["cleanup_deleted_rows"] = cleaned

    def reduction(b, o):
        return round(100 * (b["calls"] - o["calls"]) / b["calls"], 1) if b["calls"] else None

    q_base, pm_base = quality(by_id, base["rows"])
    q_opt, pm_opt = quality(by_id, cold["rows"])
    regressions = sorted(
        f"{mid}:{field}"
        for mid, marks in pm_base.items()
        for field, ok in marks.items()
        if ok and not pm_opt.get(mid, {}).get(field, False)
    )
    improvements = sorted(
        f"{mid}:{field}"
        for mid, marks in pm_opt.items()
        for field, ok in marks.items()
        if ok and not pm_base.get(mid, {}).get(field, False)
    )

    report["calls"] = {
        "temsili": {
            "baseline": base["calls"],
            "optimized_cold": cold["calls"],
            "reduction_pct": reduction(base, cold),
            "optimized_warm": warm["calls"],
            "optimized_restart": restart["calls"],
            "rate_limited_baseline": base["rate_limited"],
            "rate_limited_optimized": cold["rate_limited"],
        },
        "tekrarsiz": {
            "baseline": base_u["calls"],
            "optimized": opt_u["calls"],
            "reduction_pct": reduction(base_u, opt_u),
        },
    }
    report["tokens"] = {
        "baseline_in": base["in_tokens"], "baseline_out": base["out_tokens"],
        "optimized_in": cold["in_tokens"], "optimized_out": cold["out_tokens"],
    }
    report["overhead_ms"] = {
        "cold": stats_ms(overhead(cold["rows"])),
        "cold_cache_miss_only": stats_ms([r["overhead_ms"] for r in cold["rows"] if r["gemini_calls"] and not r["error"]]),
        "warm_lru": stats_ms(overhead(warm["rows"])),
        "restart_supabase": stats_ms(overhead(restart["rows"])),
        "gemini_wait_ms_baseline": stats_ms([r["gemini_ms"] for r in base["rows"] if r["gemini_calls"]]),
    }
    report["memory"] = {"tracemalloc_peak_kib_cold_run": round(peak / 1024, 1), "lru_entries_after_restart": len(parse_cache._entries)}
    report["quality"] = {
        "baseline": q_base,
        "optimized": q_opt,
        "regressions_vs_baseline": regressions,
        "improvements_vs_baseline": improvements,
    }
    report["errors"] = {
        "baseline": [r["id"] for r in base["rows"] if r["error"]],
        "optimized_cold": [r["id"] for r in cold["rows"] if r["error"]],
    }
    out = HERE / ("results.fake.json" if FAKE else "results.json")
    out.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({k: report[k] for k in ("dataset", "prefilter", "calls", "overhead_ms", "quality", "errors", "cleanup_deleted_rows")}, ensure_ascii=False, indent=1))


if __name__ == "__main__":
    asyncio.run(main())
