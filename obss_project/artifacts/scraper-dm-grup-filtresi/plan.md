# Plan — scraper-dm-grup-filtresi
_Reference: atdd.md_

Frontend-pipeline: tetikleyici yok (backend-only görev — tek etkilenen dosya
`scraper/sidecar/bridge.js`, hiçbir `.tsx`/`.jsx`/`.vue`/`.css`/sayfa bileşeni
yok, "Görsel/UI kriteri" atdd.md'de boş/"yok").

## Files to Modify
| File | Why | Risk | Alan |
|------|-----|------|------|
| scraper/sidecar/bridge.js | `isGroupJid(jid)` saf fonksiyonu eklenir. **Ayrıca** `messages.upsert` callback'inin İÇİNDEKİ tek-mesaj işleme mantığı (`fromMe` kontrolü → filtre → `toWebhookPayload` → `postMessage`) `async function processIncomingMessage(msg)` adıyla AYRI, dışa açılan bir fonksiyona çıkarılır — event listener sadece `for (const msg of messages) await processIncomingMessage(msg);` çağırır. Bu, testlerin gerçek handler mantığını (kendi yeniden-yazdıkları bir dalı değil) doğrudan tetikleyebilmesi için ZORUNLU (bkz. aşağıdaki "Doğrudan Tetikleme Düzeltmesi"). `forwarded`/`skipped` sayaçları ve PII içermeyen sabit-şablon log bu fonksiyonun içinde tutulur (AC-5, AC-6, AC-S3). `module.exports = { isGroupJid, processIncomingMessage }` ile ikisi de dışa açılır. `require.main === module` koşulu için yukarıdaki "Doğrulama Sırasında Bulunan Yapısal Engel" bölümüne bak. | medium | backend |

## New Files
| File | Purpose |
|------|---------|
| scraper/sidecar/bridge.filter.test.js | `isGroupJid` için tüm JID sınıflarını (AC-1..4, AC-S2, AC-S4) ve `postMessage` çağrı sayısını mock'layan handler-seviyesi entegrasyon testini (AC-S1) kapsar — Node'un yerleşik `node:test` + `node:assert` modülleriyle, yeni bir npm bağımlılığı eklemeden |

## Dependencies
- Mevcut `toWebhookPayload(msg)` ve `postMessage(payload)` fonksiyonlarının imzası/davranışı DEĞİŞMEZ — yeni filtre bunların ÖNÜNE eklenir, içlerine dokunulmaz (regresyon riskini azaltır, AC-1'i doğal olarak sağlar).
- `msg.key.remoteJid` zaten `toWebhookPayload`'da `from` olarak okunuyordu (satır 42) — yeni filtre aynı alanı, payload oluşturulmadan ÖNCE, handler seviyesinde (satır ~116-122) okur.
- Baileys kütüphanesinin JID sonek sözleşmesine (`@g.us` = grup, `@s.whatsapp.net` = DM, `@broadcast`/`@newsletter`/`@lid` = diğer) bağımlılık — atdd.md'nin Assumptions bölümünde zaten işaretli, kod değişikliği bu varsayımı doğrulamaz, sadece üzerine inşa eder.
- `scraper/sidecar/package.json`'da `"type": "commonjs"` — yeni test dosyası da CommonJS (`require`) kullanmalı, ESM import değil (mevcut `bridge.js` ile tutarlı).

## Migration Required?
Hayır — hiçbir şema/veri değişikliği yok, bu görev tamamen `bridge.js`
içinde çalışma-zamanı (runtime) bir filtre.

## Node Sürümü Doğrulaması (atdd.md Unknowns'tan taşındı)
Doğrulandı: yerel ortamda `node --version` → v25.8.0 (node:test modülü Node
18+'da mevcut, bolca yeterli). Sidecar için ayrı bir Dockerfile/CI pin'i
bulunamadı (`scraper/sidecar/` altında Dockerfile yok, proje kökünde de
docker-compose/Dockerfile yok — sidecar doğrudan host'ta `node bridge.js`
ile çalıştırılıyor, bkz. README "WhatsApp sidecar (Node.js)" bölümü).
Üretim/deploy ortamındaki Node sürümü bu oturumda ayrıca teyit edilmedi
(yerel geliştirme makinesiyle aynı olduğu varsayılıyor) — bu, `verify`
adımında test çalıştırılırken (`node --test`) doğal olarak tekrar
doğrulanmış olacak, ayrı bir aksiyon gerekmiyor.

## Doğrulama Sırasında Bulunan Yapısal Engel (ZORUNLU — code-copilot bunu uygulamalı)
`node --test` ile red-step testleri (npm bağımlılıkları kurulduktan sonra)
çalıştırıldığında, test dosyasının `require('./bridge.js')` satırı tüm
script'i tetikliyor: dosyanın en üstündeki `BAILEYS_WEBHOOK_SECRET` env
kontrolü `process.exit(1)` çağırıyor (env test ortamında set değilse test
süreci anında ölüyor), dosyanın en altındaki `bridge().catch(...)` de aynı
şekilde `require` anında WhatsApp bağlantısı kurmaya çalışıyor. Bu, saf
`isGroupJid` fonksiyonunu izole test etmeyi imkânsız kılıyor.

**code-copilot için zorunlu değişiklik:** `bridge.js`'in en altındaki
`bridge().catch(...)` çağrısı ve dosyanın üstündeki `WEBHOOK_SECRET` zorunlu
kontrolü, `require.main === module` koşuluna alınmalı (yalnızca `node
bridge.js` ile doğrudan çalıştırıldığında tetiklensin, `require()` ile
import edildiğinde DEĞİL). `module.exports = { isGroupJid }` bu koşulun
DIŞINDA, dosyanın her zaman normal şekilde export edeceği yerde kalmalı.
Bu, `node bridge.js` ile üretim çalıştırmasını DEĞİŞTİRMEZ (script hâlâ
`require.main === module` olduğu için aynen çalışır) — sadece test
dosyasının onu yan etkisiz import edebilmesini sağlar.

## Doğrudan Tetikleme Düzeltmesi (test-copilot'un ilk red-step çıktısında bulundu)
İlk yazılan `bridge.filter.test.js`, entegrasyon ve log testlerinde gerçek
handler'ı çağırmak yerine `if (isGroupJid(jid)) { postMessage(...) }` /
`console.log(...)` dalını TESTİN KENDİSİNDE tekrar yazmıştı — bu, atdd'nin
"Doğrudan tetikleme" kuralını ihlal eder: implementasyon filtreyi yanlış
yerde çağırsa veya hiç çağırmasa bile bu testler yine geçerdi, çünkü gerçek
`processIncomingMessage`'ı hiç tetiklemiyorlardı. **Düzeltme: testler artık
yukarıdaki `processIncomingMessage(msg)`'i DOĞRUDAN çağırmalı** (örn.
`await processIncomingMessage({ key: { remoteJid: groupJid, id: 'msg-1', fromMe: false }, message: { conversation: 'test' } })`),
sonra `fetch`/`postMessage` spy'ının çağrı sayısını ve log satırını
doğrulamalı — kendi "if" dalını yazmamalı. `test-copilot`'a bu düzeltme
talimatı dispatch edilecek.

## Risks
(atdd.md'den taşınan + bu adımda netleşen)
- Baileys'in JID formatını gelecekte değiştirmesi → fail-closed davranır,
  `forwarded` sayacıyla operatör fark eder (atdd.md Risks'ten birebir).
- `raw_listings`'de bu düzeltmeden ÖNCE sızmış geçmiş DM verisi bu görevle
  temizlenmiyor — backlog'a (`is-listesi-ve-sayfa-envanteri.md`, madde 23)
  ayrı bir iş olarak eklendi, gerçek kullanıcı kararı gerektiriyor.
- Kod keşfinde yeni bulunan düşük risk: `bridge.js`'in şu an hiçbir
  `module.exports`'u yok (tek dosyalık script olarak çalıştırılıyor,
  `require`'lanmıyor) — `isGroupJid`'i test edilebilir kılmak için
  `module.exports = { isGroupJid }` eklemek gerekiyor; bu, `node bridge.js`
  ile doğrudan çalıştırmayı etkilemez (Node, `require.main === module`
  kontrolü olmadığı sürece script zaten en alttaki `bridge().catch(...)`
  çağrısıyla çalışır) — risk düşük ama `test-copilot`/`code-copilot`'un
  bunu unutmaması için not düşüldü.

## Open Questions
Yok. atdd.md'nin Unknowns bölümündeki tek madde (Node sürümü) yukarıda
"Node Sürümü Doğrulaması" ile bu adımda çözüldü — kullanıcıya/customer'a
tekrar sorulacak açık bir soru kalmadı.
