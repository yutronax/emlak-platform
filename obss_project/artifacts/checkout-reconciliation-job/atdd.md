---
task_slug: checkout-reconciliation-job
jira_id: EML-48
threat_model: done
priority: medium
coverage_target: 90
performance_target: null
memory_target: null
test_strategy:
  unit: 70
  integration: 25
  e2e: 5
affected_modules:
  - web/src/app/api/cron/reconcile-subscriptions/route.ts (yeni)
  - vercel.json (yeni)
---

# ATDD — checkout-reconciliation-job

## Jira Kaynağı
[EML-48 — [P1] Checkout/webhook reconciliation job (P1-10)](https://kuyusuzyusuf123.atlassian.net/browse/EML-48)
Kaynak: `is-listesi-ve-sayfa-envanteri.md` P1-10, `emlak-platform-customer`
session önerisi — **kapsamı dar tutuldu** (Opus alt-ajanı netleştirmesi):
iyzico bizim `subscription.id`'mizi hiç bilmiyor (checkout akışı sadece
`agentId` gönderiyor), gerçek bir "iyzico'dan durum sorgula" AYRI bir ön
koşul görevi gerektiriyor (checkout akışının değişmesi + sandbox doğrulama).
Bu görev SADECE: 1 saatten uzun `pending` kalan kayıtları `needs_review`'a
çeken, korumalı bir cron endpoint'i kurar.

## Persona
Sistem (Vercel Cron) — periyodik olarak bir reconciliation endpoint'ini
tetikler. İkincil: admin, `needs_review`'a düşen kayıtları panelinden
görür (ayrı bir görev, bu task'ın kapsamı değil).

## Hedef (Neden)
`subscriptions` tablosunda `pending` durumunda sonsuza kadar kalan kayıtlar
(webhook hiç gelmedi/gecikti) hiçbir zaman fark edilmiyor — kullanıcı
ödeme yapmış olabilir ama sistemde hâlâ "beklemede" görünüyor, kimse
bunu görünür hale getirmiyor.

## User Story
As a sistem (otomatik reconciliation)
I want 1 saatten uzun süre pending kalan subscription kayıtlarını
  needs_review'a çekmeyi
So that bu kayıtlar admin tarafından görünür/incelenebilir olsun,
  sonsuza kadar sessizce "beklemede" kalmasın

## Acceptance Criteria (Given-When-Then, önceliklendirilmiş)
1. [Critical] **AC-S1 (Spoofing)** Given istek `Authorization: Bearer
   <CRON_SECRET>` header'ı YOK veya YANLIŞ, When
   `/api/cron/reconcile-subscriptions`'a POST/GET yapılır, Then 401
   döner, HİÇBİR `subscriptions` sorgusu/güncellemesi YAPILMAZ.
2. [Critical] **AC-S2 (Fail-closed config)** Given `CRON_SECRET` env
   değişkeni set edilmemiş/boş, When endpoint çağrılır, Then 500 döner
   (açık bir yapılandırma hatası), HİÇBİR DB işlemi YAPILMAZ — gelen
   header ne olursa olsun karşılaştırma yapılamaz, güvenli taraf seçilir.
3. [Critical] Given geçerli `CRON_SECRET`, bir `subscriptions` satırı
   `status="pending"` VE `created_at` şu andan 1 saatten ESKİ, When
   endpoint çağrılır, Then bu satır `status="needs_review"` olur.
4. [Critical] **AC-S3/Idempotency** Given AYNI endpoint İKİNCİ KEZ
   çağrılır (az önce `needs_review`'a çekilen kayıt için), When
   çağrılır, Then bu kayıt TEKRAR işlenmez/etkilenmez (koşullu UPDATE
   `WHERE status='pending'` ikinci kez 0 satır etkiler, hata OLUŞMAZ).
5. [High] Given bir `subscriptions` satırı `status="pending"` AMA
   `created_at` 1 saatten DAHA YENİ (hâlâ pencere içinde), When endpoint
   çağrılır, Then bu satıra DOKUNULMAZ (kullanıcı hâlâ ödeme ekranında
   olabilir).
6. [High] Given bir `subscriptions` satırı `status` `active`/`canceled`/
   `failed`/`trialing`/`past_due` (yani `pending` DEĞİL), When endpoint
   çağrılır (yaşı ne olursa olsun), Then bu satıra ASLA DOKUNULMAZ.
7. [Medium] Given geçerli çağrı, hiçbir eşiği aşan `pending` kayıt YOK,
   When endpoint çağrılır, Then 200 döner, `{updated: 0}` gibi bir özet,
   hata OLUŞMAZ (sessiz başarı — "hiçbir şey yapılamadı" ile "hiç
   yapılacak iş yok" AYNI, burada ayrım gerekmiyor çünkü ikisi de meşru).

## Threat Model
Çağrıldı — STRIDE-lite: Spoofing (AC-S1: geçersiz/eksik secret ile hiçbir
işlem yapılamaz) en kritik kategori — bu endpoint dış dünyadan
tetiklenebilir (Vercel Cron'un kendi IP kısıtı garantili değil, secret
TEK savunma hattı). Fail-closed yapılandırma (AC-S2) EML-20'deki
`BAILEYS_WEBHOOK_SECRET` deseniyle AYNI mantık. Tampering: istemciden
gelen bir veri YOK (sadece bir tetikleme), bu kategori uygulanamaz.
Info disclosure: hata yanıtlarında `CRON_SECRET`'in kendisi veya DB hata
detayı SIZDIRILMAZ (generic mesaj). DoS: endpoint'in kendisi sınırsız
çağrılabilir olsa da (Vercel Cron periyodik, dışarıdan çağrılsa bile
sadece KENDİ eşiğini aşan kayıtları günceller, DB'ye ağır bir yük
bindirmez) — bilinçli olarak rate-limit eklenmedi (Risks'e not edildi).
Elevation: uygulanamaz, tek bir rol/eylem var.

## Davranış Sözleşmesi (hangi durumda ne döner)
| # | Durum | Dönen değer / durum kodu | Yan etki | AC |
|---|---|---|---|---|
| 1 | Secret eksik/yanlış | 401 | Hiç DB işlemi yok | AC-S1 |
| 2 | CRON_SECRET env yok | 500 | Hiç DB işlemi yok | AC-S2 |
| 3 | Geçerli secret, eşiği aşan pending var | 200 + `{updated: N}` | N satır needs_review olur | AC-3 |
| 4 | İkinci çağrı (aynı kayıt) | 200 + `{updated: 0}` | Hiçbir ek değişiklik | AC-S3 |
| 5 | Pending ama eşik içinde | 200 + `{updated: 0}` | Dokunulmaz | AC-5 |
| 6 | pending-olmayan durumlar | 200 + `{updated: 0}` | Dokunulmaz | AC-6 |
| 7 | Hiçbir şey yapılamadı ama hata yok | Oluşmaz — `{updated: 0}` zaten "yapacak iş yoktu"nun açık göstergesi, sessiz/belirsiz bir "başarı" değil | AC-7 |

Kısmi başarı: Birden fazla kayıt eşiği aşıyorsa, UPDATE tek bir SQL
ifadesiyle (koşullu, toplu) çalışır — kısmi güncelleme senaryosu (bazı
satırlar güncellenip bazıları başarısız olması) PostgreSQL'in atomik
UPDATE garantisiyle oluşmaz.
Boş sonuç ↔ hata ayrımı: `{updated: 0}` (yapacak iş yoktu, AC-7) ile
gerçek bir DB hatası (500, ayrı loglanır) AYRI kod yollarıdır.

## Test Strategy
Unit: 70% — eşik hesaplama mantığı (saf fonksiyon: `isStale(createdAt,
now)`), secret doğrulama (sabit zamanlı karşılaştırma çağrıldığı
doğrulanır).
Integration: 25% — gerçek Supabase'e karşı (fake-supabase deseniyle):
koşullu UPDATE'in SADECE eşiği aşan `pending` satırları etkilediği,
diğer durumlara dokunmadığı.
E2E: 5% — opsiyonel, gerçek bir cron tetiklemesi simülasyonu bu turda
zorunlu değil.

## Benchmark / Başarı Ölçütü
Coverage Target: Değişen route'ta satır/dal %90.
Performance Target: Yok.
Görsel/UI kriteri: Yok (API route, UI yok).

## Kapsam Dışı
- **Gerçek iyzico durum sorgulama API'si** — iyzico bizim subscription.id'mizi
  bilmediği için bu görevde YAPILAMAZ. Ayrı bir ön koşul görevi (checkout
  akışının `conversationId`/`provider_subscription_id` eşleştirmesini
  kaydetmesi + sandbox'a karşı doğrulama) gerektirir.
- `active`/`failed`'e otomatik geçiş — gerçek sağlayıcı durumu bilinmeden
  yapılamaz, sadece `needs_review`'a çekmek (görünürlük) bu sürümün hedefi.
- Deneme sayacı/backoff, admin'e e-posta/bildirim, toplu manuel reconcile
  arayüzü — hepsi ayrı ürün kararları.
- Rate limiting (yukarıda Threat Model'de gerekçeli).

## Etkilenen Dosyalar/Modüller (bilinen)
- `web/src/app/api/cron/reconcile-subscriptions/route.ts` (yeni)
- `web/src/app/api/cron/reconcile-subscriptions/route.test.ts` (yeni)
- `vercel.json` (yeni — cron yapılandırması)

## Proje Ortamı Kısıtı (arama/grep kapsamı)
Doğrulandı (önceki görevlerde zaten doğrulandı).

## Rollback Beklentisi
Geriye dönük uyumsuz değil — yeni bir endpoint ekleniyor, mevcut hiçbir
davranış değişmiyor.

## Risks
- Rate limiting bilinçli olarak eklenmedi — endpoint kendi eşiğiyle
  sınırlı iş yapıyor (DB'ye ağır yük bindirmez), CRON_SECRET tek
  savunma hattı olarak kabul edildi.
- Gerçek iyzico entegrasyonu olmadığı için bu job'ın "gerçek" değeri
  sınırlı (sadece görünürlük sağlıyor, otomatik düzeltme yapmıyor) —
  ayrı bir ön koşul görevi (checkout akışı + provider eşleştirmesi)
  olmadan tam değerine ulaşmıyor. Bilinçli kabul edildi (Opus alt-ajanı
  önerisi, customer session onayladı).

## Assumptions
- Eşik 1 saat (checkout TTL 30dk + pay) — Opus alt-ajanı önerisi.
- `PaymentStatusProvider` gibi bir pluggable arayüz (Opus alt-ajanının
  önerisi) BU TURDA EKLENMEDİ — gerçek bir sağlayıcı çağrısı hiç
  yapılmadığı için (kapsam dışı) bu, kullanılmayan/ölü bir soyutlama
  olurdu (CAVEMAN ihlali, postmortem koşum 1'in uyarısına uygun). Bunun
  yerine kodda tek bir yorum satırıyla "gerçek durum sorgusu buraya
  eklenecek (ayrı görev)" notu bırakılacak — bu bir plan-aşaması
  düzeltmesi, Opus'un önerisinden kasıtlı bir sapma.
- `last_reconciled_at` kolonu de AYNI gerekçeyle EKLENMEDİ (hiçbir
  sağlayıcı çağrısı yokken "ne zaman sorgulandı" bilgisi anlamsız) —
  follow-up görevde eklenebilir.

## Unknowns
Yok.

## Sorular ve Cevaplar (ham kayıt)
1. subscription.id eşleştirme sorunu → kapsam dar tutulsun, gerçek entegrasyon ayrı görev (Opus alt-ajanı tarafından yanıtlandı)
2. Kapsam genişlik → dar (sadece needs_review'a çekme) (Opus alt-ajanı tarafından yanıtlandı)
3. Tetikleme → Vercel Cron + CRON_SECRET korumalı route (Opus alt-ajanı tarafından yanıtlandı)
4. Eşik → 1 saat (Opus alt-ajanı tarafından yanıtlandı)
5. Idempotency → koşullu UPDATE WHERE status='pending' (Opus alt-ajanı tarafından yanıtlandı)
6. "Hâlâ pending" davranışı → dokunulmaz (bu turda last_reconciled_at eklenmedi, bkz. Assumptions) (Opus alt-ajanı önerisinden kasıtlı sapma)
7. Sağlayıcı hatası davranışı → bu turda uygulanamaz (sağlayıcı çağrısı yok) (kapsam dışı)
8. Test oranı → unit 70/integration 25/e2e 5 (Opus alt-ajanı tarafından yanıtlandı)
9. Threat-model AC-S'ler → S1 (secret), S2 (fail-closed), S3 (idempotency) (Opus alt-ajanı tarafından yanıtlandı)
10. Kapsam dışı → gerçek iyzico entegrasyonu, checkout değişikliği, otomatik active/failed geçişi, retry/backoff, bildirim (Opus alt-ajanı tarafından yanıtlandı)
11. Pipeline ölçeği → TAM PIPELINE (customer session kararı, 2026-10-22 — yeni HTTP ucu + auth, EML-20/EML-36 risk sınıfı)
