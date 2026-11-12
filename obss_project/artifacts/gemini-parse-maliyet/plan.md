# Plan — gemini-parse-maliyet
_Reference: atdd.md_

Frontend-pipeline: tetikleyici yok (backend-only görev).

## Files to Modify
| File | Alan | Why | Risk |
|------|------|-----|------|
| scraper/parser.py | backend | `parse_listing_message` imzası korunur; bayrak açıkken akış: ön-eleme → önbellek (LRU → Supabase) → regex → (gerekirse) Gemini → doğrulama → önbelleğe yaz (AC-1..16). Mevcut ham-yanıt/hata metni logları içeriksizleştirilir (AC-S3). | high |
| scraper/supabase_client.py | backend | Önbellek CRUD yardımcıları: `get_parse_cache`, `put_parse_cache`, `delete_parse_cache`, `purge_expired_parse_cache` (servis rolü, best-effort, hata yutmadan çağırana döner) (AC-3,4,9,S5,S6). | medium |
| scraper/orchestrator.py | backend | Yalnız regresyon + periyodik temizlik tetikleyicisi (başlangıçta ve saatlik); kişisel yolda `is_group_selected` parse'tan önce kalır (AC-S4, AC-S5). | medium |
| scraper/.env.example | devops | `GEMINI_PARSE_OPTIMIZATION_ENABLED=false` belgelenir (AC-16). | low |

## New Files
| File | Alan | Purpose |
|------|------|---------|
| scraper/parse_cache.py | backend | Normalizasyon (NFC + boşluk), sürümlü SHA-256 anahtar, thread-safe LRU (1.000), TTL (pozitif 7 gün, negatif 24 saat), boyut sınırı 8 KB, derin kopya ile mutasyon izolasyonu (AC-2,3,4,18,S6). |
| scraper/parse_schema.py | backend | Çıktı şeması doğrulayıcısı (AC-12) — parser ve parse_cache ortak kullanır. |
| scraper/prefilter.py | backend | Boş/yalnız selam-teşekkür mesajı ön-elemesi (AC-5). |
| scraper/regex_extract.py | backend | Açık ve tek anlamlı price+currency / area_m2 / rooms çıkarımı; telefon/URL/ilan no hariç; çakışma tespiti (AC-6,7,8). |
| supabase/migrations/0031_parse_cache.sql (+ .down.sql) | backend | `parse_cache` tablosu: key text pk, is_listing bool, parsed jsonb null, version text, created_at, expires_at; RLS açık, politika yok; expires_at indeksi (AC-S1, S2, S5, S7). |
| scraper/tests/test_parse_cache.py, test_prefilter.py, test_regex_extract.py, test_parser_optimized.py | backend | Unit testler (Critical AC önce). |
| scraper/tests/test_parse_cache_integration.py | backend | Gerçek Supabase: RLS/doğrudan REST reddi, TTL, temizlik (RUN_INTEGRATION=1). |

## Dependencies
- `api_key_manager.GeminiKeyManager` (rotasyon korunur), `quality_gate.score_listing`, `fingerprint.compute_fingerprint` (değişmez), `supabase_client.get_client`.
- Mevcut testler: test_parser.py, test_parser_timeout.py, test_orchestrator_dedup.py, test_personal_ingest.py, test_personal_counters.py regresyon.

## Migration Required?
Evet — `0031_parse_cache.sql` (+ down). Additive, yalnız yeni tablo. Canlıya uygulama ayrı onayla (support_messages'taki gibi).

## Risks
- atdd Risks aynen geçerli. Ek: projede pg_cron yok → TTL temizliği worker içinde (başlangıç + saatlik thread); worker kapalıyken temizlik çalışmaz ama okuma `expires_at` kontrolüyle süresi dolanı yine kullanmaz (AC-S5).
- Güvenlik kontrolü yolları: (1) önbellek okuma/yazma yalnız `parser.py` → `supabase_client` servis rolü; (2) kişisel yol: `orchestrator.handle_message` seçim kontrolü → parser; (3) ortak yol: parser → fingerprint; (4) doğrudan REST: RLS (migration). Log içeriksizliği parser'ın tüm dallarında (başarı, JSON hatası, şema hatası, timeout, 429, DB hatası).

## ECC Danışman Notları
Codex danışmanı çağrıldı (ecc-architect rolü; rol dosyası bulunamadı, genel mimari inceleme yaptı — codex/plan-tasarim.out.md). Kabul edilenler plana işlendi:
- Kabul: parser içinde `listing / not_listing / error` iç sonuç türü; yalnız `not_listing` negatif önbelleğe yazılır, dış imza `dict | None` korunur.
- Kabul: ortak doğrulayıcı `scraper/parse_schema.py` (yeni, bağımlılığı yok) — parser ve parse_cache onu import eder; döngüsel import olmaz.
- Kabul: önbellek DB erişimi için modül düzeyinde tek istemci + kısa timeout (okuma 300 ms); LRU kilidi ağ çağrısı sırasında tutulmaz.
- Kabul: zaman damgaları UTC, sunucuda `now()`; aynı anahtar yeniden yazılınca upsert TTL'yi yeniler (en son başarılı sonuç kazanır).
- Kabul: temizleyici `orchestrator.run()`'da süreç başına tek thread, hatada devam eder, bayrak kapalıyken de çalışır.
- Kabul: devreye alma adımı — migration + canlıda bayrağı açma ve kapatarak geri dönüşü doğrulama `verify` sonrası ayrı adım.
- Kabul: regex yalnız kısmi alan çıkarımı; tam deterministik `regex_only` yolu bu sürümde kurulmaz (atdd Assumption ile uyumlu). Gemini çağrısı/rotasyon tek yardımcıda paylaşılır.

## Kararlar (açık sorular — kullanıcı "önerilerle devam", 2026-11-12)
1. Benchmark: raw_listings.raw_text'ten ~200 ilan + elle ~50 sohbet; içerik repoya girmez, yerel/geçici dosya.
2. Kısmi istek biçimi: (a) tam şema + "bilinen alanlar" bloğu; çelişki AC-8 ile gözlenir.
3. Entegrasyon test kimliği: mevcut deneme hesabı kullanılır (ayrı kullanıcı açılmaz).

## Open Questions (çözüldü)
1. (atdd Unknowns + danışman 9) AC-20 benchmark'ı için etiketli mesaj kümesi nereden gelecek? Öneri: `raw_listings.raw_text`'ten 200 mesaj (ilan) + elle eklenen ~50 sohbet mesajı, içerikler repoya girmeden yerel/geçici dosyada; etiketlemeyi sen onaylarsın.
2. (atdd Unknowns + danışman 4) Kısmi model isteği: (a) mevcut tam şemayla tek çağrı, regex değerleri "bilinen alanlar" bloğu olarak verilir, model yine tüm alanları döndürür ve çelişki AC-8 ile yakalanır (basit, çelişki gözlenebilir); (b) model yalnız eksik alanları döndürür (daha az çıktı token'ı, çelişki gözlenemez). Öneri: (a).
3. (atdd Unknowns) Gerçek Supabase entegrasyon testleri için authenticated test kimliği: mevcut deneme hesabı mı kullanılsın, ayrı bir test kullanıcısı mı açılsın (açılışı senin yapman gerekir)?
