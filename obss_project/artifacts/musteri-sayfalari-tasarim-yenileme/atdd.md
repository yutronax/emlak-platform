---
task_slug: musteri-sayfalari-tasarim-yenileme
jira_id: EML-80
threat_model: not-applicable
priority: medium
coverage_target: 70
performance_target: null
memory_target: null
test_strategy:
  unit: 10
  integration: 10
  e2e: 50
  visual: 30
affected_modules:
  - web/src/app/page.tsx
  - web/src/app/pricing/page.tsx
  - web/src/app/login/page.tsx
  - web/src/app/signup/page.tsx
  - web/src/app/layout.tsx
  - web/src/app/globals.css
notion_url: https://app.notion.com/p/4068b4f544668160bb78fcbd02f07bd3?pvs=204
---

# ATDD — musteri-sayfalari-tasarim-yenileme

## Jira Kaynağı
[EML-80 — landing/pricing/login/signup için tutarlı görsel kimlik](https://kuyusuzyusuf123.atlassian.net/browse/EML-80)

## Persona
Platformu yeni keşfeden ziyaretçi emlakçı (birincil — bireysel/1-5 kişilik ofis, teknoloji meraklısı olmayabilir, mobilde çok vakit geçirir). Mevcut kullanıcının girişi (ikincil persona).

## Hedef (Neden)
Önce güven/profesyonellik algısı, sonra marka kimliği. Platform henüz ücretli kullanıcıya açılmadığı için dönüşüm verisi yok — şu an varsayılan siyah-beyaz görünüm, ödeme akışı barındıran bir platform için güveni zayıflatıyor.

## User Story
As a platformu keşfeden emlakçı
I want tutarlı, güven veren bir görsel deneyim (landing → fiyat → kayıt/giriş)
So that platforma güvenip kayıt olma kararını daha kolay verebilirim

## Görsel Yön (Design Direction — frontend-pipeline'ın bu adımı burada kayıtlı)
**Kurumsal-güven + sıcak vurgu:** Lacivert/koyu petrol ana renk, kırık beyaz zemin, tek vurgu rengi terracotta/turuncu (SADECE CTA'larda). Sans-serif (Inter veya Plus Jakarta Sans, `next/font` ile — CLS önlemek için). Mor gradient YASAK (proje kuralı). Gerekçe: emlak güven/para işi → lacivert ciddiyet; WhatsApp'ın pratik/hızlı hissi tek sıcak vurguyla, kitleyi ürkütmeden aktarılıyor.

## Acceptance Criteria (Given-When-Then, önceliklendirilmiş)
1. [Critical] Given ziyaretçi `/` sayfasına girer, When sayfa yüklenir, Then ortak header (metin-logo + "Fiyatlar"/"Giriş" linkleri), hero (mevcut başlık+paragraf, yeni tipografi), 2 CTA ("Kayıt Ol" birincil → `/signup`, "Fiyatları Gör" ikincil → `/pricing`), mevcut açıklamadan türetilen 3 maddelik ikonlu "nasıl çalışır" şeridi, footer görünür.
2. [Critical] Given `/pricing`'in `plans` sorgusu başarılı, When sayfa render edilir, Then 3 plan (99/299/599 TL, veri DEĞİŞMEDEN) desktop'ta 3 sütun/mobilde 1 sütun kart düzeninde, Pro kartı "Önerilen" rozetiyle vurgulu, fiyat "TL/ay" formatında, "Satın Al" butonu mevcut `BuyButton`/iyzico akışına DOKUNMADAN render edilir.
3. [High] Given `/pricing`'in `plans` sorgusu BAŞARISIZ olur (mevcut hata dalı), When sayfa render edilir, Then kart grid'i yerine `role="alert"` taşıyan inline hata kutusu gösterilir, header/footer görünmeye devam eder.
4. [High] Given `/login`'de `state.error` dolu (hatalı giriş), When form submit sonrası render edilir, Then formun üstünde `role="alert"` kırmızı tonlu inline banner'da hata metni gösterilir, e-posta alanı korunur.
5. [High] Given `/signup`'ta `state.message` dolu (başarılı kayıt), When form submit sonrası render edilir, Then `role="status"` yeşil tonlu inline banner'da mesaj gösterilir.
6. [Medium] Given bir form submit edilir (`isPending=true`), When işlem sürüyor, Then buton disabled, düşük opaklık, spinner, `aria-busy="true"`, metin "…ılıyor" olarak değişir (çift submit engellenir).
7. [Critical] Given `/login`/`/signup`'taki her input, When sayfa render edilir, Then her input'a görünür bir `<label htmlFor>` bağlıdır (placeholder tek başına YETERSİZ sayılır), doğru `autocomplete`/`type` değerleri kullanılır. **(Erişilebilirlik AC)**
8. [High] Given 4 sayfanın tamamı, When 375/768/1280px genişliklerde (mobile/tablet/desktop) açılır, Then hiçbirinde yatay scroll veya layout kırılması olmaz.
9. [High] Given 4 sayfanın tamamı, When Lighthouse accessibility taraması çalıştırılır, Then skor her sayfada 95 veya üzeri olur, tüm metin/zemin çiftleri WCAG AA kontrastını (normal metin 4.5:1) sağlar.
10. [Medium] Given header/footer component'leri eklenir, When admin/agent sayfaları (`/admin/*`, `/agent/*`) ziyaret edilir, Then bu sayfalar DEĞİŞMEMİŞ görünür (header/footer SADECE bu 4 public sayfaya uygulanır, root layout'a DEĞİL — bir route group ile izole edilir).

## Threat Model
Tetikleyici yok — değerlendirilen tetikleyiciler: kimlik doğrulama/yetkilendirme (mevcut `login`/`signup` server action'ları DEĞİŞMİYOR, sadece JSX/className/aria), kullanıcı girdisi (form alanları zaten var, yeni bir girdi yolu eklenmiyor), dosya yükleme/indirme (yok), ödeme (mevcut iyzico/`BuyButton` akışına dokunulmuyor, sadece sunum), kişisel veri (yok, mevcut akış değişmiyor), çok kiracılı sınır (yok), dış API çağrısı (yok, yeni entegrasyon yok), arka plan işi (yok), yeni HTTP ucu (yok) — hiçbiri uymadı çünkü bu görev saf stil/markup/erişilebilirlik işi, hiçbir veri akışı/yetki/iş mantığı değişmiyor.

## Davranış Sözleşmesi (hangi durumda ne döner)
| # | Durum | Dönen değer / durum kodu | Yan etki | Kullanıcı ne görür | AC |
|---|---|---|---|---|---|
| 1 | `/` yüklenir | 200, statik render | Yok | Header, hero, 2 CTA, 3 maddelik şerit, footer | AC-1 |
| 2 | `/pricing` plans başarılı | 200, 3 plan | Yok | 3 sütun/1 sütun kart, Pro "Önerilen", "Satın Al" (mevcut akış) | AC-2 |
| 3 | `/pricing` plans başarısız | 200 (sayfa render), mevcut hata dalı | Yok (mevcut loglama korunur) | `role="alert"` inline hata kutusu, header/footer kalır | AC-3 |
| 4 | `/login` hatalı giriş | Server action `{error}`, redirect yok | Oturum açılmaz | `role="alert"` kırmızı banner | AC-4 |
| 5 | `/signup` başarılı kayıt | Server action `{message}` | Mevcut davranış (Supabase kullanıcı+doğrulama e-postası) DEĞİŞMEZ | `role="status"` yeşil banner | AC-5 |
| 6 | Form submit sırasında | Henüz dönüş yok | Server action çalışıyor | Buton disabled+spinner+`aria-busy` | AC-6 |

Kısmi başarı: N/A — bu görev saf UI/markup, çok-adımlı bir işlem veya atomik olmayan bir yazma yok.
Hiçbir şey yapılamadı ama hata da yok: N/A — sayfa her zaman render edilir (hata durumunda da inline mesajla), sessiz bir "hiçbir şey yapılmadı" durumu yok.
Boş sonuç ↔ hata ayrımı: AC-2/AC-3 arasındaki ayrım zaten mevcut kodda var (plans sorgusu başarılı+boş dizi vs. sorgu hatası) — bu görev SADECE sunumu değiştiriyor, bu ayrımı icat etmiyor.

## Test Strategy
Unit: %10 — yeni `ui/button`/`ui/alert` component'lerinin render/aria durumları.
Integration: %10 — form state'inden (`state.error`/`state.message`) banner'a doğru eşleme.
E2E: %50 — Playwright ile 4 sayfa × 3 viewport (375/768/1280px): yatay scroll yokluğu, label-input ilişkileri, CTA link hedefleri, axe erişilebilirlik taraması.
Görsel doğrulama: %30 — `vision-test` skill'i ile screenshot + kullanıcının manuel estetik onayı (otomasyon beğeniyi ölçemez).

## Benchmark / Başarı Ölçütü
Coverage Target: %70 (bu bir UI işi, düşük bir hedef — asıl ölçüt aşağıdaki somut kriterler).
Diğer ölçülebilir kriterler:
- 375/768/1280px'de 4 sayfanın hiçbirinde yatay scroll/layout kırılması yok.
- Lighthouse accessibility skoru her sayfada ≥95.
- Tüm metin/zemin çiftleri WCAG AA (normal metin 4.5:1) sağlıyor.
- Renk/font değerleri tek bir token kaynağından (`globals.css`/Tailwind tema) geliyor, sayfalarda hardcoded hex YOK.
- Mevcut e2e/unit testler yeşil kalıyor (regresyonsuz).
Görsel/UI kriteri: YUKARIDAKİ TÜM KRİTER — bu görev tamamen görsel, `verify` adımında `vision-test` + Playwright multi-viewport ZORUNLU çalışacak.

## Kapsam Dışı
- `/admin/*`, `/agent/*` sayfaları (zaten çalışıyor, bu görev sadece 4 public sayfayı kapsıyor).
- Server action'lar (`login`, `signup`), `BuyButton`/iyzico mantığı, Supabase sorguları — davranış DEĞİŞMİYOR.
- Fiyat/plan verisi (99/299/599 TL aynen kalıyor).
- Gerçek logo/favicon tasarımı (metin-logo kullanılacak).
- Müşteri yorumu, SSS, istatistik iddiası ("1000+ emlakçı" gibi — uydurma sosyal kanıt, hukuki/güven riski).
- Dark mode (token yapısı ileride hazır olsun ama bu görevde UYGULANMAYACAK).
- i18n, animasyon kütüphanesi.
- Client-side form validasyon mesajları (native HTML `required`/`type`/`minLength` dışında yeni bir validasyon akışı eklenmiyor).

## Etkilenen Dosyalar/Modüller (bilinen)
- `web/src/app/page.tsx`, `web/src/app/pricing/page.tsx`, `web/src/app/login/page.tsx`, `web/src/app/signup/page.tsx` (yeniden yazılacak — JSX/stil)
- `web/src/app/layout.tsx` (font ayarı — `next/font`, CLS önleme)
- `web/src/app/globals.css` (renk/typography token'ları)
- YENİ: `web/src/components/site-header.tsx`, `site-footer.tsx` (SADECE bu 4 sayfaya, route group ile izole — `plan` adımında Next.js 16'nın route group mekanizması doğrulanacak)
- YENİ: `web/src/components/ui/button.tsx`, `ui/alert.tsx` (küçük, yeniden kullanılabilir)

## Proje Ortamı Kısıtı (arama/grep kapsamı)
Doğrulanmadı — önceki görevlerde de doğrulanmamış olarak not edilmişti. Arama/grep bu görevde `emlak-platform/` klasörüyle sınırlı tutulmalı.

## Rollback Beklentisi
Basit `git revert` yeterli — DB/migration/env değişikliği yok, saf frontend değişikliği.

## Risks
- **Risk:** Header/footer yanlışlıkla root layout'a konursa admin/agent sayfaları da etkilenir — `plan` adımında route group yapısı (örn. `(marketing)`) ile bu kesin olarak izole edilmeli.
- **Risk:** Font yükleme CLS (layout shift) yaratabilir — `next/font` kullanımı zorunlu (`<link>` ile manuel font yükleme YASAK).
- **Risk:** Seçilen terracotta/turuncu vurgu renginin beyaz/kırık-beyaz zemin üzerinde WCAG AA kontrastını sağlaması gerekiyor — `plan`/`code-copilot` aşamasında gerçek hex değerleri kontrast hesaplayıcıyla doğrulanmalı, "güzel görünüyor" yetmez.

## Assumptions
- Mevcut `login`/`signup` server action'ları ve `BuyButton` mantığı DEĞİŞMİYOR, sadece JSX/className/aria değişiyor.
- Kullanıcı kabul kriterinin estetik kısmını (3 viewport screenshot) manuel olarak onaylayacak — otomatik testler sadece layout/erişilebilirlik/regresyonu ölçer.

## Unknowns
- Next.js 16'nın route group mekanizmasının (header/footer'ı sadece 4 sayfaya uygulamak için) tam söz dizimi `plan` adımında gerçek Next.js 16 dokümantasyonundan (`node_modules/next/dist/docs/`) doğrulanacak.

## Sorular ve Cevaplar (ham kayıt)
1. Persona → (Opus low alt-ajanı: yeni ziyaretçi emlakçı, birincil)
2. Hedef/neden → (Opus low alt-ajanı: güven/profesyonellik önce, marka kimliği sonra)
3. Görsel yön → (Opus low alt-ajanı: lacivert+kırık beyaz+terracotta vurgu, mor gradient yasak — yukarıya "Görsel Yön" bölümüne işlendi)
4. Happy path (`/`) → (Opus low alt-ajanı: header+hero+2 CTA+3 madde şerit+footer)
5. Kapsam (içerik mi stil mi) → (Opus low alt-ajanı: esas stil, sınırlı yeni içerik sadece CTA/3-madde-şerit/header-footer, sosyal kanıt YOK)
6. Fiyatlar → (Opus low alt-ajanı: veri aynen kalır, sadece sunum — Pro rozeti, "/ay" eki)
7. Hata/loading durumları → (Opus low alt-ajanı: inline banner `role="alert"`/`role="status"`, toast YOK, buton disabled+spinner+aria-busy)
8. Davranış sözleşmesi tablosu → (Opus low alt-ajanı tarafından dolduruldu, yukarıya işlendi)
9. Başarı ölçütü → (Opus low alt-ajanı: viewport/Lighthouse/kontrast/token/regresyon kriterleri)
10. Kapsam dışı → (Opus low alt-ajanı: 8 madde, yukarıya işlendi)
11. Bağımlılıklar/dosyalar → (Opus low alt-ajanı: 4 sayfa + layout/globals.css + yeni header/footer/ui component'leri, route group önerisi)
12. Erişilebilirlik kısıtı → (Opus low alt-ajanı: label/autocomplete/role=alert/focus-visible/kontrast/44px dokunma hedefi — AC-7/AC-9'a dönüştü)
13. Rollback → (Opus low alt-ajanı: basit git revert)
14. Kabul kriteri sahibi → (Opus low alt-ajanı: otomatik testler (layout/a11y/regresyon) + kullanıcının manuel estetik onayı)
15. Test stratejisi oranı → (Opus low alt-ajanı: unit 10/integration 10/e2e 50/görsel 30)
16. Bilinen riskler/varsayımlar → (Opus low alt-ajanı: server action'lar değişmiyor varsayımı doğru; route-group/CLS/kontrast riskleri yukarıya işlendi)
