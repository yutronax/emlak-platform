---
task_slug: abonelik-plani-odeme-entegrasyonu
jira_id: EML-5
saga_task_id: null
github_issue: 5
threat_model: done
priority: high
coverage_target: 85
performance_target: "checkout API p95 < 800ms, webhook işleme p95 < 300ms"
memory_target: null
test_strategy:
  unit: 60
  integration: 30
  e2e: 10
affected_modules:
  - app/api/subscriptions/checkout (yeni)
  - app/api/webhooks/payment (yeni)
  - app/account/subscription (yeni sayfa)
  - app/pricing (yeni sayfa)
  - supabase: plans, subscriptions, payment_events tabloları (yeni migration)
  - mevcut kullanıcı/profil tablosu (plan_id ilişkisi)
  - ilan oluşturma akışındaki limit kontrolü
---

# ATDD — abonelik-plani-odeme-entegrasyonu

## GitHub Kaynağı
[Issue #5 — Abonelik modeli: plan seçimi, ödeme entegrasyonu kararı](https://github.com/yutronax/emlak-platform/issues/5)
Orijinal açıklama (birebir): "Mimari kararı gerektirir, ekip birlikte kararlaştırmalı (hangi ödeme sağlayıcısı?)."
Etiketler: `modul:web`, `faz:4`

**ÖNEMLİ — açık karar:** Issue açıkça ödeme sağlayıcısının ekip tarafından
birlikte kararlaştırılmasını istiyor. Bu doküman **iyzico**'yu bir öneri
olarak işliyor (gerekçe: TL/yerli kart/3DS/yinelenen ödeme desteği, Stripe'ın
Türkiye'de doğrudan merchant modeli yok) — ama bu NİHAİ bir karar değil,
kullanıcı onayı bekleyen bir **Assumption**'dır (bkz. Assumptions).

## Persona
İlan veren emlakçı / emlak ofisi kullanıcısı (B2B). Admin plan tanımlar ve
abonelikleri izler, kendisi ödeme yapmaz (admin onay akışı ayrı bir modül).

## Hedef (Neden)
Platformun ilk gelir modelini kurmak. Ücretsiz plan sınırlı ilan hakkı verir;
ücretli planlar (Başlangıç, Pro) daha yüksek ilan limiti ve öne çıkarma sunar.
Bu iş aynı zamanda ödeme sağlayıcısı kararını bir ADR olarak kayda geçirir.

## User Story
As a emlakçı (ilan veren kullanıcı)
I want ücretli bir abonelik planı satın almak
So that daha fazla ilan yayınlayabileyim ve ilanlarımı öne çıkarabileyim

## Acceptance Criteria (Given-When-Then, önceliklendirilmiş)
1. [Critical] Given giriş yapmış kullanıcı, When `/pricing` sayfasında bir plan seçip ödeme akışını tamamlar, Then abonelik `active` olur ve ilan limiti güncellenir (happy path).
2. [Critical] Given kullanıcı checkout başlatır, When kart reddedilir veya 3DS başarısız olur, Then abonelik `failed` olur, ilan limiti değişmez, kullanıcıya Türkçe genel bir hata mesajı gösterilir.
3. [High] Given aynı webhook event'i sağlayıcıdan iki kez gelir, When ikinci kez işlenir, Then işlem idempotent kalır (ikinci kez state değişikliği yapılmaz), `200 {"received":true,"duplicate":true}` döner.
4. [High] Given kullanıcı zaten aktif bir plandadır, When tekrar checkout başlatmaya çalışır, Then `409 ALREADY_SUBSCRIBED` döner.
5. [Medium] Given yenileme ödemesi başarısız olur, When grace period (3 gün) geçer, Then abonelik otomatik `free` plana düşer.
6. [High] **AC-S1 (Tampering):** Given kullanıcı `POST /api/subscriptions/checkout` body'sine `price` alanı ekler (örn. `{"plan_id":"pro","price":1}`), When istek işlenir, Then sunucu `price` alanını yok sayar, checkout tutarı her zaman DB'deki plan tanımından okunur — istemci fiyat manipülasyonu checkout tutarını değiştiremez.
7. [Critical] **AC-S2 (IDOR/Yetkilendirme):** Given A kullanıcısının geçerli token'ı, When A, B kullanıcısına ait bir `subscription_id` ile `GET /api/subscriptions/{B_sub_id}` çağırır, Then `403` veya `404` döner ve yanıtta B'ye ait hiçbir alan (plan adı, tutar, kart son 4 hane vb.) bulunmaz (RLS + handler kontrolü ikisi birden doğrulanır).
8. [Critical] **AC-S3 (Spoofing — webhook):** Given geçersiz veya eksik HMAC imzalı bir webhook isteği, When `POST /api/webhooks/payment` ucuna sahte bir "ödeme başarılı" event'i gönderilir, Then istek `401 INVALID_SIGNATURE` ile reddedilir VE ilgili abonelik kaydında hiçbir DB update/flush gerçekleşmez (imza doğrulaması veritabanı işleminden önce yapılır).
9. [High] **AC-S4 (DoS — rate limit):** Given aynı kullanıcı/IP, When `/api/subscriptions/checkout` ucuna 10 saniye içinde 10'dan fazla istek gönderilir, Then sağlayıcıya tekrar tekrar yeni checkout oturumu açılmaz — `429` döner veya var olan `pending` checkout session'ı idempotency key ile yeniden kullanılır.
10. [Medium] **AC-S5 (Bilgi sızıntısı):** Given sağlayıcı (iyzico) ham bir hata metni döner (örn. kart/banka detayı içeren mesaj), When bu hata kullanıcıya iletilir, Then yalnızca önceden tanımlı genel bir hata kodu + Türkçe genel mesaj gösterilir; sağlayıcının ham response body'si yalnızca sunucu loguna yazılır, API yanıtında veya UI'da hiç görünmez.

## Threat Model
Çağrıldı (`threat-model` skill) — STRIDE-lite uygulandı:
- **Tampering** → AC-S1 (fiyat manipülasyonu)
- **Elevation/IDOR** → AC-S2 (başkasının abonelik verisine erişim)
- **Spoofing** → AC-S3 (sahte webhook event'i)
- **DoS** → AC-S4 (checkout endpoint'ine aşırı istek)
- **Information disclosure** → AC-S5 (sağlayıcı ham hata metni sızıntısı)
- **Repudiation**: `payment_events` tablosu zaten her durum değişikliğini kaydediyor (audit trail) — ek AC gerekmedi.

AC-S2 yetkilendirme/IDOR kriteri ürettiği için `verify`/test aşamasında
`authz-test` skill'i de çağrılmalı (bu adımda henüz çalışan bir sistem
olmadığı için canlı prob burada çalıştırılmadı — bu bir sonraki adımın işi).

## Agentic Değerlendirme Kriterleri
Bu görev bir LLM agent/tool-calling davranışını değiştirmiyor — bölüm silindi.

## Davranış Sözleşmesi (hangi durumda ne döner)
| # | Durum | Dönen değer / durum kodu | Yan etki | Kullanıcı ne görür | AC |
|---|---|---|---|---|---|
| 1 | Happy path | `201 {"subscription_id":"sub_123","status":"pending","checkout_url":"https://sandbox-iyzico.../form/abc","expires_at":"2026-10-16T12:30:00Z"}` | `subscriptions` kaydı `pending` oluşturulur | Ödeme sayfasına yönlenir | AC-1 |
| 2 | Girdi geçersiz/eksik | `400 {"error":"INVALID_INPUT","message":"plan_id zorunludur","field":"plan_id"}` | Yok | Form altı hata mesajı | AC-1 |
| 3 | Kaynak yok (plan bulunamadı) | `404 {"error":"PLAN_NOT_FOUND","message":"Seçilen plan bulunamadı"}` | Yok | "Plan bulunamadı" mesajı | AC-1 |
| 4 | Yetkisiz erişim | Oturumsuz istek: `401 {"error":"UNAUTHORIZED"}`; başkasının kaydı: `403/404`; geçersiz webhook imzası: `401 {"error":"INVALID_SIGNATURE"}` | Yok (webhook'ta DB'ye dokunulmaz) | Login'e yönlendirme / genel hata | AC-S2, AC-S3 |
| 5 | Dış bağımlılık hatası (iyzico 5xx / kart reddi) | `502 {"error":"PAYMENT_PROVIDER_ERROR","retryable":true}`; kart reddinde webhook sonrası `{"subscription_id":"sub_123","status":"failed","reason":"CARD_DECLINED"}` | Abonelik `failed`, limit değişmez | "Ödemeniz reddedildi, tekrar deneyin" | AC-2, AC-S5 |
| 6 | Zaman aşımı | `504 {"error":"PAYMENT_TIMEOUT","subscription_id":"sub_123","status":"pending"}` | Kayıt `pending` kalır, reconciliation cron'u uzlaştırır | "İşleminiz kontrol ediliyor" | — |
| 7 | Kısmi başarı (ödeme alındı, aktivasyon başarısız) | Webhook: `200 {"received":true,"subscription_id":"sub_123","status":"needs_review"}` | Kayıt `needs_review`, admin uyarılır, otomatik iade YAPILMAZ | "Ödemeniz alındı, planınız kısa süre içinde aktifleşecek" | AC-5 |
| 8 | Hiçbir şey yapılamadı ama hata yok (zaten aktif / tekrar gelen webhook) | Checkout: `409 {"error":"ALREADY_SUBSCRIBED","current_plan":"pro"}`; tekrar webhook: `200 {"received":true,"duplicate":true,"event_id":"evt_789"}` | Yok (idempotent) | "Zaten bu plandasınız" | AC-4, AC-3 |

**Kısmi başarı commit sınırı notu:** Abonelik aktivasyonu (DB `active` update + ilan limiti güncelleme) **tek transaction** içinde yapılmalı. Bu projede `get_session` her exception'da `session.rollback()` yaptığından (`app/core/deps.py`), webhook handler'ı flush+exception sırasına güvenemez — aktivasyon ve limit güncellemesi aynı transaction'da commit edilmeli, aksi halde kısmen yazılmış veri rollback ile sessizce kaybolur.

Boş sonuç ↔ hata ayrımı: Kullanıcının hiç aboneliği yoksa (`GET /account/subscription` → `200 {"subscription":null,"plan":"free"}`), yetkisizse (`401`/`403`) veya sorgu başarısızsa (`500`) **üçü de farklı durum kodu/gövde döner** — hiçbiri aynı boş değere düşmez.

## Test Strategy
Unit: 60% — plan/limit mantığı, webhook imza doğrulama (HMAC), durum makinesi (pending→active/failed/needs_review), fiyat manipülasyonu reddi (AC-S1)
Integration: 30% — Supabase RLS (AC-S2), iyzico sandbox checkout akışı, webhook idempotency (AC-3), rate limit (AC-S4)
E2E: 10% — Playwright ile plan seçip sandbox kartıyla ödeme tamamlama (happy path + kart reddi)

## Benchmark / Başarı Ölçütü
Coverage Target: 85%
Performance Target: checkout API p95 < 800ms (sağlayıcı çağrısı dahil), webhook işleme p95 < 300ms
Diğer ölçülebilir kriterler: webhook sonrası abonelik aktivasyonu %100 tutarlı (ödenmiş ama aktif olmayan kayıt sayısı 0); sandbox ortamında ödeme tamamlanma oranı %95+

## Kapsam Dışı
Yıllık plan ve indirimler, kupon/promosyon sistemi, kurumsal e-fatura/e-arşiv entegrasyonu, çoklu para birimi, plan yükseltmede orantılı (prorata) ücretlendirme, iade akışı (admin elle yapar), mobil uygulama içi ödeme.

## Etkilenen Dosyalar/Modüller (bilinen)
- Supabase: yeni `plans`, `subscriptions`, `payment_events` tabloları + migration
- Mevcut kullanıcı/profil tablosu: `plan_id` ilişkisi
- İlan oluşturma akışındaki limit kontrolü, admin onay akışı
- `app/pricing`, `app/account/subscription` sayfaları
- `app/api/subscriptions/*`, `app/api/webhooks/payment` route'ları
- Ortam değişkenleri: `IYZICO_API_KEY`, `IYZICO_SECRET` (sağlayıcı kararı onaylanırsa)

## Proje Ortamı Kısıtı (arama/grep kapsamı)
Doğrulanmadı — bu makinede git reposunun kökünün proje klasörüyle aynı olup
olmadığı kontrol edilmedi. Sonraki adımlar (plan/code-copilot/test-copilot)
aramalarını `emlak-platform` klasörüyle sınırlı tutmalı.

## Rollback Beklentisi
Abonelik durumu webhook'a göre belirlenir, sağlayıcı tek kaynak kabul edilir.
`pending` durumunda 30 dakikayı aşan kayıtlar reconciliation cron'u ile
sağlayıcıdan sorgulanıp uzlaştırılır. Ödeme alınıp aktivasyon başarısız
olursa kayıt `needs_review` işaretlenir, admin uyarılır, otomatik iade
YAPILMAZ (insan onayı gerekir). Ödeme modülü `PAYMENTS_ENABLED` feature
flag'iyle kapatılabilir olmalı.

## Risks
- **Ödeme sağlayıcısı kararı henüz nihai değil.** Bu doküman iyzico'yu
  öneriyor ama issue açıkça "ekip birlikte kararlaştırmalı" diyor — bu karar
  kullanıcı onayı bekliyor, otomatik alt-ajana bırakılmadı.
- Rate limit şu an sadece checkout ucu için (AC-S4) tanımlı; diğer uçlara
  genel bir rate limit bu fazda kapsam dışı bırakıldı (bilinçli kabul
  edilen risk — düşük trafik beklenen faz 4 iterasyonu).
- Admin plan tanımlama ucunun yetkilendirmesi mevcut admin auth
  middleware'ine güveniyor, bu görevde ayrıca test edilmiyor (varsayım).

## Assumptions
- **Ödeme sağlayıcısı: iyzico** (varsayım, NİHAİ DEĞİL — kullanıcı onayı
  gerekiyor). Gerekçe: TL/yerli kart/3DS/yinelenen ödeme desteği.
- Plan isimleri: Free, Başlangıç, Pro (varsayım, kullanıcı belirtmedi).
- Kabul kriteri sahibi: otomatik testler (sandbox dahil) + sağlayıcı seçimi
  ADR'sinin kullanıcı/ekip onayı.
- Test stratejisi oranı (60/20/10 → integration ağırlıklı 60/30/10)
  kullanıcı tarafından onaylanmadı, proje tipine göre önerildi.

## Unknowns
- Yıllık/kurumsal plan ihtiyacı var mı (şu an kapsam dışı bırakıldı, ileride
  tekrar sorulmalı).
- Sağlayıcı seçimi (iyzico vs PayTR vs başka) kullanıcı/ekip tarafından
  henüz netleştirilmedi.

## Sorular ve Cevaplar (ham kayıt)
Not: Aşağıdaki sorular Opus alt-ajanına (model: opus, reasoning_effort: low)
dispatch edildi — cevaplar kullanıcı cevabı değildir, en makul varsayımlardır.

1. Kullanıcı rolü/persona → İlan veren emlakçı/emlak ofisi (B2B), admin sadece plan tanımlar — (Opus alt-ajanı tarafından yanıtlandı: gelir profesyonellerden gelir, admin onay akışı ayrı modül)
2. Ana hedef/neden → Platformun ilk gelir modelini kurmak + sağlayıcı kararını ADR olarak kayda geçirmek — (Opus alt-ajanı tarafından yanıtlandı: issue'nun kendisi bunu istiyor)
3. Happy path senaryosu → plan seç → checkout → 3DS → webhook → aktif — (Opus alt-ajanı tarafından yanıtlandı: iyzico TL/3DS/yinelenen ödeme destekliyor)
4. Edge case'ler → kart reddi, webhook tekrar/gecikme, zaten aktif plan, yenileme başarısızlığı — (Opus alt-ajanı tarafından yanıtlandı: ödeme sistemlerinde en sık görülen hatalar)
5. Davranış sözleşmesi (hata durumunda ne döner) → yukarıdaki tabloya işlendi — (Opus alt-ajanı tarafından yanıtlandı)
6. Başarı ölçütü → webhook aktivasyon %100 tutarlılık, p95 <800ms/<300ms, sandbox tamamlanma %95+ — (Opus alt-ajanı tarafından yanıtlandı: ölçülebilir ve sandbox'ta test edilebilir)
7. Kapsam dışı → yıllık plan, kupon, e-fatura, çoklu para birimi, prorata, iade akışı, mobil içi ödeme — (Opus alt-ajanı tarafından yanıtlandı: faz 4 ilk iterasyonunu yönetilebilir tutar)
8. Bağımlılıklar → plans/subscriptions/payment_events tabloları, kullanıcı/profil tablosu, ilan limit kontrolü — (Opus alt-ajanı tarafından yanıtlandı)
9. Güvenlik kısıtı → PCI-DSS SAQ-A (kart verisi dokunulmaz), HMAC webhook imzası, RLS, fiyat sunucuda okunur, 3DS zorunlu — (Opus alt-ajanı tarafından yanıtlandı; threat-model adımında AC-S1..S5'e dönüştürüldü)
10. Rollback beklentisi → reconciliation cron, needs_review + admin uyarısı, otomatik iade yok, feature flag — (Opus alt-ajanı tarafından yanıtlandı: para hareketinde otomatik geri alma riskli)
11. Kabul kriteri sahibi → otomatik testler + sağlayıcı seçimi ADR'sinin kullanıcı onayı — (Opus alt-ajanı tarafından yanıtlandı: issue açıkça "ekip birlikte kararlaştırmalı" diyor)
12. Test stratejisi oranı → 60/30/10 (unit/integration/e2e) — (Opus alt-ajanı tarafından yanıtlandı: dış entegrasyon ağırlıklı iş)

## Notion Mirror
Atlandı — Saga bağlantısı yok (bu oturumda MCP_DOCKER bağlantısı kapalı/kopuk).
