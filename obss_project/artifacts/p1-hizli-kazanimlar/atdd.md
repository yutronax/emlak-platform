---
task_slug: p1-hizli-kazanimlar
jira_id: EML-95
threat_model: not-applicable
priority: medium
coverage_target: 80
performance_target: null
memory_target: null
test_strategy:
  unit: 70
  integration: 30
  e2e: 0
affected_modules:
  - web/src/components/site-header.tsx
  - web/src/app/(marketing)/page.tsx
  - web/src/app/(marketing)/pricing/page.tsx
  - web/src/app/(marketing)/login/page.tsx
  - web/src/app/(marketing)/signup/page.tsx
  - web/src/app/(marketing)/sifremi-unuttum/page.tsx
  - web/src/app/(marketing)/sifre-yenile/page.tsx
  - web/src/app/globals.css
---

# ATDD — p1-hizli-kazanimlar

## Jira Kaynağı
[EML-95 — P1 hızlı kazanımlar: container hizası, aktif sayfa, form üstte, AA kontrast](https://kuyusuzyusuf123.atlassian.net/browse/EML-95)
Kaynak: `obss_project/artifacts/tasarim-elestirisi-2026-10-28/rapor.md` §5 P1 (düşük eforlu üç madde).

## Persona
Türkiye'deki emlakçı; siteyi çoğunlukla telefondan, ilk kez fiyat/kayıt için ziyaret ediyor.

## Hedef (Neden)
Raporun P1 bulguları: header logosu hero metninden ~35px içeride (iki farklı container), aktif sayfa göstergesi yok (kayıt sayfasında "Kayıt Ol" duruyor), kayıt/giriş masaüstünde boş sol panel + kırpık çizim, açık gri metin AA sınırında, nav/logo küçük. Hepsi güven ve okunabilirliği düşürüyor, düşük eforla düzelir.

## User Story
As a emlakçı ziyaretçi
I want hizalı, okunaklı, nerede olduğumu gösteren sayfalar ve doğrudan forma açılan kayıt/giriş
So that siteye güvenip daha hızlı kayıt olayım.

## Acceptance Criteria
1. [Critical] **AC-1 Container hizası:** Given header ve tüm marketing sayfaları (/, /pricing, /login, /signup, /sifremi-unuttum, /sifre-yenile), When 320/375/768/1280px'te açılır, Then header ve bölümler aynı sarmalayıcıyı kullanır (`mx-auto max-w-6xl px-4 md:px-6`; landing hero 7xl→6xl) ve logo sol kenarı ile ilk içerik başlığının sol kenarı arasındaki fark ≤2px. Form kartları içte `max-w-sm` kalabilir (ölçüm form sayfalarında sayfa başlığı/form kartı sarmalayıcısına göre değil, dış sarmalayıcıya göre yapılır).
2. [Critical] **AC-2 Aktif sayfa:** Given header, When pathname bir nav linkiyle eşleşir, Then o link `aria-current="page"` taşır ve görsel olarak ayrışır (renk + font-semibold + alt çizgi — yalnız renge dayanmaz). Gösterge SSR çıktısında bulunur.
3. [High] **AC-3 Eşleştirme kuralı:** Query yok sayılır; `/signup/...` gibi alt yollar ilgili linki aktif yapar; `/` yalnız tam eşleşmede aktif; bilinmeyen yolda hiçbir link aktif değildir ve hata yoktur. Saf bir fonksiyonla (`isActivePath(pathname, href)`) unit testlenir.
4. [High] **AC-4 Karşı aksiyon:** /signup (ve alt yolları) açıkken "Kayıt Ol" CTA'sı render edilmez, "Giriş" linki görünür kalır; /login açıkken "Giriş" linki render edilmez, "Kayıt Ol" CTA'sı kalır. Diğer sayfalarda mevcut davranış.
5. [High] **AC-5 Form üstte:** /login ve /signup'ta dekoratif sol panel ve çizim kaldırılır; form tek sütun, ortalı, üst boşluk `pt-10 md:pt-16` (dikey ortalama yok). Sayfa içinde dekoratif `img`/`svg` sayısı 0 (form ikonları hariç). Form alanları, KVKK kutusu ve gönderim mantığı değişmez.
6. [High] **AC-6 Kontrast:** Marketing kapsamındaki ikincil metin `text-slate-500` → `text-slate-600` (#475569); fog-50/beyaz zeminde kontrast ≥4.5:1. Global token yaklaşımı tercih edilir.
7. [Medium] **AC-7 Tipografi:** Nav linkleri `text-[15px] md:text-base`, logo `text-lg md:text-xl`. Header ≥768px'te ≤64px, 320px'te tek satır (önceki görev AC-1 korunur), `scrollWidth ≤ innerWidth` dört genişlikte.
8. [Medium] **AC-8 Oturum dalı:** Header'ın giriş yapmış kullanıcı davranışı (varsa) değişmez.

## Threat Model
Tetikleyici yok — değerlendirilen: kimlik doğrulama/yetkilendirme, kullanıcı girdisi, dosya, ödeme, KVKK/kişisel veri, multi-tenant, dış API, arka plan işi, yeni HTTP ucu, service_role erişimi; hiçbiri uymadı çünkü auth akışı, form alanları/gönderim mantığı ve KVKK metni değişmiyor, yalnız sunum katmanı değişiyor.

## Davranış Sözleşmesi
| # | Durum | Dönen değer / durum | Yan etki | Kullanıcı ne görür | AC |
|---|---|---|---|---|---|
| 1 | Marketing sayfası açılır (happy path) | 200 HTML; header'da eşleşen linkte `aria-current="page"` | yok | Hizalı içerik, aktif link vurgulu, koyu ikincil metin | AC-1,2,6,7 |
| 2 | `/pricing?ref=x` | `isActivePath("/pricing","/pricing") === true` (query zaten pathname'de yok) | yok | "Fiyatlar" aktif | AC-3 |
| 3 | Bilinmeyen yol (`/kvkk`, `/gizlilik`) | hiçbir linkte `aria-current` yok | yok | Normal header, hata yok | AC-3 |
| 4 | JS kapalı / SSR | `aria-current` sunucu HTML'inde mevcut | yok | Aynı gösterge | AC-2 |
| 5 | /signup | "Kayıt Ol" CTA DOM'da yok, "Giriş" var | yok | Yalnız "Giriş" aksiyonu | AC-4 |
| 6 | /login | "Giriş" linki DOM'da yok, "Kayıt Ol" var | yok | Yalnız "Kayıt Ol" aksiyonu | AC-4 |
| 7 | Kısmi: bir sayfada container farklı kalır | verify ölçümü o sayfa+viewport için FAIL (fark >2px) | yok | — (verify raporu sayfa adıyla) | AC-1 |
| 8 | Hiçbir şey değişmedi ama hata yok | verify önce/sonra tablosu (logo left, ilk başlık left, nav font-size, ikincil metin rengi/kontrast, header yüksekliği, scrollWidth) değişmemişse FAIL | yok | — | AC-1,6,7 |

Silinen satırlar: girdi geçersiz / kaynak yok / yetkisiz / dış bağımlılık / zaman aşımı — saf sunum değişikliği, veri veya ağ çağrısı eklenmiyor.
Boş sonuç ↔ hata ayrımı: uygulanmaz (veri yok).
Operatör görünürlüğü: verify'daki ölçüm tablosu (satır 7-8).
Doğrudan tetikleme notu: AC-1/6/7 birim testte yalnız sınıf varlığıyla vekil kanıtlanır; gerçek kanıt verify'da tarayıcı ölçümüdür. AC-2/3/4 doğrudan (fonksiyon + render testi).

## Test Strategy
Unit: 70% — `isActivePath` (tam, alt yol, query, `/` tam eşleşme, bilinmeyen).
Integration: 30% — SiteHeader render (usePathname mock): aria-current, /signup'ta CTA yok, /login'de Giriş yok; login/signup sayfasında dekoratif img/svg yok.
E2E: 0% — Playwright yok; tarayıcı ölçümü verify gate 12'de.

## Benchmark / Başarı Ölçütü
Coverage Target: 80%
Görsel/UI kriteri: logo↔içerik sol kenar farkı ≤2px; kontrast ≥4.5:1; header ≤64px (≥768) ve 320'de tek satır; scrollWidth ≤ vw (320/375/768/1280); login/signup dekoratif görsel 0. Ölçüm Browser pane'de JS getBoundingClientRect/getComputedStyle ile, önce/sonra tablosu.

## Kapsam Dışı
Nav'a SSS/"Nasıl çalışır", undraw değişimi, güven rozetleri, kayıt sayfasında fayda listesi, dashboard/admin, dark mode, yeni renk paleti, telefonla giriş, hero mockup, hero metni çelişkisi.

## Etkilenen Dosyalar/Modüller (bilinen)
Frontmatter `affected_modules`; ayrıca ilgili testler (site-header.test, login/signup page.test).

## Proje Ortamı Kısıtı
Arama `web/` ile sınırlı tutulmalı (git kökü proje klasörü; doğrulandı).

## Rollback Beklentisi
Tek commit revert; DB/env yok.

## Risks
- Mevcut testlerdeki "Kayıt Ol" metni ve sınıf beklentileri kırılabilir → role/aria ile güncellenmeli.
- Global token değişikliği dashboard metnini de koyulaştırabilir — kabul edilebilir, verify'da göz kontrolü.
- Hero 7xl→6xl satır kırılmalarını değiştirebilir.
- Header `usePathname` için client bileşen gerektirebilir; SSR'da aria-current yine üretilir (AC-2).

## Assumptions
- Header'da giriş yapmış kullanıcı dalı yoksa AC-8 N/A sayılır (varsayım, plan doğrular).
- "Giriş Yap" linki önerisi yerine mevcut "Giriş" linki korunur (header zaten içeriyor).

## Unknowns
- Yok.

## Sorular ve Cevaplar (ham kayıt — Opus low alt-ajanı tarafından yanıtlandı)
1. Container → `max-w-6xl mx-auto px-4 md:px-6`, hero 7xl→6xl, form kartı içte max-w-sm — en az değişiklikle hiza.
2. Aktif gösterge → renk + semibold + 2px alt çizgi + aria-current; /signup'ta "Kayıt Ol" gizli, /login'de "Giriş" gizli — pasif buton kafa karıştırır, yalnız renk WCAG 1.4.1'e aykırı.
3. Paneller → tamamen kaldır, form üstte `pt-10 md:pt-16` — mobilde form ilk ekranda.
4. Kontrast → global slate-500→slate-600 (#475569), ≥4.5:1 — sayfa bazlı düzeltme atlanır.
5. Tipografi → nav 15/16px, logo 18/20px — raporun alt sınırları, header sınırlarıyla uyumlu.
6. Davranış sözleşmesi → yukarıdaki tablo (pathname eşleşmesi, SSR, ölçüm tabanlı FAIL).
7. Başarı ölçütü → ≤2px, ≥4.5:1, ≤64px, scrollWidth≤vw, dekoratif görsel 0.
8. Kapsam dışı → P2 maddeleri, dashboard/admin, dark mode, yeni palet.
9. Test → 70/30/0, ölçüm verify'da — Playwright yok.
10. Rollback → tek commit revert; riskler test kırılması, global token yayılması, hero satır kırılması.
11. Onay → verify ölçüm tablosu PASS + kullanıcı ekran görüntüsüyle.
12. Threat model → not-applicable, yalnız sunum katmanı.

Notion mirror: atlandı (önceki görevlerle aynı, Jira yeterli).
