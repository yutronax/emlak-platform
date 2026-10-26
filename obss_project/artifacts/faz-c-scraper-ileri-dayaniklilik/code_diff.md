# Code Diff — faz-c-scraper-ileri-dayaniklilik

## Değiştirilen/Oluşturulan Dosyalar
- `scraper/sidecar/bridge.js` — `processIncomingMessage(msg, sock)` (ikinci parametre eklendi), `classifyUnhandledReason` (decrypt_failed/protocol_only), `resolveGroupName` (groupNameCache, TTL 6 saat, 3s timeout), `toWebhookPayload(msg, groupName)`, `appendRiskLog`, `postMessage` 3x retry.
- `scraper/orchestrator.py` — `record` dict'ine `"source_group_name": payload.get("groupName")` eklendi.
- `supabase/migrations/0012_raw_listings_source_group_name.sql` (yeni)
- `supabase/rollback/0012_raw_listings_source_group_name_rollback.sql` (yeni)

## Doğrulama
- `node --test --test-concurrency=1 *.test.js` (sidecar/, tüm dosyalar) → **52/52 PASS** (bağımsız doğrulandı, regresyonsuz).
- `pytest tests/test_orchestrator_group_name.py tests/test_orchestrator_dedup.py tests/test_orchestrator_webhook_encoding.py -v` (scraper/.venv ile) → **13/13 PASS** (regresyonsuz).

## Düzeltilen Test Çelişkisi (implementasyon sırasında bulundu)
Dispatch edilen testlerde (`bridge.risk-log.test.js`) 2 AC-3 testi `setFetchAlwaysNonOk()` kullanıp `fetchCalls.length === 1` bekliyordu — ama AC-4'ün 3x retry mantığı (doğru implementasyon) webhook `!ok` döndüğünde 3 kez deniyor. Bu bir implementasyon hatası değil, test-copilot'un AC-3/AC-4 senaryolarını karıştırdığı bir test hatasıydı. Düzeltme: yeni `setFetchAlwaysOk()` yardımcısı eklenip bu 2 testte kullanıldı (groupMetadata hatası izole test edildi, webhook'un kendisi başarılı senaryoda). AC-4/AC-5 testlerine dokunulmadı.

## AC Karşılama
Tüm AC'ler (AC-1 → AC-5, AC-S1) testlerle doğrulandı (yukarıdaki 52/27 PASS).

## Kalan Sınırlamalar (alt-ajandan, doğrulandı)
- `cachedGroupMetadata` Baileys socket config hook'una BAĞLANMADI — kendi `groupNameCache` Map'i kullanılıyor, plan.md'nin önerdiği "ikisini birleştirme" fikri uygulanmadı (sadece kendi amacımıza hizmet ediyor, Baileys'in dahili kullanımına değil). Fonksiyonel olarak testler açısından sorun yok, ama plan.md'nin önerdiği optimum entegrasyon değil.
- `BRIDGE_ENABLE_GROUP_NAME`/`BRIDGE_ENABLE_RISK_LOG` env bayrakları (atdd.md Rollback Beklentisi'nde geçiyordu) eklenmedi — dispatch talimatında yoktu, bu bir kapsam eksikliği olarak not edilmeli (`red-team` değerlendirebilir).
- Cache'te süresi dolmuş kayıtlar için periyodik temizlik yok (sadece aynı JID tekrar okunduğunda yenilenir) — bellek büyümesi grup sayısıyla sınırlı, kabul edilebilir.

## CAVEMAN Self-Review
Mevcut `isGroupJid`/`classifySkipType`/`counters`/`UNHANDLED_LOG` deseni korundu. Yeni yardımcılar (`logUnhandled`, `appendRiskLog`, `resolveGroupName`) sadece gerekli tekrarı önlemek için eklendi.
