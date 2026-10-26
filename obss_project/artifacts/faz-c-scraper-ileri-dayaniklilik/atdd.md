---
task_slug: faz-c-scraper-ileri-dayaniklilik
jira_id: EML-77
threat_model: done
priority: low
coverage_target: 90
performance_target: null
memory_target: "groupMetadata cache süresi sınırlı (TTL), sınırsız büyüme yok"
test_strategy:
  unit: 75
  integration: 20
  e2e: 5
affected_modules:
  - scraper/sidecar/bridge.js
  - scraper/orchestrator.py
  - supabase/migrations/
notion_url: https://app.notion.com/p/4058b4f5446681b69656dab8625dcfba?pvs=204
---

# ATDD — faz-c-scraper-ileri-dayaniklilik

## Jira Kaynağı
[EML-77 — decrypt-failed log + risk log + grup adı zenginleştirme](https://kuyusuzyusuf123.atlassian.net/browse/EML-77)

## Kapsam Düzeltmesi (plan aşamasında, 2026-10-26)
Orijinal backlog maddesi "retry desteği"ni de içeriyordu. **Plan aşamasında
Baileys kütüphanesinin gerçek kaynak kodu okunarak şu bulundu:**
`enableRecentMessageCache: true` Baileys'in VARSAYILAN ayarı
(`Defaults/index.js:73`) — bridge.js bunu hiç override etmiyor, yani zaten
aktif. Baileys'in dahili `MessageRetryManager`'ı decrypt edilen HER mesajı
(gönderilen + alınan) otomatik cache'liyor (`messages-recv.js`'de decrypt
sonrası `addRecentMessage` çağrılıyor) ve retry receipt geldiğinde önce bu
cache'e bakıyor. **Sonuç: "retry/getMessage desteği" sorunu zaten
varsayılan olarak çözülmüş durumda** — kendi cache'imizi inşa etmek
Baileys'in zaten yaptığı işi tekrarlardı, hiçbir ek fayda sağlamaz.
Kullanıcı kararıyla bu madde **kapsamdan tamamen çıkarıldı** (bkz. aşağıda
"Kapsam Dışı"). Görev artık sadece 3 alt-özelliği kapsıyor: decrypt-failed
log, risk log, grup adı zenginleştirme.

## Persona
Yusuf — scraper'ı tek başına işleten proje sahibi/operatör. Son kullanıcı (ilan arayan) bu değişikliği doğrudan görmez, dolaylı olarak daha az kayıp ilan görür.

## Hedef (Neden)
- **Decrypt-failed log:** Decrypt edilemeyen mesajlar şu an görünmüyor — kaç mesajın neden kaybolduğu ölçülebilir hale gelir.
- **Risk log:** Webhook hataları, tekrar eden ID, beklenmeyen JID gibi anomaliler fark edilmiyor — erken fark edilir hale gelir.
- **Grup adı zenginleştirme:** `source_group` ham JID tutuyor, insan tarafından okunamıyor — okunabilir hale gelir.

## User Story
As a scraper operatörü (Yusuf)
I want decrypt/risk görünürlüğü ve okunabilir grup adları
So that operasyonel sorunları erken fark edip ilanları daha iyi takip edebilirim

## Acceptance Criteria (Given-When-Then, önceliklendirilmiş)
1. [High] Given bir mesajın `message` alanı null/undefined (decrypt edilemedi, Baileys'te `messageStubType === proto.WebMessageInfo.StubType.CIPHERTEXT` olarak gelir) VEYA sadece protokol içeriği taşıyor (`senderKeyDistributionMessage` vb.), When işlenir, Then webhook'a POST edilmez, `bridge_unhandled_messages.log`'a `{timestamp, messageId, jidType, reason:"decrypt_failed"|"protocol_only"}` yazılır.
2. [Medium] Given grup metadata'sı başarıyla alınabiliyor, When bir grup mesajı işlenir, Then webhook payload'ına `groupName: "<subject>"` eklenir, `orchestrator.py` bunu `raw_listings.source_group_name` kolonuna yazar (JID, `source_group`'ta DEĞİŞMEDEN kalır).
3. [Medium] Given grup metadata alımı başarısız olur/3 saniyede zaman aşımına uğrar, When bir grup mesajı işlenir, Then mesaj yine webhook'a gönderilir (`groupName: null` ile), `bridge_risk.log`'a `{timestamp, category:"group_metadata_failed", count}` yazılır.
4. [Medium] Given webhook POST'u art arda 3 kez başarısız olur, When 3. deneme de başarısız olursa, Then mesaj düşürülür, `bridge_risk.log`'a `{timestamp, category:"webhook_post_failed_max_retries", messageId, count}` yazılır, bridge çalışmaya devam eder.
5. [Low] Given log dosyasına yazma başarısız olur (disk/izin hatası), When herhangi bir log satırı yazılmaya çalışılır, Then akış durmaz, sadece `console.error` ile (PII'siz) uyarı verilir.
6. [Critical] Given grup adı (`groupName`) saldırgan kontrollü bir string (newline/kontrol karakteri/log-injection denemesi içerebilir, örn. `"Grup\n[FAKE] admin girişi başarılı"`), When bu grup adıyla bir mesaj işlenir, Then `bridge_unhandled_messages.log` ve `bridge_risk.log` dosyalarının HİÇBİRİNDE grup adının içeriği (veya onun bir parçası) görünmez — bu dosyalar sadece sabit şablon + kategori/sayaç/messageId yazar, grup adı asla interpolasyona girmez. **(AC-S1 — threat-model)**

## Threat Model
Çağrıldı — AC-S1 yukarıdaki Acceptance Criteria'ya eklendi. STRIDE-lite: Spoofing/Repudiation/Elevation N/A (mevcut auth/log mekanizması değişmiyor). **Tampering/Info disclosure kesişimi** asıl risk — grup adı (WhatsApp grup yöneticisi tarafından rastgele ayarlanabilen, güvenilmeyen bir string) log injection'a açık olabilir; AC-S1 bu riski test edilebilir bir kritere çevirdi. DoS (groupMetadata rate-limit/ban riski) ATDD netleştirmesinde zaten cache+timeout ile ele alınmış (AC-3), ek bir AC-S gerekmedi. SQL injection yapısal olarak yok (Supabase client tüm değerleri parametreli gönderir, DB katmanında string concatenation yok) — bu bir mimari gerçek, ayrı bir runtime testi gerekmiyor.

## Davranış Sözleşmesi (hangi durumda ne döner)
| # | Durum | Dönen değer / durum kodu | Yan etki | Kullanıcı ne görür | AC |
|---|---|---|---|---|---|
| 1 | Decrypt başarısız/protokol-only | Webhook çağrılmaz, erken döner | `bridge_unhandled_messages.log`'a reason'lı satır | Operatör log'da görür | AC-1 |
| 2 | groupMetadata başarılı | Payload'da `groupName: "<subject>"` | `source_group_name` dolar | Kayıtta okunabilir grup adı | AC-2 |
| 3 | groupMetadata başarısız/timeout | Payload'da `groupName: null` | `bridge_risk.log`'a kategori+sayaç | Kayıtta grup adı boş, JID durur | AC-3 |
| 4 | Webhook 3x başarısız | Mesaj düşürülür | `bridge_risk.log`'a kategori+messageId+sayaç | Operatör log'da görür, ilan DB'ye girmez | AC-4 |
| 5 | Hiçbir şey yapılamadı ama hata yok (log yazma başarısız) | Fırlatılmaz, akış devam eder | Sadece `console.error` (PII'siz) | Hiçbir şey, stderr'de uyarı | AC-5 |
| 6 | Log-injection denemesi (grup adı) | Normal akış devam eder | Log dosyalarına grup adı İÇERİĞİ asla yazılmaz | Operatör log'da sadece kategori/sayaç görür | AC-S1 |

Kısmi başarı: N/A — her alt-özellik (log/zenginleştirme) kendi başına atomik, birbirine bağımlı bir çok-adımlı işlem yok.
Hiçbir şey yapılamadı ama hata da yok: satır 5 — log yazma başarısız olsa bile akış durmaz, sessizce "başarılı" denmez, sadece stderr'e düşer (zaten var olan davranış, bu görevde korunuyor).
Boş sonuç ↔ hata ayrımı: `groupName: null` (satır 3) "grup adı yok" değil "alınamadı" anlamına gelir — bu ayrım `bridge_risk.log`'daki `group_metadata_failed` kaydıyla yapılır; kayıt yoksa gerçekten boş/isimsiz bir durum olabilir (WhatsApp'ta nadir ama teorik olarak mümkün).

## Test Strategy
Unit: 75% — decrypt/protocol sınıflandırıcı, risk kategorileri/sayaçları, payload oluşturma, AC-S1'in log-injection testi.
Integration: 20% — mock Baileys socket ile `bridge()` event akışı (`cachedGroupMetadata`/`groupMetadata` mock'lanır), orchestrator'ın `source_group_name`'i gerçek Supabase'e yazması.
E2E: 5% — manuel canlı duman testi (Yusuf'un kendi WhatsApp testi, otomatik pipeline'ın parçası değil).

## Benchmark / Başarı Ölçütü
Coverage Target: %90 (yeni saf fonksiyonlar: sınıflandırıcı, risk sayaçları, grup adı seçimi).
Bilgi amaçlı metrikler (CI gate değil, sadece gözlem): decrypt_failed oranı işlenen grup mesajlarının %2'sinin altında kalmalı; groupName dolu oranı %95 üzerinde olmalı.
Diğer: Hiçbir log satırında metin/telefon numarası/grup adı İÇERİĞİ olmaması AC-S1 ile test edilir.

## Kapsam Dışı
- **Retry/getMessage desteği** — plan aşamasında Baileys'in bunu varsayılan olarak zaten çözdüğü bulundu, kullanıcı kararıyla tamamen çıkarıldı (yukarıdaki "Kapsam Düzeltmesi" notuna bakın).
- maviLojistik'in tam risk log şemasının birebir portu (sadece PII'siz temel kategori+sayaç taşınıyor).
- Mevcut `raw_listings` kayıtlarına grup adının geriye dönük doldurulması (backfill).
- Giden mesajlar için tam bir yeniden-gönderme sistemi.
- Webhook için kalıcı kuyruk/dead-letter yapısı.
- Alarm/bildirim (Slack, e-posta).
- Log rotasyonunun yeniden tasarlanması.

## Etkilenen Dosyalar/Modüller (bilinen)
- `scraper/sidecar/bridge.js` (ana değişiklik: decrypt-failed sınıflandırma, `bridge_risk.log`, `cachedGroupMetadata` + `groupMetadata` entegrasyonu)
- `scraper/orchestrator.py` (`groupName` → `source_group_name` eşlemesi)
- Yeni migration: `ALTER TABLE raw_listings ADD COLUMN source_group_name text NULL` (+ rollback)
- `scraper/tests/test_verify_supabase.py` (REQUIRED_TABLES zaten `raw_listings`'i kapsıyor, kolon listesi testi varsa güncellenecek — `plan` adımında kontrol edilecek)

## Proje Ortamı Kısıtı (arama/grep kapsamı)
Doğrulanmadı — önceki görevlerde de doğrulanmamış olarak not edilmişti. Arama/grep bu görevde `emlak-platform/` klasörüyle sınırlı tutulmalı.

## Rollback Beklentisi
Her alt-özellik ayrı bir env bayrağıyla açılıp kapatılabilir: `BRIDGE_ENABLE_GROUP_NAME`, `BRIDGE_ENABLE_RISK_LOG` (varsayılan: hepsi açık). Bayrak kapatılıp bridge yeniden başlatılır. Migration sadece nullable bir kolon ekliyor, geriye uyumlu — kod geri alınsa bile kolon kalabilir, veri kaybı riski yok.

## Risks
- **Kabul edilmiş risk:** Grup adı potansiyel PII içerebilir (kişi adı taşıyan gruplar) — sadece RLS korumalı `raw_listings` tablosuna yazılır, hiçbir log dosyasına yazılmaz (AC-S1 ile test edilir).
- **Kabul edilmiş risk:** `groupMetadata` çağrılarının sıklığı WhatsApp tarafında rate-limit/ban riski taşıyabilir — cache (TTL) + 3s timeout ile azaltılıyor, tam önlenmiyor.
- **Risk:** Migration canlıya uygulanmadan orchestrator yeni alanı yazmaya başlarsa INSERT başarısız olur — sıralama migration ÖNCE, kod SONRA olmalı (plan.md'de vurgulanacak).

## Assumptions
- `sock.groupMetadata(jid): Promise<GroupMetadata>` ve `GroupMetadata.subject: string` — **canlı Baileys type tanımlarından doğrulandı** (`node_modules/@whiskeysockets/baileys/lib/Socket/groups.d.ts`, `lib/Types/GroupMetadata.d.ts`).
- `cachedGroupMetadata: (jid: string) => Promise<GroupMetadata | undefined>` — Baileys'in dahili kullanım için sağladığı bir cache-okuma hook'u, varsayılanı `async () => undefined` — **canlı type tanımlarından doğrulandı** (`lib/Types/Socket.d.ts:133`). Bizim kendi cache'imizi (JID→GroupMetadata Map, TTL'li) bu hook'a bağlayıp HEM Baileys'in dahili kullanımına HEM kendi zenginleştirme ihtiyacımıza hizmet ettireceğiz.
- Decrypt hatası runtime'da `messageStubType === proto.WebMessageInfo.StubType.CIPHERTEXT` olarak gelir — **canlı Baileys kaynak kodundan doğrulandı** (`lib/Socket/messages-recv.js`, decrypt sonrası kontrol bloğu), varsayım değil.

## Unknowns
(Yok — tüm Baileys API varsayımları plan/atdd aşamasında canlı kaynak kodu okunarak doğrulandı.)

## Sorular ve Cevaplar (ham kayıt)
1. Persona → (Opus low alt-ajanı: Yusuf, operatör, son kullanıcı dolaylı etkileniyor)
2. Hedef/neden → (Opus low alt-ajanı: her biri için ayrı gerekçe, yukarıya işlendi — retry maddesi sonradan çıkarıldı)
3. Happy path — decrypt-failed log → (Opus low alt-ajanı: mevcut bridge_unhandled_messages.log'a reason alanı eklenir, ayrı dosya değil; **plan aşamasında Baileys kaynak kodundan CIPHERTEXT stub tipi doğrulandı**)
4. Happy path — risk log → (Opus low alt-ajanı: ayrı bridge_risk.log, kategoriler)
5. Happy path — grup adı → (Opus low alt-ajanı: JID VE grup adı birlikte taşınır, JID değiştirilmez — **plan aşamasında groupMetadata/subject VE cachedGroupMetadata hook'u doğrulandı**)
6. groupMetadata başarısız → (Opus low alt-ajanı: mesaj yine gönderilir, groupName:null, risk log + 3s timeout + TTL cache)
7. Davranış sözleşmesi tablosu → (Opus low alt-ajanı tarafından dolduruldu, retry satırları çıkarılarak yukarıya işlendi)
8. Başarı ölçütü → (Opus low alt-ajanı: %90 coverage, bilgi amaçlı oranlar)
9. Kapsam dışı → (Opus low alt-ajanı'nın listesi + retry maddesi, kullanıcı kararıyla EKLENDİ)
10. Bağımlılıklar/dosyalar → (Opus low alt-ajanı: bridge.js, orchestrator.py, yeni migration)
11. Güvenlik/performans kısıtı → (Opus low alt-ajanı: grup adı PII riski, cache'in rate-limit azaltması — AC-S1'e dönüştü)
12. Rollback → (Opus low alt-ajanı: env bayrakları + nullable migration, retry bayrağı çıkarıldı)
13. Kabul kriteri sahibi → (Opus low alt-ajanı: otomatik testler + Yusuf'un manuel canlı smoke testi)
14. Test stratejisi oranı → (Opus low alt-ajanı: unit 75/integration 20/e2e 5, retry cache testleri çıkarıldı)
15. Bilinen riskler/varsayımlar → (Opus low alt-ajanı'nın Unknown'ları: **plan aşamasında hepsi Baileys kaynak kodu/type tanımları okunarak ÇÖZÜLDÜ**)
16. Threat-model STRIDE taraması → (bu skill tarafından, doğrudan: Tampering/Info disclosure kesişimi asıl eksen, AC-S1'e döküldü)
17. **Kapsam düzeltmesi — retry/getMessage** → (`plan` adımında Baileys kaynak kodu okunarak: `enableRecentMessageCache:true` zaten varsayılan, dahili `MessageRetryManager` bunu zaten yapıyor — kullanıcı kararıyla madde tamamen kapsamdan çıkarıldı)
