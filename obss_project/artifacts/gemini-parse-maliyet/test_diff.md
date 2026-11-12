# test_diff — gemini-parse-maliyet (red step)
_Reference: atdd.md, plan.md_

Haiku alt-ajanı (general-purpose) yazdı; 5 yeni dosya, 2245 satır. Çalıştırılmadı (verify koşar). Yasak kalıp yok.

| Dosya | Kapsam |
|---|---|
| scraper/tests/test_parse_cache.py | normalize, sürümlü cache_key, put/get, TTL 7g/24s sınırları, okuma yenilemez, LRU 1000 + eviction, derin kopya izolasyonu, thread güvenliği (AC-2,3,4,18) |
| scraper/tests/test_prefilter.py | boş/selam-teşekkür True, ilan/belirsiz False, yanlış negatif %0 (AC-5) |
| scraper/tests/test_regex_extract.py | açık fiyat/alan/oda; telefon/URL/ilan no hariç; belirsizlikte alan yok (AC-6,7,8) |
| scraper/tests/test_parser_optimized.py | bayrak kapalı (AC-16), önbellek katmanları, ön-eleme, regex kısmi/çelişki, Gemini hata/429, validate_parsed, önbellek hata dalları, içeriksiz log (AC-S3), AC-14, AC-S4 sıralama, AC-S6 |
| scraper/tests/test_parse_cache_integration.py | @pytest.mark.integration: RLS/REST reddi (AC-S1,S7), satır şekli/ham metin yok (AC-S2), TTL+purge (AC-S5), paralel yazım (AC-18) |

## Kapsam boşlukları (code-copilot/verify dikkat)
- AC-17 ortak yol (fingerprint/dedup) yalnız mevcut regresyon testleriyle; yeni test eklenmedi.
- AC-19 sayaçlar log token'ı (caplog) ile; yeni sayaç tablosu yok.
- AC-20 benchmark pytest dışı — verify'da ayrı ölçülecek.
- AC-S1/S7 yalnız --run-integration ile; verify'da gerçek Supabase gerekir.

## Alt-ajanın implementasyona dayattığı sözleşme (code-copilot uymalı)
- parse_cache: normalize(text), cache_key(text, version), get(key)->{"is_listing","parsed"}|None, put(key,is_listing,parsed,positive_ttl=,negative_ttl=), clear(); zaman time.time + time.monotonic.
- parse_schema.validate_parsed(obj)->dict|None.
- regex_extract.extract_fields(text): bulunamayan alan sonuçta anahtar olarak YOK (None değil).
- supabase_client: tablo "parse_cache"; sütunlar key,is_listing,parsed,version,created_at,expires_at; purge_expired_parse_cache(client). DB yolu get_client() üzerinden.
- Log token'ları: cache_hit/layer, cache_miss, cache_error/operation(read|write|delete), cache_invalid, prefilter_rejected, regex_partial, regex_only, gemini_call, gemini_error/reason(json_invalid|schema_invalid|no_key|too_large), regex_conflict.
- Ön-eleme sırası: önbellek sorgusu ÖNCE, ön-eleme SONRA (satır 3: cache_miss + prefilter_rejected).
- Çelişki: regex değeri ≠ model değeri çelişki; model null = tamamlama (çelişki değil); regex ilan alanı bulup model is_listing=false = uyuşmazlık, en fazla 1 ek çağrı. (atdd çıkarımı — code-copilot doğrulasın.)
