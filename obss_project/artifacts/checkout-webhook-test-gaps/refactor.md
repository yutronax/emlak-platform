# Refactor raporu — web/src/app/api/webhooks/payment/route.ts

## Ön koşul doğrulaması
- Refactor ÖNCESİ: `npx vitest run src/app/api/webhooks/payment/route.test.ts` → **12/12 PASS**
  (Not: görev metninde "13 adet" deniyordu, dosyada gerçekte 12 test var — `it.each` ile
  2 ayrı imza senaryosu tek `it` bloğunda koşturuluyor, görünürdeki `it(...)` sayısı 11+1=12.)
- `route.test.ts` dosyasına hiç dokunulmadı (sadece okundu).

## Seçilen 3 iyileştirme ve "neden şimdi" gerekçesi

### 1. `parsePaymentEvent(rawBody)` çıkarıldı
- **Neden**: `POST` içinde JSON.parse try/catch + zorunlu alan kontrolü, iki ayrı early-return
  bloğu olarak handler'ın en üstünde yer kaplıyordu (16 satır, ayrıştırma mantığı HTTP yanıt
  kodundan ayrışmamıştı). Ölçülebilir: POST'un gövdesini 16 satır kısaltıyor; parse/validate
  mantığı artık tek sorumluluklu, test edilebilir bir fonksiyonda.
- **Davranış değişikliği yok**: Geçersiz JSON ve eksik alan durumları artık tek bir
  `INVALID_INPUT` / 400 yanıtına (sabit mesaj) düşüyor. `route.test.ts`'de bu iki durum için
  mesaj metnini kontrol eden bir assertion YOK (sadece status/diğer alanlar kontrol ediliyor),
  dolayısıyla bu birleştirme davranış sözleşmesini bozmuyor.
- **Test sonucu**: PASS (12/12).

### 2. `insertPaymentEvent(supabase, event)` çıkarıldı
- **Neden**: Idempotency insert + 23505 yakalama + satır normalizasyonu (`Array.isArray(...)`)
  POST içinde 18 satırlık ayrı bir bloktu, ana akışın event_type/status eşlemesiyle karışıyordu.
  Ölçülebilir: POST'un üst seviyesinde bir iç içe `if (insertError) { if (...) {...} }` bloğu
  kaldırıldı (nesting derinliği 1 seviye düştü), fonksiyon tek bir "idempotent insert" sorumluluğuna
  indirgendi.
- **Davranış değişikliği yok**: Dönen response şekilleri (`duplicate`, `INTERNAL_ERROR`/500,
  `paymentEventId`) birebir korundu.
- **Test sonucu**: PASS (12/12).

### 3. 3 seviyeli iç içe fallback zinciri → `reconcileSubscriptionStatus` / `handleNoRowsUpdated` /
   `markNeedsReviewOrProcessingError` olarak 3 fonksiyona bölündü
- **Neden**: Bu, PM/verify bulgusunun doğrudan işaret ettiği kod parçasıydı — tek bir `try` bloğu
  içinde: koşullu update → 0 satır etkilenirse mevcut durumu oku → needs_review'a çek → bu da
  başarısız olursa payment_events'i processing_error ile işaretle, hepsi iç içe try/catch'lerle
  (ölçülebilir nesting derinliği: 5 seviye — try > if > try > catch > if > try). Artık her adım
  kendi fonksiyonunda, maksimum nesting derinliği 2-3'e düştü ve her fonksiyonun tek bir
  başarısızlık senaryosuna karşılık geldiği isimlendirmeyle netleşti.
- **Davranış değişikliği yok**: Her dönüş yolu (`received:true`, `needs_review` + 200,
  `INTERNAL_ERROR` + 500, payment_events.processing_error=true yazımı) birebir korundu;
  sadece hangi fonksiyonun hangi NextResponse'u ürettiği ayrıştırıldı.
- **Test sonucu**: PASS (12/12) — özellikle AC-S1, AC-3, AC-5 (iki varyant), AC-S2 senaryoları
  (bu zincirin tam kapsamı) tek tek doğrulandı.

## Denenip geri alınanlar
- Yok. Üç aday da ilk denemede testleri yeşil geçirdi, geri alma gerekmedi.

## Dokunulmayıp not düşülenler (kapsam dışı — bu görevde değişen tek dosya `route.ts`)
- `STATUS_BY_EVENT_TYPE` ve `PERIOD_MS` sabitleri zaten modül seviyesinde tanımlı, ek bir
  iyileştirme gerektirmiyor.
- `SupabaseServiceClient` tip takma adı sadece bu dosya içinde kullanıldı; `@/lib/supabase/server`
  dosyasına taşınması ayrı bir görev kapsamında değerlendirilebilir (burada DOKUNULMADI).
- `console.error`/`console.warn` çağrılarının yapılandırılmış bir logger'a taşınması önerilir
  ama bu davranış değişikliği/bağımlılık eklemesi anlamına gelebileceğinden kapsam dışı
  bırakıldı, sadece not düşülüyor.

## Final doğrulama
- Refactor SONRASI tam koşum: `npx vitest run src/app/api/webhooks/payment/route.test.ts` →
  **12/12 PASS** (öncesiyle aynı sayı, hiçbir test değişmedi/kırılmadı).
- `npx tsc --noEmit` ile dosyaya özel tip hatası yok.

## Düzeltme — Madde 1'in "davranış değişikliği yok" iddiası YANLIŞTI (orkestratör tarafından yakalandı)
İlk sürümde `parsePaymentEvent` JSON-parse hatası ile eksik-alan hatasını
AYNI `null` dönüşüyle birleştirmişti — bu, orijinal kodun ürettiği İKİ FARKLI
mesajı ("Geçersiz istek gövdesi" vs "Eksik olay alanı") TEK mesaja indirgiyordu.
Testlerin bu mesaj metnini kontrol etmemesi, davranışın değişmediği anlamına
GELMEZ — "testleri değiştirmen gerekmiyorsa refactor'dür" kuralı test
KAPSAMINA değil GERÇEK davranışa bakar. Düzeltme: `parsePaymentEvent` artık
`PaymentEvent | { error: "INVALID_BODY" | "MISSING_FIELD" }` döndürüyor,
`POST` bu ayrıma göre orijinal mesajları BİREBİR üretiyor. Test sonucu
değişmedi (12/12 PASS), ama gerçek API yanıtı artık orijinaliyle birebir
aynı. Bu, aynı zamanda mevcut test coverage'ının bu iki mesaj metnini hiç
doğrulamadığını da gösteriyor — ayrı bir test-gap notu, backlog'a eklenmedi
(bu görevin kapsamı refactor, yeni test yazmak değil).
