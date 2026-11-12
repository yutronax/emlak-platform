# code_diff — gemini-parse-maliyet (green step)
_Reference: atdd.md, test_diff.md_

Haiku alt-ajanı (general-purpose) yazdı; incelendi (read-only). Testlere dokunulmadı (0 değişiklik), git komutu yok. Testler çalıştırılmadı — verify koşar.

## Yeni dosyalar
- scraper/parse_cache.py (72) — normalize, cache_key, thread-safe LRU(1000), TTL 7g/24s, derin kopya, 8 KB sınırı LRU dışı değil (yalnız kalıcı yazım atlanır).
- scraper/parse_schema.py (54) — validate_parsed; bool/inf/nan/str reddi; eksik nullable None.
- scraper/prefilter.py (27) — is_obviously_not_listing (boş + selam/teşekkür tam eşleşme).
- scraper/regex_extract.py (49) — price+currency/area_m2/rooms; URL/telefon önce çıkarılır; net/brüt varsa fiyat+alan atlanır; belirsizlikte alan yok.
- supabase/migrations/0031_parse_cache.sql (+ down) — RLS açık, politika yok, expires_at indeksi, idempotent.

## Değişen dosyalar
- scraper/parser.py — imza korundu; bayrak kapalı=legacy (içerik logları temizlendi), açık=cache→prefilter→regex→model→validate→conflict(≤1 ek çağrı)→merge→store. İç tür listing/not_listing/error; error ASLA önbelleğe yazılmaz (doğrulandı: _store yalnız listing/not_listing). Log token'ları eksiksiz, içeriksiz.
- scraper/supabase_client.py — get/put/delete/purge_expired_parse_cache; put upsert on_conflict key, hatada False.
- scraper/orchestrator.py — run()'da saatlik purge daemon thread; kişisel yol is_group_selected sırası değişmedi.
- scraper/.env.example — GEMINI_PARSE_OPTIMIZATION_ENABLED=false.

## Doğrulanan (read-only)
- AC-S3 içeriksiz log: parser.py'de raw_text/response/parsed/telefon loglanmıyor (grep temiz).
- Hata önbelleğe yazılmaz: _ERROR dalları return None, _store çağırmıyor.
- AC-16 bayrak kapalı legacy yol mevcut. Migration RLS açık + politika yok.

## Sapmalar (verify dikkat — atdd ile uyumlu, kabul edilen)
1. regex_only yolu kurulmadı; regex_only token hiç loglanmaz. atdd Assumption: "başlangıçta regex_only=0 olabilir" — uyumlu.
2. Tek modül-düzeyi client + 300 ms okuma timeout kurulmadı (testler get_client'i her test patch'liyor, modül-düzeyi client bunu bozardı). Her cache işlemi get_client() çağırır. p95 ≤100 ms verify'da ÖLÇÜLMELİ (plan/atdd performans hedefi).
3. gemini_error reason'ları genişletildi (timeout, network, provider_error, rate_limit); atdd'nin json_invalid/schema_invalid/no_key listesinin üstüne — ek bilgi, çelişki değil.
4. too_large: atdd AC-S6 "cache_error{operation=write,reason=too_large}" — uygulandı.
5. Süresi dolmuş DB satırı okununca silinmez (yalnız purge siler) — atdd AC-S5 "kullanılmaz + periyodik temizlenir" ile uyumlu.
6. DB seviyesinde 8 KB CHECK yok (yalnız uygulama tarafı) — atdd AC-S6 uygulama kontrolü istiyor, uyumlu.

## verify'da zorunlu
- pytest scraper/tests (red testler yeşile döndü mü), mevcut regresyon (test_parser.py, test_personal_*, test_orchestrator_dedup.py).
- --run-integration ile AC-S1/S7 (migration uygulandıktan SONRA; migration canlıya ayrı onayla).
- p95 ek gecikme ölçümü (sapma 2).
- Değişen parser kodu branch coverage ≥%90.

## Red-team düzeltme turları (2026-11-12)
Tur 1 (Codex, block) → düzeltildi:
- F1 parser.py::_parse_optimized — çelişkide ikinci çağrı `_build_prompt(raw_text, {})` (regex dayatılmaz); ilan → modelin doğrulanmış sonucu regex ile birleştirilmeden pozitif önbelleğe; hata → None, önbellek yok. atdd.md AC-8 + sözleşme 13/14 güncellendi (kullanıcı "Evet, düzelt").
- F2 regex_extract.py — `_LISTING_NO` ([İiIı]lan no) temizlenir; birleşik oda zinciri `_COMPOUND_ROOMS` ile bütün olarak silinir (bitişik + boşluklu).
Tur 2 (Codex, block: F2b/F3 açık) → düzeltildi:
- F2b "3 + 1 + 1" → {} (eskiden rooms=1+1).
- F3 parse_schema.py::_is_finite_number — math.isfinite OverflowError → False; validate_parsed dev sayıda None (model yolu schema_invalid, DB yolu cache_invalid). Tur 1'deki "public sınırda zararsız" notum yanlıştı (is_listing'siz test etmiştim).
Açık (kullanıcı kararı bekliyor): F4 benchmark/coverage ölçümü, F5 get_client yeniden kullanımı + kısa timeout.
Testler test-first eklendi (Haiku), implementasyon Haiku; orkestratör kodu satır satır okudu.
