---
task_slug: scraper-dm-grup-filtresi
jira_id: EML-51
threat_model: done
priority: high
coverage_target: 90
performance_target: null
memory_target: null
test_strategy:
  unit: 90
  integration: 10
  e2e: 0
affected_modules:
  - scraper/sidecar/bridge.js
  - scraper/sidecar/bridge.filter.test.js
notion_url: https://app.notion.com/p/4018b4f544668153a90ae57f457c4966?pvs=204
---

# ATDD — scraper-dm-grup-filtresi

## Jira Kaynağı
[EML-51 — scraper-dm-grup-filtresi: bridge.js özel mesajları (DM) grup mesajlarından ayırmıyor — PII sızıntısı riski](https://kuyusuzyusuf123.atlassian.net/browse/EML-51) — `jira-sync` ile oluşturuldu, "Devam Ediyor"a geçirildi.
User Story: ayrı bir Jira User Story alanı yok, açıklama description alanında.
AC: Jira issue'sunda henüz sadece sorun tanımı var; aşağıdaki AC listesi bu adımda üretildi, Hard Stop onayından sonra (jira-sync adım B) issue açıklaması bu dosyanın tam içeriğiyle güncellenecek.

## Persona
Yusuf — scraper'ı işleten kişi/proje sahibi (doğrudan kullanıcı). Dolaylı paydaş: DM'leri yanlışlıkla toplanabilecek, scraper'ın hiç haberdar olmadığı üçüncü kişiler (veri sahipleri) — bu filtre esas olarak onların mahremiyetini korumak için yazılıyor.

## Hedef (Neden)
`scraper/sidecar/bridge.js` şu an WhatsApp'tan gelen HER mesajı (grup + özel/DM, ayrım yapılmadan) `orchestrator.py`'ye POST ediyor; orchestrator bunu Gemini'ye gönderip `raw_listings` tablosuna yazıyor. Grup dışı (DM/broadcast/newsletter/bilinmeyen) hiçbir mesaj sidecar dışına (webhook, Gemini, Supabase) çıkmamalı — bu, ilgisiz üçüncü kişilerin özel mesajlarının (telefon numarası + içerik) PII olarak sızmasını önler.

## User Story
As a scraper'ı işleten proje sahibi (Yusuf)
I want bridge.js'in sadece grup mesajlarını (`@g.us`) iletmesini, DM/bilinmeyen format mesajları fail-closed olarak düşürmesini
So that ilgisiz kişilerin özel WhatsApp mesajları hiçbir zaman webhook'a/Gemini'ye/veritabanına ulaşmasın

## Acceptance Criteria (Given-When-Then, önceliklendirilmiş)
1. [Critical] Given bir grup mesajı (`remoteJid` tam olarak `@g.us` ile bitiyor), When `messages.upsert` handler'ı çalışıyor, Then mesaj mevcut davranıştaki gibi `postMessage` ile webhook'a POST edilir (regresyon yok).
2. [Critical] Given bir DM/özel mesaj (`remoteJid` `@s.whatsapp.net` ile bitiyor), When handler çalışıyor, Then `postMessage` HİÇ çağrılmaz (webhook'a, dolayısıyla Gemini'ye ve Supabase'e hiç ulaşmaz).
3. [High] Given `remoteJid` bilinmeyen bir formatta (`@broadcast`, `@newsletter`, `@lid` vb.), When handler çalışıyor, Then fail-closed: `postMessage` çağrılmaz (yalnızca `@g.us` allowlist'e girer, her şey diğeri düşer).
4. [High] Given `remoteJid` null/undefined/boş string/string-olmayan bir değer, When handler çalışıyor, Then exception fırlatılmadan mesaj düşürülür, süreç çökmez.
5. [High] Given bir mesaj filtre tarafından atlandı (DM/bilinmeyen/geçersiz), When log yazılıyor, Then log satırı yalnızca sabit bir kategori etiketi (`dm`|`other`|`invalid`) ve bir sayaç içerir — telefon numarası, JID veya mesaj metni asla loglanmaz.
6. [Medium] Given periyodik/özet durum, When sidecar çalışıyor, Then `forwarded`/`skipped` sayaçları ayrı ayrı tutulur ki "forwarded uzun süre 0" gibi bir anomali operatör tarafından fark edilebilsin.

### Güvenlik Kriterleri (threat-model, `AC-S<n>`)
7. [Critical] **AC-S1** — Given filtre, mesajın webhook'a POST edilip edilmeyeceğine `toWebhookPayload`/`postMessage` çağrılmadan ÖNCE, handler'ın en başında (`fromMe` kontrolünün hemen yanında) karar verir, When filtre reddeder, Then o mesaj için **sıfır** ağ çağrısı yapılır (webhook POST yok, dolayısıyla Gemini/Supabase'e de hiç ulaşmaz) — test, `fetch`/`postMessage` spy'ının 0 kez çağrıldığını doğrudan doğrular (vekil sinyal değil).
8. [Critical] **AC-S2** — Given saldırgan/kazara bir JID'in `@g.us` alt-dizesini (substring) TAŞIYAN ama gerçek bir grup JID'i OLMAYAN bir değer üretmesi (ör. `120363xxx@g.us.evil`, `fake@g.us@s.whatsapp.net`, `@g.usX`), When filtre çalışıyor, Then bu JID'ler allowlist'e GİRMEZ — kontrol kesin sonek eşleşmesiyle (`jid.endsWith('@g.us')` ve bundan sonra başka karakter YOK) yapılır, `.includes('@g.us')` gibi bir alt-dize kontrolü KULLANILMAZ. Test, bu üç örnek JID'in hepsinin filtrelendiğini (POST edilmediğini) doğrudan doğrular.
9. [High] **AC-S3** — Given bir mesaj filtre tarafından atlanıyor, When log satırı üretiliyor, Then log formatı sabit bir şablondur (`[filter] skipped (type=<enum>, total_skipped=<int>)`) — mesaj metni veya JID asla string'e enterpolasyon/concatenation ile eklenmez; bu, hem PII sızıntısını hem de saldırganın mesaj içeriğine (newline/kontrol karakteri) log injection yapmasını engeller.
10. [Medium] **AC-S4** — Given `remoteJid` beklenmeyen bir tipte (obje, sayı, Symbol vb.), When filtre fonksiyonu çağrılıyor, Then fonksiyon `typeof` kontrolüyle güvenli şekilde `false` döner, exception fırlatmaz (AC-4'ün güvenlik tarafı: tip karmaşası DoS'a yol açmamalı).

## Threat Model
Çağrıldı — Tetikleyiciler: kişisel veri (KVKK — üçüncü kişilerin özel WhatsApp mesajları/telefon numaraları) ve dış API çağrısı (Gemini, Supabase). STRIDE-lite uygulandı:
- **Spoofing**: N/A bu değişiklik için — bridge.js↔orchestrator.py arası kimlik doğrulama zaten EML-20'de (Bearer secret, fail-closed) çözüldü; bu görev yalnızca içerik filtrelemesi ekliyor.
- **Tampering**: Ana risk — JID alt-dize sahteciliğiyle filtrenin atlatılması. → AC-S2.
- **Repudiation**: Atlanan mesajlar için sayaç+kategori logu zaten AC-6/AC-S3 ile karşılanıyor, ayrı bir repudiation riski yok.
- **Information disclosure**: Ana risk — DM/bilinmeyen mesajların Gemini'ye/Supabase'e/log'a sızması. → AC-S1 (ağ çağrısı sıfır), AC-S3 (log'da PII yok).
- **DoS**: Malformed JID ile sidecar'ın çökmesi. → AC-4/AC-S4 (exception yok, fail-closed).
- **Elevation**: N/A — bu akışta rol/yetki kavramı yok.

AC-S1..AC-S4 yukarıdaki Acceptance Criteria'ya eklendi.

## Davranış Sözleşmesi (hangi durumda ne döner)
| # | Durum | Dönen değer / durum kodu | Yan etki | Kullanıcı ne görür | AC |
|---|---|---|---|---|---|
| 1 | Grup mesajı (`@g.us`) | `postMessage` çağrılır (mevcut davranış, HTTP POST) | orchestrator → Gemini → `raw_listings`'e yazılabilir; `forwarded` sayacı +1 | sessiz; periyodik özet logunda `forwarded` sayısı artar | AC-1 |
| 2 | DM (`@s.whatsapp.net`) | `postMessage` ÇAĞRILMAZ, fonksiyon early-return | hiçbir dış çağrı yok (webhook/Gemini/DB yok); `skipped` sayacı +1 | konsolda PII'siz bilgi logu: `[filter] skipped (type=dm, total_skipped=N)` | AC-2, AC-S1 |
| 3 | Bilinmeyen format (`@broadcast`/`@newsletter`/`@lid` vb.) ve JID-sahteciliği denemeleri (`@g.us.evil` vb.) | `postMessage` ÇAĞRILMAZ, fail-closed early-return | dış çağrı yok; `skipped` +1 | PII'siz log: `type=other` | AC-3, AC-S2 |
| 4 | `remoteJid` null/undefined/boş/string-olmayan | `postMessage` ÇAĞRILMAZ, exception YOK | dış çağrı yok; `skipped` +1; süreç çökmez | PII'siz log: `type=invalid` | AC-4, AC-S4 |
| 5 | Kısmi başarı | N/A — bu saf (pure), yan etkisiz bir ikili filtre kararı; mesaj ya tamamen iletilir ya tamamen düşer, ara durum yok | — | — | — |
| 6 | Hiçbir şey yapılamadı ama hata da yok (DM/bilinmeyen atlandı) | Bu BEKLENEN ve NORMAL bir sonuçtur, hata değildir — "sessiz başarı" riski burada geçerli değil çünkü atlama zaten amaçlanan davranış ve sayaçla görünür kılınıyor | sadece `skipped` sayacı artar | bilgi seviyesinde log (warn/error değil); `forwarded` uzun süre 0 kalırsa operatör için anomali sinyali | AC-6 |

Kısmi başarı: Uygulanmayan satır (yukarıda #5) — filtre saf/senkron bir fonksiyon, dış sistemle etkileşime girmeden karar veriyor; "bir kısmı oldu kalanı olmadı" durumu mimari olarak mümkün değil.
Hiçbir şey yapılamadı ama hata da yok: AC-6'da tanımlı — DM/bilinmeyen format atlanması "hata" değil, filtrenin doğru çalıştığının kanıtı; sessizce gizlenmiyor, sayaçla görünür.
Boş sonuç ↔ hata ayrımı: Bu görevde "boş sonuç" kavramı yok (webhook'a hiç istek gitmiyor, 200/404 gibi bir HTTP yanıtı söz konusu değil) — filtre tarafı için tek ayrım `forwarded` vs `skipped` sayaçlarıdır, ikisi de ayrı tutulur.

## Test Strategy
Unit: 90% — `isGroupJid`/`shouldForward` saf fonksiyonunun tüm JID sınıfları için (`@g.us`, `@s.whatsapp.net`, `@broadcast`, `@newsletter`, `@lid`, null, undefined, boş string, string-olmayan tip, `@g.us` alt-dize sahteciliği örnekleri) doğrudan test edilmesi.
Integration: 10% — mock edilmiş `fetch`/`postMessage` ile `messages.upsert` handler akışının uçtan uca (DM'de 0 çağrı, grup'ta 1 çağrı) doğrulanması.
E2E: 0% — gerçek WhatsApp bağlantısı gerektirir, deterministik değil, bu görevde kapsam dışı.

## Benchmark / Başarı Ölçütü
Coverage Target: 90%
Performance Target: yok (string sonek kontrolü, ihmal edilebilir maliyet)
Memory: yok
Görsel/UI kriteri: yok (bu görev UI içermiyor, backend/altyapı — `frontend-pipeline` tetiklenmez)
Diğer ölçülebilir kriterler:
- Grup olmayan JID'lerin %100'ünde `postMessage` sıfır kez çağrılır (test ile doğrulanır).
- `@g.us` JID'lerin %100'ünde `postMessage` tam bir kez çağrılır.
- Log çıktısında telefon numarası veya mesaj metni sıfır kez geçer (test ile regex/içerik kontrolüyle doğrulanır).

## Kapsam Dışı
- Grup allowlist'i (hangi SPESİFİK grupların izinli olduğu) — bu görev sadece "grup mü DM mi" ayrımı yapıyor, "hangi grup" sorusu ayrı bir Jira görevi olarak açılacak (backlog'a not düşülecek).
- `orchestrator.py` tarafında herhangi bir değişiklik — filtre tamamen `bridge.js` tarafında, kaynakta uygulanıyor.
- Bridge.js↔orchestrator.py arası kimlik doğrulama/secret yönetimi — EML-20'de zaten çözüldü, bu görevin kapsamı dışında.
- Mevcut `raw_listings` tablosunda daha önce (bu düzeltmeden önce) sızmış olabilecek DM verilerinin temizlenmesi/geriye dönük silinmesi — ayrı bir veri temizliği görevi gerektirir, bu görev sadece YENİ sızıntıyı durdurur.

## Etkilenen Dosyalar/Modüller (bilinen)
- `scraper/sidecar/bridge.js` — `isGroupJid(jid)` (saf fonksiyon) eklenir, `messages.upsert` handler'ında `postMessage`'dan/`toWebhookPayload`'dan önce çağrılır; `forwarded`/`skipped` sayaçları eklenir.
- `scraper/sidecar/bridge.filter.test.js` (yeni) — Node'un yerleşik `node:test` modülüyle, yeni bir npm bağımlılığı gerektirmeden.

## Proje Ortamı Kısıtı (arama/grep kapsamı)
Doğrulanmadı — bu makinede git reposunun kökü proje klasörüyle (`emlak-platform/`) aynı mı yoksa daha geniş bir dizin mi, teyit edilmedi. Sonraki adımlarda (`plan`, `code-copilot`/`test-copilot`) arama gerçek proje klasörüyle (`emlak-platform/scraper/`) sınırlanmalı, kök dizinden sınırsız `grep -r`/`git log -p --all` kullanılmamalı.

## Rollback Beklentisi
Değişiklik tek, izole bir commit'te (`bridge.js` + yeni test dosyası) yapılacak; filtre yanlışlıkla grup mesajlarını da engellerse bu `forwarded` sayacının 0'da kalmasıyla operatör tarafından fark edilir (AC-6) ve commit revert edilerek eski (filtresiz) davranışa dönülebilir — bu süre zarfında PII sızıntı riski geri gelir ama servis kesintisi (grup mesajlarının toplanamaması) önceliklidir, geçici PII riskine karşı ayrı bir aksiyon gerekmez çünkü revert dakikalar içinde yapılabilir.

## Risks
- Baileys kütüphanesinin JID formatını gelecekte değiştirmesi (ör. yeni bir JID sonek türü eklemesi) — bu durumda yeni sonek allowlist'te olmadığı için fail-closed davranır (mesaj düşer), bu güvenlik açısından doğru taraf ama grup mesajlarının da yanlışlıkla düşmesine yol açabilir; `forwarded` sayacıyla operatör bunu fark edip filtreyi güncelleyebilir. Kabul edilen risk — fail-safe tarafı PII sızıntısından daha az zararlı.
- `raw_listings` tablosunda bu düzeltmeden ÖNCE sızmış olabilecek geçmiş DM verileri bu görevle temizlenmiyor (bkz. Kapsam Dışı) — ayrı bir manuel/otomatik temizlik gerekebilir, kullanıcıya Hard Stop'ta ayrıca hatırlatılacak.

## Assumptions
- Baileys kütüphanesinin grup JID'leri her zaman tam olarak `@g.us` soneki ile ürettiği varsayılıyor (kütüphane kaynağı bu görev kapsamında doğrulanmadı, Baileys'in genel bilinen davranışına dayanıyor) — varsayım.
- JS tarafında şu an hiçbir test altyapısı/koşucusu yok, bu yüzden Node'un yerleşik `node:test` modülü kullanılacak varsayımı — yeni bağımlılık eklememek için.

## Unknowns
- Üretimde bu sidecar'ın Docker/host ortamında Node sürümü (`node:test` desteği Node 18+ gerektirir) teyit edilmedi — `plan` adımında `package.json`/Dockerfile'dan doğrulanmalı.

## Sorular ve Cevaplar (ham kayıt)
1. Persona → Yusuf, scraper'ı işleten kişi; dolaylı paydaş DM'leri yanlışlıkla toplanan üçüncü kişiler. (Opus low alt-ajanı tarafından yanıtlandı: PII filtresi doğrudan bu paydaşları korumak için yazılıyor)
2. Ana hedef/neden → onaylandı, hiçbir grup-dışı mesaj sidecar dışına çıkmamalı. (Opus low alt-ajanı tarafından yanıtlandı: kök neden filtresiz POST, düzeltme kaynakta yapılmalı)
3. Happy path → grup mesajı değişmeden akar (adım adım, bkz. yukarıda). (Opus low alt-ajanı tarafından yanıtlandı: regresyon olmamalı)
4. Edge case — bilinmeyen JID formatları → fail-closed (allowlist, denylist değil). (Opus low alt-ajanı tarafından yanıtlandı: denylist yeni formatlarda sızıntıyı tekrar açar)
5. Edge case — boş/null remoteJid → düşürülür, exception yok. (Opus low alt-ajanı tarafından yanıtlandı: bozuk veri sidecar'ı çökertmemeli)
6. Davranış sözleşmesi/log PII → sadece kategori+sayaç, numara/JID/metin yok. (Opus low alt-ajanı tarafından yanıtlandı: log de bir sızıntı yüzeyi)
7. Başarı ölçütü → %100 DM'de 0 POST, %100 grupta 1 POST, log'da PII 0. (Opus low alt-ajanı tarafından yanıtlandı: ikili, deterministik, CI'da ölçülebilir)
8. Kapsam dışı — grup allowlist'i → ayrı görev. (Opus low alt-ajanı tarafından yanıtlandı: farklı bir config/yönetim konusu)
9. Bağımlılıklar → bridge.js + yeni `bridge.filter.test.js`. (Opus low alt-ajanı tarafından yanıtlandı: JS tarafında şu an test yok)
10. Performans/güvenlik kısıtı → filtre `toWebhookPayload`'dan önce, handler başında. (Opus low alt-ajanı tarafından yanıtlandı: payload oluşturulmadan erken çıkış, hiçbir yere veri gitmez)
11. Rollback/görünürlük → forwarded/skipped sayaçları + tek commit revert. (Opus low alt-ajanı tarafından yanıtlandı: sessiz veri kaybı sayaçla fark edilir)
12. Test stratejisi → 90/10/0. (Opus low alt-ajanı tarafından yanıtlandı: saf fonksiyon, e2e maliyetli ve deterministik değil)
13. (threat-model) JID alt-dize sahteciliğiyle filtre atlatma riski → AC-S2 ile kesin sonek eşleşmesi (`endsWith`, `includes` değil) zorunlu kılındı. (Bu oturumda threat-model adımında üretildi)
14. (threat-model) Log injection / PII-in-logs riski → AC-S3 ile sabit şablon log, hiçbir zaman mesaj/JID interpolasyonu yok. (Bu oturumda threat-model adımında üretildi)
