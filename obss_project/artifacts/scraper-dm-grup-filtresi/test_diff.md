# Test Diff — scraper-dm-grup-filtresi

## Oluşturulan Dosya
`scraper/sidecar/bridge.filter.test.js` (yeni, `node:test` + `node:assert`, bağımlılık eklenmedi)

## AC → Test Eşleşmesi
| AC | Test |
|---|---|
| AC-1 | `isGroupJid: AC-1 — grup JID (@g.us ile biten) -> true` + `Integration AC-1/AC-S1` |
| AC-2 | `isGroupJid: AC-2 — DM JID (@s.whatsapp.net) -> false` + `Integration AC-2/AC-S1` |
| AC-3 | `@broadcast`/`@newsletter`/`@lid` -> false (3 ayrı test) |
| AC-4 | null/undefined/boş string -> false (3 ayrı test) |
| AC-5 | `Log AC-5/AC-S3` (sabit şablon, PII yok) |
| AC-6 | Entegrasyon testlerinde dolaylı doğrulanıyor (forwarded/skipped ayrımı `processIncomingMessage` implementasyonunda) |
| AC-S1 | `Integration AC-1/AC-S1`, `Integration AC-2/AC-S1` — fetch spy çağrı sayısı |
| AC-S2 | `@g.us.evil`, `fake@g.us@s.whatsapp.net`, `xxx@g.usX` -> false (3 ayrı test) |
| AC-S3 | `Log AC-5/AC-S3` — regex ile sabit şablon + PII yokluğu |
| AC-S4 | sayı (12345) ve obje ({}) -> false, exception yok (2 ayrı test) |

## Düzeltme Geçmişi
İlk sürüm, entegrasyon/log testlerinde gerçek handler'ı değil kendi
yazdığı `if (isGroupJid(...))` dalını çağırıyordu ("doğrudan tetikleme"
ihlali) — düzeltildi: artık hepsi `processIncomingMessage(msg)`'i (bridge.js'e
code-copilot tarafından eklenecek, henüz yok) doğrudan çağırıyor.

## Doğrulama
`npm install` (scraper/sidecar, ilk kez kuruldu) + `node --test` çalıştırıldı:
RED — `require.main === module` koruması henüz bridge.js'te olmadığı için
`BAILEYS_WEBHOOK_SECRET` yoksa `require('./bridge.js')` anında
`process.exit(1)` çağrılıyor. Bu, plan.md'nin "Doğrulama Sırasında Bulunan
Yapısal Engel" bölümünde code-copilot'a zorunlu talimat olarak verildi.
