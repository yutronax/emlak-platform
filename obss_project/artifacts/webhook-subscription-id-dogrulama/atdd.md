---
task_slug: webhook-subscription-id-dogrulama
jira_id: EML-30
threat_model: done
priority: high
coverage_target: 90
performance_target: null
memory_target: null
test_strategy:
  unit: 50
  integration: 40
  e2e: 10
affected_modules:
  - web/src/app/api/webhooks/payment/route.ts
---

# ATDD — webhook-subscription-id-dogrulama

## Jira Kaynağı
[EML-30 — [P0] Webhook subscription_id DB eşleşmesi doğrulaması (P0-5 + P1-11)](https://kuyusuzyusuf123.atlassian.net/browse/EML-30)
Kaynak: `is-listesi-ve-sayfa-envanteri.md` P0-5/P1-11, `emlak-platform-customer`
session önerisi (2026-10-20).

## Persona
iyzico webhook servisi (imzalı, meşru çağıran) — ama imza geçerli olsa da
olaydaki `subscription_id`nin DB'deki kaydın GERÇEK durumuyla eşleştiği
hiç doğrulanmıyor; bu görev o boşluğu kapatıyor. İkincil persona: sistemi
izleyen admin (needs_review durumunun kalıcı/görünür olmasına güvenen taraf).

## Hedef (Neden)
Webhook, imza geçerliyse herhangi bir `subscription_id`yi koşulsuzca
güncelleyebiliyor (yanlış/eski durumdaki bir kaydı da) ve bir DB hatası
oluştuğunda `needs_review` durumu yalnızca response body'de görünüyor,
`subscriptions` tablosuna hiç yazılmıyor — yani bir kayıp sessizce
kaybolabiliyor, hiçbir admin bunu göremiyor. (Opus alt-ajanı tarafından
yanıtlandı)

## User Story
As a ödeme sistemi işletmecisi (Yusuf)
I want webhook'un bir subscription'ı sadece beklenen durumdaysa güncellemesini
  ve güncelleme başarısız olursa bu durumun kalıcı olarak kayda geçmesini
So that yanlış durumdaki bir kayıt sessizce bozulmasın ve kaybolan bir
  güncelleme fark edilebilir olsun

## Acceptance Criteria (Given-When-Then, önceliklendirilmiş)
1. [Critical] Given `subscriptions` kaydı `status="pending"`, When
   `PAYMENT_SUCCESS` event'i (geçerli imzayla) geliyor, Then koşullu
   update (`.eq("status","pending")`) çalışır, kayıt `active` olur,
   `current_period_end` set edilir, yanıt `{received:true}`.
2. [Critical] **AC-S1 (Tampering — durum koşulu)** Given `subscriptions`
   kaydı ZATEN `status="active"` (duplicate/retry event), When aynı veya
   başka bir `PAYMENT_SUCCESS` event'i geliyor, Then koşullu update 0
   satır etkiler (status koşulu eşleşmez), hiçbir alan değişmez, yanıt
   hâlâ `{received:true}` (idempotent no-op, hata değil).
3. [High] Given `subscriptions` kaydı `status="failed"` (daha önce
   reddedilmiş), When sonradan bir `PAYMENT_SUCCESS` event'i geliyor
   (beklenmeyen/anomali durum), Then koşullu update 0 satır etkiler,
   kayıt `needs_review`'a ayrıca ÇEKİLİR (ayrı bir update), durum
   `payment_events`'e not düşülür, admin için görünür olur.
4. [Critical] **AC-S2 (Info disclosure — oracle yok)** Given
   `subscription_id` DB'de HİÇ YOK (typo/deneme), When event (geçerli
   imzayla) geliyor, Then yanıt YİNE `{received:true}` ve HTTP 200
   döner (404 DEĞİL — provider'a id varlığı sızdırılmaz, ayrıca
   webhook sözleşmesi 4xx/5xx'e retry-fırtınasıyla karşılık verir),
   `console.warn` ile loglanır, hiçbir DB yazması olmaz.
5. [Critical] Given update çağrısı bir DB HATASI fırlatıyor (network/
   timeout — "var olmayan kayıt" değil, gerçek bir hata), When event
   işleniyor, Then ayrı ve minimal bir `status="needs_review"` update'i
   BİR KEZ denenir; bu da başarısız olursa `payment_events` satırına
   `processing_error` işareti yazılır (ayrı bir update/alan, no-op
   DEĞİL) ve yanıt 500 döner (provider'ın kendi retry mekanizması
   devreye girsin, idempotency `provider_event_id` ile korunur).
6. [Medium] Given `event_type` `PAYMENT_SUCCESS`/`PAYMENT_FAILED` dışında
   bilinmeyen bir değer, When event geliyor, Then hiçbir `subscriptions`
   güncellemesi yapılmaz, `{received:true}` 200 döner, `console.warn`
   ile loglanır (mevcut davranışla aynı, bilinçli olarak dar tutuldu).
7. [High] Given bir `needs_review`'a düşen kayıt, When admin bunu
   sorgulamak istiyor, Then `subscriptions.status = 'needs_review'`
   gerçek bir DB satırı olarak sorgulanabilir (önceki davranışta sadece
   response body'de vardı, kalıcı DEĞİLDİ).

## Threat Model
Çağrıldı — STRIDE-lite: Spoofing zaten EML-20/EML-5'te HMAC imzasıyla
kapatıldı, bu görevde tekrar edilmedi. AC-S1 (Tampering: durum koşullu
update, yanlış/eski durumdaki bir kaydın sessizce ezilmesi önlenir),
AC-S2 (Info disclosure: var olmayan id için 404 DEĞİL, hep 200 — oracle
verilmez) eklendi. Repudiation: `payment_events` zaten ham payload'ı
logluyor, bu görevde `processing_error` alanıyla güçlendirildi (AC-5).
DoS/Elevation: bu değişiklik kapsamında uygulanamaz, atlandı.

## Davranış Sözleşmesi (hangi durumda ne döner)
| # | Durum | Dönen değer / durum kodu | Yan etki | Kullanıcı ne görür | AC |
|---|---|---|---|---|---|
| 1 | Happy path (pending→active) | 200 + `{received:true}` | `status=active`, `current_period_end` set | (iyzico tarafı) sessiz başarı | AC-1 |
| 2 | Kısmi başarı / duplicate (zaten active) | 200 + `{received:true}` | HİÇBİR alan değişmez (0 satır etkilenir) | — | AC-S1 |
| 3 | Anomali (failed→success denemesi) | 200 + `{received:true}` | `needs_review`'a çekilir (ayrı update) + `payment_events` notu | admin: sorgulanabilir needs_review satırı | AC-3 |
| 4 | subscription_id yok | 200 + `{received:true}` | YOK, sadece `console.warn` | — | AC-S2 |
| 5 | DB hatası (gerçek) | 500 (ilk denemede) veya 200 (needs_review update başarılıysa) | `needs_review` update denenir; o da başarısızsa `payment_events.processing_error` | admin: processing_error işaretli satır | AC-5 |
| 6 | Bilinmeyen event_type | 200 + `{received:true}` | YOK | — | AC-6 |
| 7 | Hiçbir şey yapılamadı ama hata yok | Oluşmaz — her dal (no-op dahil) `console.warn`/`console.error` ile loglanır, sessiz geçen hiçbir dal yok | — | — | AC-S1, AC-S2, AC-5 |

Kısmi başarı: Koşullu update 0 satır etkilediğinde (AC-S1/AC-3) bu açıkça
"hiçbir şey değişmedi" olarak loglanır — "satır bulunamadı" (AC-S2) ile
"satır bulundu ama durum koşulu uymadı" (AC-S1/AC-3) ayrı loglanır, ikisi
karıştırılmaz.
Hiçbir şey yapılamadı ama hata yok: Yukarıdaki tüm no-op dalları (AC-S1,
AC-S2, AC-6) açıkça loglanır — sessiz "başarı" görüntüsü veren ama hiçbir
iz bırakmayan bir dal yok.
Boş sonuç ↔ hata ayrımı: "Kayıt yok" (AC-S2, log: subscription_id
bulunamadı) ile "kayıt var ama DB hatası" (AC-5, log: güncelleme
başarısız + processing_error) açıkça farklı log mesajlarıyla ayrılır.

## Test Strategy
Unit: 50% — koşullu update mantığının saf kararı (hangi durumda hangi
patch/no-op), event_type -> status eşlemesi, `processing_error` yazma
kararı.
Integration: 40% — gerçek Supabase'e karşı: pending->active geçişi,
active üzerine tekrar gelen event'in no-op kalması, failed->needs_review
geçişi, var olmayan id için no-op+200, gerçek bir DB hatası simülasyonu
(geçersiz foreign key/benzeri ile).
E2E: 10% — gerçek bir iyzico sandbox webhook'u bu görevin kapsamında
DEĞİL (iyzico entegrasyonu zaten doğrulanmamış, bkz. Risks).

## Benchmark / Başarı Ölçütü
Coverage Target: Değişen webhook dosyasında satır kapsamı %90, dal
kapsamı %85 (ödeme/güvenlik yolu, her hata dalı test edilmeli).
Performance Target: Yok (ek bir DB sorgusu/update maliyeti ihmal
edilebilir).
Diğer ölçülebilir kriterler: `needs_review`/`processing_error`
durumundaki kayıtlar gerçek bir SQL sorgusuyla (`select * from
subscriptions where status='needs_review'`) listelenebilmeli.

## Kapsam Dışı
- `subscription_id`'nin checkout sırasında iyzico'ya (`conversationId`/
  `basketId`) gönderilmesi ve `provider_subscription_id`'nin kaydedilmesi
  — bu AYRI bir ön koşul görevi (bkz. Risks), iyzico sandbox doğrulaması
  gerektiriyor, bu görevin webhook-içi DB tutarlılığı amacını aşıyor.
- Otomatik retry/reconciliation cron'u — sadece görünürlük/kalıcılık
  hedefleniyor, otomatik düzeltme ayrı bir tasarım kararı.
- Bilinmeyen `event_type` için yeni bir işleme mantığı — mevcut dar
  davranış (200 + no-op + log) korunuyor.

## Etkilenen Dosyalar/Modüller (bilinen)
- `web/src/app/api/webhooks/payment/route.ts` (değiştir)
- `web/src/app/api/webhooks/payment/route.test.ts` (genişlet)

## Proje Ortamı Kısıtı (arama/grep kapsamı)
Doğrulandı (EML-20'de zaten doğrulandı) — git reposunun kökü proje
klasörüyle aynı, arama bu klasörle sınırlı.

## Rollback Beklentisi
`needs_review`/`processing_error` durumuna düşen bir kayıt otomatik
düzeltilmez — sadece kalıcı/sorgulanabilir olur, düzeltmeyi admin elle
yapar (bkz. Kapsam Dışı). (Opus alt-ajanı tarafından yanıtlandı)

## Risks
- `subscription_id`'nin iyzico'ya hiç gönderilmemiş olması (checkout
  akışındaki eksik bağlantı) — bu görev webhook'un DB tutarlılığını
  garanti eder, ama bu olmadan webhook'un "doğrulaması" pratikte hiç
  tetiklenmeyebilir (gerçek bir subscription_id provider'dan hiç
  dönmüyorsa). Ayrı bir ön koşul görevi olarak Jira'ya not edilmeli.
- iyzico'nun gerçek webhook payload şeması (hangi alanları gönderdiği)
  hâlâ sandbox'a karşı doğrulanmadı (EML-5'in bilinen sınırlaması,
  tekrar burada not edildi).

## Assumptions
- Koşullu update için Supabase'in `.update(patch).eq("id",
  id).eq("status", "pending").select("id")` zincirinin PostgREST'te
  atomik bir `WHERE` koşulu ürettiği varsayıldı (tek SQL UPDATE,
  race-condition'a karşı DB seviyesinde güvenli) — doğrulanmadıysa
  `verify`/`pm` adımında teyit edilmeli.

## Unknowns
- Yok (önceki Unknowns, Opus alt-ajanı tarafından ya çözüldü ya da
  Risks/Kapsam Dışı'na taşındı).

## Sorular ve Cevaplar (ham kayıt)
1. Kapsam → P0-5 + P1-11 birlikte, dar tutulmuş (Opus alt-ajanı tarafından yanıtlandı)
2. Hedef → doğrulanmamış/kalıcı olmayan durum değişikliği riski (Opus alt-ajanı tarafından yanıtlandı)
3. Happy path/durum geçişleri → pending→active, active/failed üzerine no-op (Opus alt-ajanı tarafından yanıtlandı)
4. Var olmayan id → 200 + no-op + log, 404 DEĞİL (Opus alt-ajanı tarafından yanıtlandı)
5. DB hatası döngüsü → needs_review update denemesi, o da başarısızsa processing_error + 500 (Opus alt-ajanı tarafından yanıtlandı)
6. Bilinmeyen event_type → kapsam içi, dar (mevcut davranış korunur) (Opus alt-ajanı tarafından yanıtlandı)
7. Provider'a subscription_id gönderme → kapsam dışı, ayrı ön koşul görevi (Opus alt-ajanı tarafından yanıtlandı)
8. Test oranı → unit 50/integration 40/e2e 10 (Opus alt-ajanı tarafından yanıtlandı)
9. Coverage hedefi → satır %90/dal %85 (Opus alt-ajanı tarafından yanıtlandı)
10. Rollback → sadece görünürlük, otomatik retry yok (Opus alt-ajanı tarafından yanıtlandı)
