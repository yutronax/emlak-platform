# Test Diff — faz-c-scraper-ileri-dayaniklilik

## Oluşturulan Dosyalar
- `scraper/sidecar/bridge.decrypt-failed.test.js` (AC-1)
- `scraper/sidecar/bridge.risk-log.test.js` (AC-3/AC-4/AC-5/AC-S1)
- `scraper/sidecar/bridge.group-name.test.js` (AC-2)
- `scraper/tests/test_orchestrator_group_name.py` (AC-2, orchestrator tarafı)

## AC → Test eşlemesi
| AC | Test dosyası |
|---|---|
| AC-1 (decrypt-failed/protocol-only) | `bridge.decrypt-failed.test.js` |
| AC-2 (groupName zenginleştirme + cache) | `bridge.group-name.test.js`, `test_orchestrator_group_name.py` |
| AC-3 (groupMetadata başarısız/timeout) | `bridge.risk-log.test.js` |
| AC-4 (webhook 3x başarısız) | `bridge.risk-log.test.js` |
| AC-5 (log yazma başarısız, akış devam) | `bridge.risk-log.test.js` |
| AC-S1 (log-injection) | `bridge.risk-log.test.js` |

## Doğrulama (red step)
- `node --test --test-concurrency=1 bridge.decrypt-failed.test.js bridge.risk-log.test.js bridge.group-name.test.js` → **27 test, 19 fail, 8 pass** (implementasyon henüz yok, beklenen).
- `pytest tests/test_orchestrator_group_name.py -v` → **3 test, 2 fail, 1 pass** (implementasyon henüz yok, beklenen; `source_group` JID'inin değişmediğini doğrulayan test zaten PASS çünkü o alan değişmiyor).

## Önemli not — concurrency
Alt-ajan, yeni test dosyalarının `bridge.unhandled-log.test.js` ile AYNI
`bridge_unhandled_messages.log` dosyasını okuyup sildiğini, varsayılan
paralel test çalıştırmasında flaky olabileceğini belirtti. `verify`
adımında testler `--test-concurrency=1` ile çalıştırılacak (bu dosyada da
böyle doğrulandı).

## Varsayımlar (alt-ajandan)
- `processIncomingMessage(msg, sock)` imzasına `sock` ikinci parametre olarak eklenir varsayıldı (plan.md bunu açıkça belirtmiyordu) — `code-copilot` farklı bir yaklaşım (örn. modül-seviyeli `setSocket`) seçerse bu testler o şekle göre class/çağrı imzası açısından uyarlanabilir, ama davranışsal assertion'lar (log içeriği, fetch çağrı sayısı) değişmez.
- Python tarafında `parse_listing_message` async olduğu için `test_orchestrator_dedup.py`'nin düz `return_value` deseni yerine `AsyncMock` kullanıldı — patch hedefleri (`orchestrator.X`) aynı kaldı, tek sapma bu.
