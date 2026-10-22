---
task_slug: checkout-webhook-test-gaps
jira_id: EML-57
threat_model: done
priority: medium
coverage_target: 90
performance_target: null
memory_target: null
test_strategy:
  unit: 100
  integration: 0
  e2e: 0
affected_modules:
  - web/src/app/api/subscriptions/checkout/route.test.ts
  - web/src/app/api/webhooks/payment/route.test.ts
---

# ATDD — checkout-webhook-test-gaps

## Jira Kaynağı
[EML-57 — checkout-webhook-test-gaps](https://kuyusuzyusuf123.atlassian.net/browse/EML-57)

## Persona
Yusuf — proje sahibi; dolaylı: ödeme akışını kullanan emlakçı/agent.

## Hedef (Neden)
`checkout`/`webhook` route'ları zaten doğru davranışı implemente ediyor
(bu görev implementasyonu DEĞİŞTİRMİYOR), ama bazı önemli hata dalları
(400/502/504/23505, PAYMENT_FAILED happy-path) hiç test altında değil —
bir regresyon bu dallarda sessizce kırılabilir, fark edilmez.

## Mevcut Durum Tespiti (kod okunarak doğrulandı, 401/PAYMENT_FAILED ile ilgili
backlog notu kısmen güncel değildi)
- `checkout/route.test.ts`: 201/404/401/409/AC-S1/AC-S4 test ediliyor. **400
  (INVALID_INPUT), 502 (PAYMENT_PROVIDER_ERROR), 504 (PAYMENT_TIMEOUT), 23505
  (insert race → ALREADY_SUBSCRIBED) test EDİLMİYOR.**
- `webhooks/payment/route.test.ts`: 401 INVALID_SIGNATURE ZATEN test ediliyor
  (AC-S3, `it.each`). **PAYMENT_FAILED event_type'ının doğrudan (pending→failed)
  happy-path'i test EDİLMİYOR** (sadece "failed iken success gelirse" ve
  "bilinmeyen event_type" senaryoları var).

## User Story
As a proje sahibi (Yusuf)
I want checkout ve webhook route'larının tüm dokümante edilmiş hata/başarı
dallarının testle kanıtlanmasını
So that bu dallardaki bir regresyon (örn. 502 yerine 500 dönmeye başlaması)
sessizce production'a sızmasın

## Acceptance Criteria (Given-When-Then, önceliklendirilmiş)
1. [Critical] Given `plan_id` boş/eksik/string-olmayan bir body, When POST
   /api/subscriptions/checkout, Then 400 `{error: "INVALID_INPUT", message:
   "plan_id zorunludur", field: "plan_id"}` döner, hiçbir DB yazma çağrısı
   yapılmaz.
2. [Critical] Given `createCheckoutSession` bir `TimeoutError` fırlatır
   (sağlayıcı zaman aşımı), When POST checkout, Then 504 `{error:
   "PAYMENT_TIMEOUT", subscription_id, status: "pending"}` döner, subscription
   kaydı `pending` durumunda KALIR (güncellenmez — reconciliation cron'una
   bırakılır).
3. [Critical] Given `createCheckoutSession` TimeoutError DIŞINDA bir hata
   fırlatır, When POST checkout, Then 502 `{error: "PAYMENT_PROVIDER_ERROR",
   retryable: true}` döner VE subscription kaydı `status: "failed"`e
   güncellenir (route'un `catch` bloğundaki `update` çağrısı gerçekten
   tetiklenir — mock'un çağrıldığı doğrudan assert edilir).
4. [High] Given subscriptions insert'i 23505 (unique-violation, eşzamanlı
   checkout yarışı) hatasıyla başarısız olur, When POST checkout, Then 409
   `{error: "ALREADY_SUBSCRIBED"}` döner (mevcut `activeSubscription`
   kontrolünden farklı bir kod yolu — doğrudan insert'teki 23505 yakalaması).
5. [Critical] Given geçerli imzalı bir `PAYMENT_FAILED` event'i, `pending`
   durumdaki bir subscription için, When POST webhook, Then subscription
   `status: "failed"`e güncellenir, `current_period_end` ALANI
   DOKUNULMAZ (sadece `PAYMENT_SUCCESS` dalı bunu set ediyor), 200
   `{received: true}` döner.

## Threat Model
Çağrıldı — Tetikleyiciler: kimlik doğrulama/yetkilendirme (checkout route
`auth.getUser()`), ödeme (her iki route), dış API çağrısı (iyzico). Bu
görev YENİ bir kod yolu eklemiyor, sadece MEVCUT ve zaten threat-model'den
geçmiş davranışı (AC-S1..S4, önceki görevlerde üretilmiş) test altına
alıyor — STRIDE-lite'ın tekrar uygulanmasına gerek yok, zaten var olan
AC-S kriterleri (AC-S1: price body'den okunmaz, AC-S3: imza DB'den önce
doğrulanır, AC-S4: rate limit) bu görevde DOKUNULMUYOR, sadece ek test
kapsamı ekleniyor. Yeni bir güvenlik AC'si üretilmedi çünkü yeni bir kod
yolu/güven sınırı yok.

## Davranış Sözleşmesi (hangi durumda ne döner — mevcut koddan birebir)
| # | Durum | Dönen değer / durum kodu | Yan etki | AC |
|---|---|---|---|---|
| 1 | checkout: plan_id eksik | 400 `{error:"INVALID_INPUT",...}` | yok | AC-1 |
| 2 | checkout: provider timeout | 504 `{error:"PAYMENT_TIMEOUT",...}` | subscription pending kalır (DEĞİŞMEZ) | AC-2 |
| 3 | checkout: provider diğer hata | 502 `{error:"PAYMENT_PROVIDER_ERROR",retryable:true}` | subscription → failed | AC-3 |
| 4 | checkout: insert race (23505) | 409 `{error:"ALREADY_SUBSCRIBED"}` | yok | AC-4 |
| 5 | webhook: PAYMENT_FAILED (pending'ten) | 200 `{received:true}` | subscription → failed, current_period_end dokunulmaz | AC-5 |

Kısmi başarı / sessiz-hiçbir-şey-yapılamadı: N/A — bu görev yeni davranış
eklemiyor, mevcut (önceki görevlerde zaten bu kategoriler için karar
verilmiş) davranışı test ediyor.

## Test Strategy
Unit: 100% — route handler'lar `fake-supabase` + `vi.mock` ile izole test
ediliyor, mevcut dosyaların konvansiyonuna uyulacak.
Integration/E2E: 0% — mevcut dosyalarda da yok, bu görevin kapsamı değil.

## Benchmark / Başarı Ölçütü
5 yeni test case, hepsi mevcut dosyalara (route.test.ts) eklenir.
Coverage target: 90% (route dosyalarının branch coverage'ı).

## Kapsam Dışı
- Route implementasyonunun DEĞİŞTİRİLMESİ (bu görev test-only).
- `web/src/app/api/webhooks/payment/route.ts`'in refactor edilmesi —
  sıcak dosya olduğu plan.md'de ayrıca değerlendirilecek (`verify`'ın
  refactor-aday kontrolü), ama bu görevde fiilen refactor YAPILMAZ, sadece
  öneri olarak kaydedilir.
- `iyzico.test.ts`'teki mevcut unit testler (zaten var, dokunulmuyor).

## Etkilenen Dosyalar/Modüller (bilinen)
- `web/src/app/api/subscriptions/checkout/route.test.ts` (genişletilecek)
- `web/src/app/api/webhooks/payment/route.test.ts` (genişletilecek)

## Proje Ortamı Kısıtı
Doğrulanmadı (önceki görevlerle aynı kalıcı not) — arama `emlak-platform/`
altıyla sınırlı tutulacak.

## Rollback Beklentisi
Test-only değişiklik, rollback riski yok (implementasyon değişmiyor).

## Risks
- `web/src/app/api/webhooks/payment/route.ts` postmortem'de 2 kez PM
  bulgusu almış sıcak dosya — bu görev onu değiştirmiyor ama `verify`
  adımında refactor adaylığı tekrar değerlendirilip kullanıcıya somut
  olarak önerilecek (postmortem Koşum 1'in talimatı).

## Assumptions
- Mevcut `fake-supabase` test yardımcısının 23505 hata kodu simülasyonunu
  desteklediği varsayılıyor (checkout-reconciliation-job ve diğer
  görevlerde benzer desen kullanılmış) — doğrulanmadıysa test-copilot
  kontrol edecek.

## Unknowns
Yok.

## Sorular ve Cevaplar (ham kayıt)
1. Kapsam netliği (401/PAYMENT_FAILED) → kod okunarak doğrulandı: 401 zaten
   test ediliyordu (backlog notu güncel değildi), gerçek eksik PAYMENT_FAILED
   happy-path'i. (kod okuma ile türetildi)
2. Threat-model gerekli mi → tetikleyici var (auth/payment) ama yeni kod yolu
   yok, yeni AC-S üretilmedi, mevcut AC-S'lere dokunulmadı. (muhakeme ile)
