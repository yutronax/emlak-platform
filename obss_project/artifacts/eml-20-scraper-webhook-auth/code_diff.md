# Code Diff — eml-20-scraper-webhook-auth

## Oluşturulan dosyalar
- `scraper/.env.example` — mevcut `.env`'deki tüm anahtarlar placeholder
  değerlerle, gerçek secret yok.

## Değiştirilen dosyalar
- `scraper/orchestrator.py` — `hmac`/`sys` import eklendi. `WebhookHandler.do_POST`:
  path kontrolünden (404) sonra, JSON parse'tan önce auth kontrolü eklendi
  (`Authorization: Bearer` header'ı yoksa/`hmac.compare_digest` ile eşleşmiyorsa
  401 + `{"error":"unauthorized"}` + `WWW-Authenticate: Bearer`, kuyruğa alınmaz).
  `run()`: `BAILEYS_WEBHOOK_SECRET` boşsa `sys.exit(1)` ile fail-closed; `BAILEYS_WEBHOOK_HOST`
  env'i okunuyor (varsayılan `127.0.0.1`), `HTTPServer((host, port), ...)`.
- `scraper/sidecar/bridge.js` — dosya üstünde `BAILEYS_WEBHOOK_SECRET` okunup
  yoksa `process.exit(1)` (fail-closed). `postMessage`'daki `fetch` çağrısına
  `Authorization: Bearer <secret>` header'ı eklendi; 401 yanıtında ek log
  (token loglanmıyor), retry yok.
- `scraper/.env` — `BAILEYS_WEBHOOK_SECRET` (rastgele üretilmiş değer) ve
  `BAILEYS_WEBHOOK_HOST=127.0.0.1` eklendi.

## AC karşılanma durumu (kod incelemesiyle doğrulandı)
| AC | Durum |
|---|---|
| AC-1 (happy path) | ✅ auth geçerse mevcut kuyruk/200 akışı değişmedi |
| AC-S1 (eksik/yanlış token → 401, aynı body) | ✅ `secret` yoksa veya `compare_digest` false ise tek kod yolu |
| AC-S2 (hmac.compare_digest) | ✅ `hmac.compare_digest(token, secret)` kullanılıyor |
| AC-S3/S4 (auth → JSON parse'tan önce) | ✅ auth bloğu `length = int(...)` satırından önce, return ile çıkıyor |
| AC-S5 (fail-closed) | ✅ `run()` başında `sys.exit(1)`, `HTTPServer` çağrısına hiç ulaşmıyor |
| AC-7 (BAILEYS_WEBHOOK_HOST, varsayılan 127.0.0.1) | ✅ |
| AC-8 (yanlış path → 404) | ✅ değişmedi, auth'tan önce |
| AC-9 (token doğru + geçersiz JSON → 400) | ✅ değişmedi, auth'tan sonra |
| bridge.js: fail-closed secret yok | ✅ |
| bridge.js: 401'de log, retry yok, token loglanmıyor | ✅ |

## Kalan sınırlamalar / Varsayımlar
- `scraper/.env`'e yazılan `BAILEYS_WEBHOOK_SECRET` değeri sadece yerel
  geliştirme için üretildi — prod'a taşınırsa yeniden üretilmeli (atdd.md
  Assumptions'da zaten not edilmiş).
- Test dosyasına dokunulmadı (doğrulandı).

## CAVEMAN self-review
Yeni dosya: sadece `.env.example` (atdd.md'nin "New Files" listesinde
zaten vardı, env placeholder'larını belgelemek için gerekli — daha önce
hiç yoktu). Yeni soyutlama/yardımcı fonksiyon yok — auth kontrolü mevcut
`do_POST` metodu içine, token kontrolü tek satırlık ifade olarak eklendi;
ayrı bir `verify_token()` fonksiyonu gibi bir soyutlama YOK (AC'ler bunu
gerektirmiyordu, CAVEMAN ilkesine uygun en küçük implementasyon seçildi).
