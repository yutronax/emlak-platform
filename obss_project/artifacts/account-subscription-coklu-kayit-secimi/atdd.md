---
task_slug: account-subscription-coklu-kayit-secimi
jira_id: EML-39
threat_model: not-applicable
priority: medium
coverage_target: 85
performance_target: null
memory_target: null
test_strategy:
  unit: 70
  integration: 20
  e2e: 10
affected_modules:
  - web/src/app/account/subscription/page.tsx
---

# ATDD — account-subscription-coklu-kayit-secimi

## Jira Kaynağı
[EML-39 — [P1] /account/subscription — birden fazla subscription satırında doğru aboneliği seç (P1-9)](https://kuyusuzyusuf123.atlassian.net/browse/EML-39)
Kaynak: `is-listesi-ve-sayfa-envanteri.md` P1-9, `emlak-platform-customer`
session önerisi.

## Persona
Birden fazla subscription satırı olan bir agent (örn. bir denemesi
`failed`, sonraki `active`, veya plan değiştirmiş biri).

## Hedef (Neden)
`.maybeSingle()` çağrısı hiç status filtresi/sıralaması yapmadan
çalışıyor — birden fazla satır varsa PostgREST `PGRST116` hatası verir,
sayfa "yüklenemedi" gösterir, GERÇEKTE kullanıcının geçerli bir
aboneliği olsa bile.

## User Story
As a birden fazla subscription geçmişi olan agent
I want /account/subscription sayfasının GÜNCEL/geçerli aboneliğimi
  net bir şekilde seçip göstermesini
So that geçmiş/iptal edilmiş kayıtlar yüzünden sayfa hata vermesin

## Acceptance Criteria (Given-When-Then, önceliklendirilmiş)
1. [Critical] Given bir agent'ın birden fazla subscription satırı var
   (örn. `failed` + `active`), When sayfa render edilir, Then hata
   OLUŞMAZ (PGRST116 tetiklenmez), `active` satır seçilip gösterilir.
2. [Critical] Given saf fonksiyon `pickSubscription(rows)`, When
   çağrılır, Then öncelik sırasına göre seçim yapar:
   `active > trialing > past_due > pending > needs_review > failed > canceled`.
3. [High] Given aynı öncelik seviyesinde birden fazla satır (örn. iki
   `canceled` satır), When `pickSubscription` çağrılır, Then `created_at`
   en yeni olan seçilir (satırlar `order("created_at",{ascending:false})`
   ile zaten sıralı geldiği için ilk eşleşen doğal olarak en yenisidir).
4. [Medium] Given hiç subscription satırı yok (boş dizi), When sayfa
   render edilir, Then mevcut "Aboneliğiniz yok" davranışı DEĞİŞMEDEN
   korunur.
5. [High] Given seçilen satırın `status = "past_due"`, When sayfa
   render edilir, Then uyarı metni görsel olarak vurgulanır
   (`role="alert"`) VE `/pricing`'e giden bir link gösterilir.
6. [Medium] Given seçilen satırın `plan` join'i (plan adı), When
   render edilir, Then SADECE seçilen satırın kendi plan'ı gösterilir
   (başka bir satırın plan'ıyla birleştirme YAPILMAZ).
7. [Medium] Given `trialing` durumundaki bir satır, When rozet
   render edilir, Then "Deneme sürümü" etiketi gösterilir (mevcut
   `STATUS_LABELS`'a eklenir — `agent/dashboard` sayfasıyla aynı metin).
8. [Critical] **Regresyon:** Given/When/Then: sorgu HÂLÂ
   `.eq("agent_id", auth.user.id)` filtresini kullanır — bu değişikliğin
   hiçbir yan etkisi RLS/yetkilendirme davranışını BOZMAZ (sadece
   `.maybeSingle()` kaldırılıp çok-satır okuma + JS seçimi eklenir).

## Davranış Sözleşmesi (hangi durumda ne döner)
| # | Durum | Dönen değer | Yan etki | Kullanıcı ne görür | AC |
|---|---|---|---|---|---|
| 1 | Çoklu satır, biri active | Hata yok, seçilen satır render | Yok | Aktif abonelik bilgisi | AC-1 |
| 2 | Çoklu satır, eşit öncelik | En yeni seçilir | Yok | En yeni kaydın bilgisi | AC-3 |
| 3 | Hiç satır yok | Mevcut davranış | Yok | "Aboneliğiniz yok" | AC-4 |
| 4 | Seçilen satır past_due | Hata yok | Yok | Vurgulu uyarı + /pricing linki | AC-5 |
| 5 | Sorgu hatası (gerçek DB hatası) | Mevcut davranış (değişmedi) | Yok | "yüklenemedi" | (mevcut, değişmedi) |
| 6 | Hiçbir şey yapılamadı ama hata yok | Oluşmaz — her dal açık bir render üretir | — | — | Tüm AC'ler |

Kısmi başarı: Uygulanamaz — seçim ya hepsi ya hiçbiri (bir satır seçilir
veya hiç satır yoktur).
Boş sonuç ↔ hata ayrımı: Boş dizi (AC-4, "Aboneliğiniz yok") ile gerçek
sorgu hatası (mevcut "yüklenemedi" dalı) AYRI kalır, değişmiyor.

## Threat Model
Tetikleyici yok — bu bir veri-seçim/correctness düzeltmesi, kullanıcı
girdisi/yetkilendirme/RLS değişmiyor (`agent_id` filtresi aynen korunuyor,
AC-8 ile regresyon olarak sabitlendi). Değerlendirilen tetikleyiciler:
kimlik doğrulama/yetkilendirme (yok, mevcut auth guard değişmiyor),
kullanıcı girdisi (yok), dış API (yok) — hiçbiri uymadı.

## Test Strategy
Unit: 70% — `pickSubscription(rows)` saf fonksiyonu: çoklu satır, eşit
öncelik, boş dizi, bilinmeyen status değeri (dal kapsamı %100).
Integration: 20% — sayfanın doğru satırı render ettiği, past_due
uyarısı+linki, `agent_id` filtresinin hâlâ kullanıldığı (mock Supabase
client ile).
E2E: 10% — tek bir Playwright smoke testi (opsiyonel, past_due uyarısı
ve linkinin göründüğünü doğrular) — bu turda zorunlu değil, zaman
izin verirse yapılır.

## Benchmark / Başarı Ölçütü
Coverage Target: `pickSubscription` için dal kapsamı %100, sayfa için
satır kapsamı %80.
Performance Target: Yok.
Görsel/UI kriteri: past_due uyarısının görsel vurgusu (`role="alert"`)
— `vision-test` tetiklenmiyor, DOM/accessibility-tree kontrolü yeterli.

## Kapsam Dışı
- Ödeme güncelleme entegrasyonu (iyzico kart güncelleme) — ayrı bir
  entegrasyon ve ayrı bir threat-model gerektirir, kesin kapsam dışı.
- Boş-sonuç UX'i (zaten "Aboneliğiniz yok" var, değişmiyor).

## Etkilenen Dosyalar/Modüller (bilinen)
- `web/src/app/account/subscription/page.tsx` (değiştir)
- `web/src/app/account/subscription/page.test.tsx` (genişlet — mevcut 4
  test korunur, yeni senaryolar eklenir)

## Proje Ortamı Kısıtı (arama/grep kapsamı)
Doğrulandı (önceki görevlerde zaten doğrulandı).

## Rollback Beklentisi
Geriye dönük uyumsuz değil — sadece doğru bir seçim mantığı ekleniyor,
tek-satır durumunda davranış AYNEN korunuyor.

## Risks
Yok (küçük, dar kapsamlı bir correctness düzeltmesi).

## Assumptions
- Öncelik sırası (`STATUS_PRIORITY` sabit dizisi) Opus alt-ajanı
  tarafından önerildi: `active > trialing > past_due > pending >
  needs_review > failed > canceled` — kullanıcıya ayrıca onaylatılmadı.

## Unknowns
Yok.

## Sorular ve Cevaplar (ham kayıt)
1. Öncelik sırası → active>trialing>past_due>pending>needs_review>failed>canceled (Opus alt-ajanı tarafından yanıtlandı)
2. Tie-break → created_at desc sıralı liste, ilk eşleşen (Opus alt-ajanı tarafından yanıtlandı)
3. trialing etiketi → eklenir, "Deneme sürümü" (Opus alt-ajanı tarafından yanıtlandı)
4. past_due CTA → /pricing linki + role="alert" vurgu, ödeme güncelleme YOK (Opus alt-ajanı tarafından yanıtlandı)
5. Boş sonuç → mevcut davranış değişmez (Opus alt-ajanı tarafından yanıtlandı)
6. Plan join → sadece seçilen satırın kendi plan'ı (Opus alt-ajanı tarafından yanıtlandı)
7. Test oranı → unit 70/integration 20/e2e 10 (Opus alt-ajanı tarafından yanıtlandı)
8. Threat-model → tetikleyici yok (Opus alt-ajanı tarafından yanıtlandı)
9. Kapsam dışı → ödeme güncelleme entegrasyonu (Opus alt-ajanı tarafından yanıtlandı)
