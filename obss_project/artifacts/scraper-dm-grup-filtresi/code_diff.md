# Code Diff — scraper-dm-grup-filtresi

## Değiştirilen Dosya
`scraper/sidecar/bridge.js`

## Değişiklikler
- `isGroupJid(jid)` eklendi — `typeof` kontrolü + kesin sonek eşleşmesi (`endsWith('@g.us')`, `.includes()` değil) → AC-1..AC-4, AC-S2, AC-S4.
- `classifySkipType(jid)` eklendi — log kategorisini (`dm`/`other`/`invalid`) belirler, ham JID'i döndürmez.
- `processIncomingMessage(msg)` eklendi — `fromMe` kontrolü, filtre, grup değilse `skipped` sayaç + PII'siz sabit şablon log (`[filter] skipped (type=..., total_skipped=...)`), grup ise mevcut `toWebhookPayload`→`postMessage` akışı + `forwarded` sayaç.
- `messages.upsert` event listener'ı `processIncomingMessage`'a delege edildi.
- `WEBHOOK_SECRET` zorunlu kontrolü (`process.exit(1)`) ve `bridge().catch(...)` çağrısı `if (require.main === module)` içine alındı — `node bridge.js` davranışı değişmedi, `require()` ile test'ten import edilince yan etkili kod artık çalışmıyor.
- `module.exports = { isGroupJid, processIncomingMessage };` eklendi.

## Davranış Sözleşmesi Karşılanma Durumu
| AC | Durum |
|---|---|
| AC-1..AC-6 | ✅ |
| AC-S1..AC-S4 | ✅ |

## Doğrulama
`cd scraper/sidecar && node --test` → 16/16 PASS (orkestratör tarafından bağımsız olarak tekrar çalıştırıldı ve doğrulandı).

## Test Dosyasına Dokunulmadı
`scraper/sidecar/bridge.filter.test.js` değiştirilmedi — implementasyon teste uyduruldu, tersi değil.
