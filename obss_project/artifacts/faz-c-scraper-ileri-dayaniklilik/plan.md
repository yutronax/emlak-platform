# Plan — faz-c-scraper-ileri-dayaniklilik
_Reference: atdd.md_

Frontend-pipeline: tetikleyici yok (backend-only görev — bridge.js/Node.js
+ orchestrator.py/Python, hiçbir .tsx/.jsx/UI dosyası yok, Görsel/UI kriteri
boş).

## Keşif Sonucu (gerçek koddan)

1. **Retry madde tamamen kapsamdan çıkarıldı** (bkz. atdd.md "Kapsam
   Düzeltmesi") — `enableRecentMessageCache: true` Baileys varsayılanı,
   dahili `MessageRetryManager` zaten decrypt edilen her mesajı cache'liyor.
   Bu plan sadece 3 alt-özelliği kapsıyor.

2. **Decrypt-failure tespiti** (`node_modules/@whiskeysockets/baileys/lib/
   Socket/messages-recv.js`, decrypt bloğu): bir mesaj decrypt edilemezse
   `msg.messageStubType === proto.WebMessageInfo.StubType.CIPHERTEXT` olur.
   `bridge.js`'te bu, `msg.message` henüz kontrol edilmeden ÖNCE (mevcut
   `processIncomingMessage`'ın en başında, `isGroupJid` kontrolünden SONRA)
   kontrol edilmeli: `if (msg.messageStubType === WAMessageStubType.CIPHERTEXT)`
   → `reason: "decrypt_failed"`. Protokol-only mesajlar (`senderKeyDistributionMessage`,
   `protocolMessage` alanı DOLU ama gerçek içerik yok) `extractText` zaten
   `null` döndürüyor — bu mevcut `no_text` dalına düşer, ama atdd.md'nin
   AC-1'i bu durumu `reason:"protocol_only"` ile ayırmak istiyor. Ayrım:
   `message.protocolMessage` veya `message.senderKeyDistributionMessage`
   alanı DOLU VE başka içerik YOKSA → `protocol_only`; `message` tamamen
   null/undefined İSE → `decrypt_failed`; ikisi de değilse (gerçekten metin
   yok, resim/video caption'sız vb.) → mevcut `no_text`.

3. **`proto` import'u gerekiyor** — `require('@whiskeysockets/baileys')`'in
   mevcut destructure'ına eklenecek: `const { default: makeWASocket,
   useMultiFileAuthState, DisconnectReason, proto } = require('@whiskeysockets/
   baileys');` — **doğrulandı:** `proto`, `lib/index.js`'te `export * from
   '../WAProto/index.js'` ile re-export ediliyor, `WAProto/index.js:49`'da
   `export const proto = ...`. Kontrol ifadesi Baileys'in kendi iç kodundaki
   BİREBİR şekliyle yazılacak: `msg.messageStubType === proto.WebMessageInfo.StubType.CIPHERTEXT`
   (`WAMessageStubType` adlı ayrı bir runtime export YOK, bu sadece TypeScript
   tip takma adı — JS'te `proto.WebMessageInfo.StubType` kullanılır).

4. **`cachedGroupMetadata` hook'u** (`lib/Types/Socket.d.ts:133`):
   `(jid: string) => Promise<GroupMetadata | undefined>`. `makeWASocket({...})`
   çağrısına eklenecek. Bizim kendi `groupNameCache` (Map, JID→{metadata,
   expiresAt}, TTL 6 saat) bu hook'a bağlanacak: `cachedGroupMetadata: async
   (jid) => groupNameCache.get(jid)?.metadata`. Grup adı gerektiğinde
   (`toWebhookPayload` çağrılmadan ÖNCE, `processIncomingMessage` içinde)
   önce bu cache kontrol edilir, yoksa `sock.groupMetadata(jid)` çağrılır
   (3s timeout ile sarılı, `Promise.race`), sonuç cache'e yazılır.

5. **`toWebhookPayload` imzası değişiyor** — şu an `(msg)` alıyor, grup adı
   eklemek için `groupName` parametresi eklenecek: `toWebhookPayload(msg,
   groupName)` → `{id, text, group: from, groupName: groupName ?? null}`.
   `processIncomingMessage` zaten async, `groupMetadata` çağrısını
   `await`layıp sonucu `toWebhookPayload`'a geçirecek.

6. **`bridge_risk.log`** — `UNHANDLED_LOG` sabitiyle aynı desende yeni bir
   sabit: `const RISK_LOG = path.join(__dirname, 'bridge_risk.log');` ve
   `appendRiskLog(category, extra = {})` yardımcı fonksiyonu (try/catch,
   mevcut `UNHANDLED_LOG` yazma deseniyle birebir — hata akışı durdurmaz,
   `console.error('[LOG-YAZMA HATASI]', ...)`).

7. **Webhook 3x retry sayacı** — mevcut `postMessage(payload)` fonksiyonu
   tek seferlik POST yapıyor, retry YOK. `postMessage`'a basit bir retry
   döngüsü eklenecek (3 deneme, aralarında kısa bekleme YOK — atdd.md'de
   "sabit kodlanıyor" denmişti, Faz B'deki gibi kapsam küçük tutuluyor,
   exponential backoff EKLENMİYOR), 3. deneme de başarısız olursa
   `appendRiskLog('webhook_post_failed_max_retries', {messageId: payload.id})`.

8. **AC-S1 (log-injection) — kritik implementasyon detayı:** Hem
   `bridge_unhandled_messages.log` hem `bridge_risk.log`'a yazan kod,
   ASLA `groupName`/`text`/JID'i log satırına interpolasyon ile EKLEMEMELİ
   — sadece `JSON.stringify({timestamp, messageId, jidType, reason})` gibi
   SABİT ALAN LİSTESİ kullanılmalı (mevcut `UNHANDLED_LOG` yazma kodu zaten
   bu deseni kullanıyor, `appendRiskLog` da AYNI deseni takip edecek).
   `groupName` SADECE `toWebhookPayload`'ın payload'ına girer (webhook'a
   gider, log'a asla).

9. **`orchestrator.py::handle_message`** — `record` dict'ine `"source_group_name":
   payload.get("groupName")` eklenecek (satır ~65-74 arası, mevcut `record`
   dict'inin yanına, tek satır).

## Files to Modify
| File | Why | Risk | Alan |
|------|-----|------|------|
| `scraper/sidecar/bridge.js` | decrypt-failed sınıflandırma, risk log, cachedGroupMetadata+groupMetadata entegrasyonu, webhook retry | medium | backend |
| `scraper/orchestrator.py` | `source_group_name` alanını `record`'a ekle | low | backend |

## New Files
| File | Purpose | Alan |
|------|---------|------|
| `supabase/migrations/0012_raw_listings_source_group_name.sql` | `raw_listings.source_group_name text null` | backend |
| `supabase/rollback/0012_raw_listings_source_group_name_rollback.sql` | Ters migration (kolonu DROP eder) | backend |
| `scraper/sidecar/bridge.decrypt-failed.test.js` | AC-1 testleri | backend |
| `scraper/sidecar/bridge.risk-log.test.js` | AC-3/AC-4/AC-S1 testleri | backend |
| `scraper/sidecar/bridge.group-name.test.js` | AC-2/AC-S1(grup adı kısmı) testleri | backend |
| `scraper/tests/test_orchestrator_group_name.py` | orchestrator'ın `source_group_name`'i doğru yazdığını test eden — **doğrulandı:** `scraper/tests/test_orchestrator_dedup.py`, `test_orchestrator_webhook_encoding.py` mevcut, AYNI test konvansiyonu (mock Supabase client) takip edilecek | backend |

## Migration İçeriği
```sql
-- 0012_raw_listings_source_group_name.sql
alter table raw_listings add column source_group_name text null;
```
```sql
-- 0012_raw_listings_source_group_name_rollback.sql
alter table raw_listings drop column if exists source_group_name;
```

## Dependencies
- `scraper/sidecar/bridge.filter.test.js`, `bridge.unhandled-log.test.js` — mevcut desenler (node:test, console capture, fs.appendFileSync monkey-patch) AYNEN takip edilecek.
- `@whiskeysockets/baileys`'in `WAMessageStubType`/`proto` export'ları — `lib/index.js`'te doğrulanacak (code-copilot dispatch'inde).
- `scraper/orchestrator.py`'nin mevcut `record` dict yapısı — tek alan eklenecek, başka bir şey değişmiyor.

## Migration Required?
Evet — yukarıdaki `0012_raw_listings_source_group_name.sql` (+ rollback). **Sıralama kritik:** migration ÖNCE Supabase'e uygulanmalı, orchestrator.py SONRA deploy edilmeli (atdd.md Risks'te zaten vurgulanmış) — aksi halde `source_group_name` kolonu yokken INSERT'e eklenen alan hata verir.

## Risks
atdd.md'den taşınan riskler (grup adı PII, groupMetadata rate-limit) geçerli. **Yeni risk (keşifte bulundu):** `WAMessageStubType`/`proto`'nun gerçek export şekli henüz `bridge.js`'in import satırına eklenmedi — code-copilot dispatch'inde `node_modules/@whiskeysockets/baileys/lib/index.js`'i (veya ana `index.d.ts`'i) okuyup doğru import yolunu teyit etmeli, tahmin etmemeli.

## Open Questions
Yok — atdd.md'nin Unknowns bölümü zaten "yok" diyor (hepsi ATDD aşamasında Baileys kaynak kodu okunarak çözüldü). Bu `plan` adımının kendi keşfi (yukarıdaki 9 madde) ek bir açık soru üretmedi — tüm implementasyon detayları somutlaştırıldı.

## Alan Etiketleri
Tüm dosyalar `backend` — bu görevde frontend/devops dosyası yok.

## test-copilot / code-copilot Dispatch Talimatı (somut)
**Backend grubu (tek grup):**
- `supabase/migrations/0012_raw_listings_source_group_name.sql` + rollback — yukarıdaki SQL birebir.
- `scraper/sidecar/bridge.js` değişiklikleri — yukarıdaki keşif maddeleri 2-9 birebir uygulanacak. `isGroupJid`/`classifySkipType`/`counters`/`UNHANDLED_LOG` mevcut kod AYNEN korunacak, sadece eklemeler yapılacak.
- `scraper/orchestrator.py::handle_message` — `record` dict'ine `"source_group_name": payload.get("groupName")` satırı eklenecek.
- Testler: `bridge.decrypt-failed.test.js`, `bridge.risk-log.test.js`, `bridge.group-name.test.js` (node:test, mevcut `bridge.unhandled-log.test.js` deseni), `test_orchestrator_group_name.py` (mevcut orchestrator test konvansiyonu neyse ona uygun — code-copilot dispatch'inden önce `scraper/tests/` dizininde orchestrator'a özel bir test dosyası olup olmadığı kontrol edilecek, yoksa yeni oluşturulacak).
