# Code Diff — faz-b-scraper-guvenilirlik-sertlestirme
_Reference: atdd.md, plan.md, test_diff.md_

## Değiştirilen dosyalar
- `scraper/orchestrator.py::WebhookHandler.do_POST` — `json.loads` çağrısı `except (json.JSONDecodeError, UnicodeDecodeError)` ile sarmalandı (400 + `{"error":"invalid_body"}`); `text` alanı yoksa/boşsa kuyruğa eklenmeden 200 + `{}` dönülüyor (dedup set'ine de eklenmiyor).
- `scraper/parser.py::parse_listing_message` — `genai.Client(...)` çağrısına `http_options=genai_types.HttpOptions(timeout=30000)` eklendi (retry döngüsündeki her kurulumda geçerli). Model adı da (önceki görevde) `gemini-3.8-flash` olarak güncellenmişti.
- `scraper/sidecar/bridge.js::processIncomingMessage` — `no_text` dalına, konsol logunun yanına, PII'siz bir satırı (`timestamp`, `messageId`, `jidType`) `bridge_unhandled_messages.log`'a yazan try/catch eklendi; yazma hatası akışı durdurmuyor.

## Bağımsız doğrulama (orkestratör tarafından)
- `scraper/.venv/Scripts/python.exe -m pytest tests/ -v` → **100 passed, 5 skipped, 1 failed**. Başarısız olan (`test_verify_supabase.py::test_schema_required_tables_are_the_six_expected`) bu görevin dosyalarıyla İLGİSİZ — P2-20'de `REQUIRED_TABLES`'a eklenen `plans`/`payment_events` için test hiç güncellenmemiş, ÖNCEDEN VAR olan bir tutarsızlık (pre-existing). Backlog'a not düşülecek.
- `node --test` (scraper/sidecar/) → **25/25 PASS**.
- Kod okunarak doğrulandı: her iki değişiklik de mevcut proje deseniyle (hata yönetimi, Türkçe log mesajları, PII'siz loglama ilkesi) tutarlı, CAVEMAN'a uygun (gereksiz soyutlama/dosya yok).

## Kalan sınırlamalar
- `payload`'ın JSON olarak geçerli ama dict olmadığı durum (örn. `[1]`) kapsam dışı — mevcut `payload.get("id")` ile aynı risk zaten vardı, bu görev onu değiştirmiyor.
- `bridge_unhandled_messages.log` rotasyonu yok (atdd.md'nin Kapsam Dışı kararıyla uyumlu, bilinçli).

## Varsayımlar
- Yok (plan.md'nin öngördüğü SDK API'si doğrulanmış şekilde kullanıldı).
