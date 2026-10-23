---
task_slug: scraper-core-unit-testleri
jira_id: EML-59
threat_model: not-applicable
priority: medium
coverage_target: 85
performance_target: null
memory_target: null
test_strategy:
  unit: 100
  integration: 0
  e2e: 0
affected_modules:
  - scraper/fingerprint.py
  - scraper/quality_gate.py
  - scraper/parser.py
---

# ATDD — scraper-core-unit-testleri

## Jira Kaynağı
[EML-59 — P2-14: scraper parser/quality_gate/fingerprint için unit test kapsamı ekle](https://yutronax.atlassian.net/browse/EML-59)
User Story: Backlog item P2-14 (is-listesi-ve-sayfa-envanteri.md) — bu 3 modül sıfır test kapsamına sahip, scraper'ın çekirdek iş mantığı.
AC: scraper/parser.py, quality_gate.py, fingerprint.py için mevcut davranış korunarak unit test eklensin.

## Persona
Scraper'ı işleten geliştirici/operatör — bu 3 modülde davranış değişikliği (örn. fingerprint algoritması, skor eşiği) yapıldığında regresyonu anında yakalamak istiyor.

## Hedef (Neden)
Bu 3 modül orchestrator.py'nin kalbinde (dedup, kalite filtreleme, LLM-parse) ama hiç test edilmiyor — bir gün biri `_normalize`'ı veya `score_listing` ağırlıklarını değiştirirse hiçbir şey kırmadığını bilmeden deploy eder.

## User Story
As a geliştirici
I want fingerprint.py / quality_gate.py / parser.py için unit testler
So that bu modüllerdeki bir regresyon merge öncesi yakalanır

## Acceptance Criteria (Given-When-Then, önceliklendirilmiş)
1. [Critical] Given aynı ilan farklı büyük/küçük harf ve boşluklarla, When `compute_fingerprint` iki kez çağrılır, Then aynı hash döner (normalize deterministik).
2. [Critical] Given city/district/rooms/price/area_m2'den biri eksik (None), When `compute_fingerprint` çağrılır, Then hata fırlatmadan eksik alanı boş string olarak hashler (farklı bir hash üretir, çökmez).
3. [Critical] Given geçerli fiyat/oda/m2/şehir, When `score_listing` çağrılır, Then score=1.0 ve issues=[] döner.
4. [High] Given price<=0 veya price>500_000_000, When `score_listing` çağrılır, Then issues'a "price_out_of_range" eklenir ve score 0.4 düşer.
5. [High] Given price=None, When `score_listing` çağrılır, Then issues'a "price_missing" eklenir ve score 0.1 düşer (price_out_of_range ile AYRI, ikisi birbirine karışmaz).
6. [High] Given rooms formatı ROOM_PATTERN'e uymuyor (örn. "abc"), When `score_listing` çağrılır, Then "rooms_format_unexpected" eklenir, score 0.1 düşer.
7. [Medium] Given area_m2<=0 veya >10_000, When `score_listing` çağrılır, Then "area_out_of_range" eklenir, score 0.2 düşer.
8. [High] Given city boş/None, When `score_listing` çağrılır, Then "city_missing" eklenir, score 0.3 düşer.
9. [Medium] Given birden fazla sorun birden (örn. price_missing + city_missing + area_out_of_range), When `score_listing` çağrılır, Then score tüm düşüşlerin KÜMÜLATİF toplamı olur ve 0'ın altına düşerse 0.0'da clamp'lenir (negatif dönmez).
10. [Medium] Given score eşiğin (0.5) üstünde/altında/tam eşitinde, When `is_safe_to_auto_approve` çağrılır, Then >= eşik ise True, < eşik ise False (eşitlik dahil, sınır testi).
11. [Critical] Given Gemini `is_listing: true` içeren geçerli JSON döner, When `parse_listing_message` çağrılır, Then parsed dict (is_listing alanı dahil) döner.
12. [Critical] Given Gemini `is_listing: false` döner, When `parse_listing_message` çağrılır, Then None döner.
13. [High] Given Gemini yanıtı JSON olarak parse edilemiyor (regex eşleşmiyor veya `json.loads` patlıyor), When `parse_listing_message` çağrılır, Then None döner, exception yukarı sızmaz.
14. [High] Given ilk key çağrısı "429"/"RESOURCE_EXHAUSTED" içeren exception fırlatıyor ve rotasyondan sonraki key başarılı, When `parse_listing_message` çağrılır, Then `key_manager.switch_to_next_async()` bir kez çağrılır ve ikinci denemenin sonucu döner.
15. [High] Given `key_manager.get_all_keys()` boş/tükenmiş (her denemede `get_active_key()` None dönüyor), When `parse_listing_message` çağrılır, Then None döner, `genai.Client` hiç çağrılmaz.
16. [Medium] Given Gemini 429 dışında bir exception fırlatıyor (örn. ağ hatası), When `parse_listing_message` çağrılır, Then rotasyon denenmez, direkt None döner.

## Threat Model
Tetikleyici yok — değerlendirilen tetikleyiciler: kimlik doğrulama/yetkilendirme, kullanıcı girdisi (WhatsApp mesaj metni LLM'e gidiyor ama bu zaten mevcut davranış, bu görev sadece test ekliyor, parser.py'nin prompt-injection yüzeyini DEĞİŞTİRMİYOR), dosya yükleme/indirme, ödeme, KVKK, multi-tenant, dış API (Gemini çağrısı var ama test gerçek API'yi mock'layacak, canlı çağrı yapılmayacak), arka plan işi, yeni HTTP ucu — hiçbiri uymuyor çünkü bu görev sadece MEVCUT davranışı test altına alıyor, yeni bir yüzey/uç açmıyor.

## Davranış Sözleşmesi (hangi durumda ne döner)
| # | Durum | Dönen değer / durum kodu | Yan etki | Kullanıcı ne görür | AC |
|---|---|---|---|---|---|
| 1 | fingerprint happy path | sha256 hex string (64 char) | yok | N/A (iç fonksiyon) | AC-1 |
| 2 | fingerprint eksik alan | sha256 hex string (farklı ama geçerli) | yok | N/A | AC-2 |
| 3 | score_listing happy path | `(1.0, [])` | yok | N/A | AC-3 |
| 4 | score_listing tek sorun | `(0.6-0.9 arası, [tek_issue])` | yok | N/A | AC-4..8 |
| 5 | score_listing çoklu sorun | `(0.0 clamp dahil, [issue1, issue2, ...])` | yok | N/A | AC-9 |
| 6 | is_safe_to_auto_approve sınır | `bool` (>= eşit True) | yok | N/A | AC-10 |
| 7 | parser happy path | `Dict[str, Any]` (is_listing=true + alanlar) | Gemini'ye 1 network çağrısı (mock'lanır) | N/A | AC-11 |
| 8 | parser is_listing=false | `None` | yok | N/A | AC-12 |
| 9 | parser JSON parse hatası | `None` | `logger.warning` çağrılır | N/A | AC-13 |
| 10 | parser 429 + rotasyon başarı | ikinci denemenin `Dict` sonucu | `key_manager.switch_to_next_async()` 1 kez | N/A | AC-14 |
| 11 | parser key yok | `None` | `genai.Client` ÇAĞRILMAZ, `logger.error` | N/A | AC-15 |
| 12 | parser 429-dışı hata | `None` | rotasyon YOK, `logger.error` | N/A | AC-16 |

Kısmi başarı: Bu modüllerde "kısmi başarı" kavramı yok — her fonksiyon tek bir değer/None döner, ara durum yok.
Hiçbir şey yapılamadı ama hata da yok: `parse_listing_message`'da tüm key'ler tükenirse `None` döner (AC-15) — bu "sessiz başarı" değil, zaten belgelenmiş bir hata-yolu; test bunun gerçekten None döndüğünü ve `genai.Client`'ın çağrılmadığını doğrulayacak.
Boş sonuç ↔ hata ayrımı: `score_listing` için boş `issues=[]` SADECE score=1.0 happy path'te olur (AC-3) — başka hiçbir dalda issues boş kalmaz, bu testle (AC-3 vs AC-4..9) ayrı ayrı doğrulanır.

## Test Strategy
Unit: 100% — 3 modülün tamamı saf/izole fonksiyonlar (parser.py'de tek dış bağımlılık `genai.Client`, mock'lanacak). Integration/e2e: 0% — bu modüller zaten `test_orchestrator_dedup.py`/`test_insert_raw_listing.py` üzerinden dolaylı entegrasyon kapsamında, bu görev sadece doğrudan unit kapsamı ekliyor.

## Benchmark / Başarı Ölçütü
Coverage Target: 85% (3 dosya toplam satır kapsamı)
Diğer ölçülebilir kriterler: 16 AC'nin tamamı en az 1 doğrudan testle (vekil/dolaylı değil) tetiklenmiş olmalı.

## Kapsam Dışı
- `scraper/orchestrator.py`, `scraper/supabase_client.py` — zaten mevcut testlerle kapsanıyor, bu görevde dokunulmuyor.
- Gerçek Gemini API'ye canlı çağrı yapılmayacak — `genai.Client` tamamen mock'lanacak.
- `fingerprint.py`/`quality_gate.py`/`parser.py` içindeki MEVCUT davranış/ağırlıklar/eşikler değiştirilmeyecek (bu bir refactor veya iyileştirme değil, sadece test ekleme).

## Etkilenen Dosyalar/Modüller (bilinen)
- scraper/fingerprint.py (sadece okunur, test edilir)
- scraper/quality_gate.py (sadece okunur, test edilir)
- scraper/parser.py (sadece okunur, test edilir)
- Yeni: scraper/tests/test_fingerprint.py
- Yeni: scraper/tests/test_quality_gate.py
- Yeni: scraper/tests/test_parser.py

## Proje Ortamı Kısıtı (arama/grep kapsamı)
Doğrulanmadı — ama proje klasörü (`emlak-platform`) ile sınırlı aramanın yeterli olduğu önceki görevlerde (fingerprint-unique-constraint, scraper-dm-grup-filtresi) teyit edildi; bu görevde de arama `scraper/` alt dizinine sınırlanacak.

## Rollback Beklentisi
Bu görev sadece yeni test dosyaları ekliyor, mevcut implementasyon dosyalarına dokunmuyor — "rollback" senaryosu yok, bir test dosyası yanlış yazılırsa sadece o dosya silinir/düzeltilir.

## Risks
- `parser.py`'de `google.genai` kütüphanesinin gerçek import edilebilir olması gerekiyor (test ortamında mevcut mu doğrulanmalı — `scraper/.venv` kullanılmalı, kök `python` DEĞİL, bkz. proje hafızası).
- `GeminiKeyManager`'ın gerçek implementasyonu (api_key_manager.py) henüz okunmadı — testlerde mock'lanacak ama arayüzünün (`load_keys`, `get_all_keys`, `get_active_key`, `switch_to_next_async`) gerçek sözleşmesiyle eşleştiği plan/code-copilot adımında doğrulanmalı.

## Assumptions
- `score_listing`'deki düşüş değerlerinin (0.4/0.1/0.1/0.2/0.3) kümülatif toplandığı ve 0.0'da clamp'lendiği varsayılıyor (kod okunarak doğrulandı, varsayım değil — ama "birden fazla sorun aynı anda" senaryosu mevcut kodda açıkça test edilmemişti).
- `is_safe_to_auto_approve`'un varsayılan eşiği (0.5) testlerde sabit kullanılacak, parametre olarak farklı eşik de test edilecek.

## Unknowns
- `api_key_manager.GeminiKeyManager`'ın tam arayüzü henüz okunmadı — plan adımında okunup mock'ların gerçek metod imzasıyla eşleştiği teyit edilecek.

## Sorular ve Cevaplar (ham kayıt)
1. Fast-track mi, full pipeline mi? → Full pipeline (kullanıcı/customer talebi: "Fast-track değil", mesajdan).
2. Kapsam nedir? → scraper/parser.py, quality_gate.py, fingerprint.py, mevcut davranış korunarak (kullanıcı mesajından).
3. Mock stratejisi parser.py için? → `genai.Client` tam mock'lanır, gerçek API çağrısı yapılmaz (kod okunarak + proje genelindeki mevcut test-izolasyon pratiğiyle tutarlı varsayım, bkz. fake-supabase.ts benzeri izolasyon deseni).
4. Test oranı? → 100% unit, bu modüller zaten saf/izole fonksiyonlar (proje tipine göre varsayım, modülün doğası gerektiriyor).
5. Coverage hedefi? → 85% (projenin diğer görevlerindeki standart hedefle tutarlı varsayım).
6. Threat-model tetikleyici var mı? → Yok, gerekçe yukarıda (kod okunarak değerlendirildi).
7. Kısmi başarı senaryosu var mı? → Yok, her fonksiyon atomik tek değer döner (kod okunarak doğrulandı).
8. Rollback beklentisi? → Yok, sadece yeni test dosyası ekleniyor (görevin doğasından).
