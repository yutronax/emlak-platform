**Tasarım hedefi:** Paneli, ilanların öne çıktığı ve bağlantı durumlarının açıkça anlaşıldığı **Sıcak Editorial** bir arayüze dönüştürmek. Krem zemin, mürekkep metin, terakota vurgu, Lora başlıklar ve Inter arayüz yazıları bütün ekranlarda aynı sistemi oluşturmalı.

Kod ve iki önceki inceleme okundu. **Hiçbir dosya değiştirilmedi.** Aşağıdaki kodlar uygulama önerisidir; bu turda derleme veya canlı tarayıcı doğrulaması yapılmadı.

## 1. Mevcut yapı ve gerçek dosya haritası

Önemli bulgu: **Repodaki mevcut arayüz, verilen ekran görüntülerinden ileride.** Kodda ortak üst gezinme, abonelik rozeti, kapsam filtresi, kilitli kartlar ve WhatsApp grup seçimi bulunuyor. Plan, ekran görüntülerindeki eski yapıyı yeniden üretmek yerine mevcut bileşenleri iyileştirmeli.

### Teknoloji ve stiller

- **Next.js App Router**, `package.json` içinde Next `^16.4.3`, React `19.3.0`.
- **Tailwind CSS 4** kullanılıyor.
- `web/` kökünde ayrı `tailwind.config.*` bulunmuyor. Tema, `globals.css` içindeki `@theme inline` ile tanımlı.
- Tailwind dönüşümü `web/next.config.ts` içindeki `@tailwindcss/turbopack` üzerinden yapılandırılmış.
- Mevcut tema **Stellar Concrete**: lacivert, Inter Tight, Instrument Serif ve `rounded-leaf`.
- Kök `body` hâlâ Arial kullanıyor; bazı sayfalar `font-body` ile Inter’e geçiyor. Tipografi tutarlılığı bu nedenle yerel sınıflara bağlı.

### Dosyaların sorumlulukları

| Gerçek dosya | Mevcut sorumluluk |
|---|---|
| `web/src/app/layout.tsx` | Kök HTML, metadata, Google fontlarının yüklenmesi |
| `web/src/app/globals.css` | Tailwind importu, tema, animasyonlar, `rounded-leaf`, genel body stili |
| `web/src/app/agent/layout.tsx` | Agent sayfalarını `AppShell` içine alıyor |
| `web/src/components/app-shell/app-shell.tsx` | Oturum bilgisi, askıya alınmış hesap kontrolü, sayfa zemini, ortak header |
| `web/src/components/app-shell/app-header.tsx` | Logo, İlanlar/WhatsApp/Videolar/Vitrin gezinmesi, hesap menüsü |
| `web/src/app/agent/dashboard/page.tsx` | Dashboard başlığı, abonelik durumu, veri yükleme, erişim/hata/boş durumlar, filtre ve ilan yerleşimi |
| `web/src/app/agent/dashboard/feed-filters.tsx` | GET filtre formu: il, ilçe, oda, fiyat aralığı, kaynak grup, kapsam |
| `web/src/app/agent/dashboard/listing-card.tsx` | Açık ve kilitli ilan kartları |
| `web/src/app/agent/dashboard/notification-bell.tsx` | Yeni ilan sayacı, görüldü işaretleme, periyodik yenileme |
| `web/src/app/agent/dashboard/push-toggle.tsx` | Tarayıcı bildirim izni ve aboneliği |
| `web/src/app/agent/whatsapp/page.tsx` | Özellik bayrağı, oturum, ilk bağlantı/onay/grup verileri |
| `web/src/app/agent/whatsapp/wa-panel.tsx` | Risk kabulü, bağlanma, QR, polling, hatalar, bağlantıyı kaldırma |
| `web/src/app/agent/whatsapp/group-picker.tsx` | Grup seçimi, seçim sınırı, kaydetme, salt okunur durum |
| `web/src/components/ui/button.tsx` | Ortak primary/secondary buton ve pending davranışı |
| `web/src/components/ui/alert.tsx` | Hata ve başarı bildirimleri |
| `web/src/components/ui/confirm-dialog.tsx` | Odak yönetimi bulunan ortak onay penceresi |
| `web/src/app/agent/loading.tsx` | Agent segmenti yükleme ekranı |
| `web/src/components/status/page-skeleton.tsx` | Agent/admin tarafından paylaşılan yükleme iskeleti |
| `web/src/lib/listings-feed/format.ts` | Fiyat, konum, grup, geliş zamanı ve bildirim sayısı biçimlendirmesi |

**Mevcut header `site-header.tsx` değildir.** O bileşen tanıtım tarafına aittir; panel düzenlemesinin hedefi `components/app-shell/` olmalıdır.

## 2. Tasarım sistemi

### Sanat yönünün uygulanması

- **Krem:** Ekran boyunca kesintisiz arka plan.
- **Mürekkep:** Ana metin, ikonlar ve güçlü başlıklar.
- **Terakota:** Ana eylem, aktif gezinme çizgisi, küçük imza detayları.
- **Taş:** Ayırıcılar, pasif yüzeyler, mimari placeholder çizgileri.
- **Lora:** Sayfa ve önemli bölüm başlıkları.
- **Inter:** Formlar, fiyatlar, durumlar ve yardımcı bilgiler.
- **Köşeler:** Kontrollerde 8px, kartlarda 12px. Mevcut çapraz `rounded-leaf` bu panelde kullanılmamalı.
- **Derinlik:** İnce kenarlık ve hafif gölge. Büyük koyu gölgelerden kaçınılmalı.

### Tema kapsamı

Mevcut global `ink-900`, `cream-50`, `font-display` değerlerini değiştirmek; tanıtım, hesap ve admin ekranlarını da etkiler.

Bu yüzden **mevcut temaya dokunmadan `panel-*` tokenları eklenmeli**, yeni görünüm `agent/layout.tsx` üzerinden etkinleştirilmeli. Ortak bileşenlere gerektiğinde açık bir `appearance="editorial"` seçeneği verilmeli.

### Önerilen tam panel token bloğu

`web/src/app/globals.css` içine, mevcut kurallar korunarak eklenecek:

```css
@theme inline {
  --color-panel-canvas: var(--panel-canvas);
  --color-panel-surface: var(--panel-surface);
  --color-panel-subtle: var(--panel-subtle);

  --color-panel-ink: var(--panel-ink);
  --color-panel-muted: var(--panel-muted);
  --color-panel-line: var(--panel-line);
  --color-panel-control: var(--panel-control);

  --color-panel-accent: var(--panel-accent);
  --color-panel-accent-hover: var(--panel-accent-hover);
  --color-panel-accent-soft: var(--panel-accent-soft);

  --color-panel-success: var(--panel-success);
  --color-panel-success-soft: var(--panel-success-soft);
  --color-panel-warning: var(--panel-warning);
  --color-panel-warning-soft: var(--panel-warning-soft);
  --color-panel-danger: var(--panel-danger);
  --color-panel-danger-soft: var(--panel-danger-soft);

  --font-panel-body: var(--font-inter);
  --font-panel-heading: var(--font-lora);

  --radius-panel-control: 0.5rem;
  --radius-panel-card: 0.75rem;
  --radius-panel-pill: 999px;

  --shadow-panel-card: 0 4px 16px rgb(38 51 45 / 5%);
  --shadow-panel-menu: 0 12px 32px rgb(38 51 45 / 12%);

  --text-panel-caption: 0.75rem;
  --text-panel-caption--line-height: 1.5;

  --text-panel-label: 0.8125rem;
  --text-panel-label--line-height: 1.5;

  --text-panel-body: 0.875rem;
  --text-panel-body--line-height: 1.6;

  --text-panel-control: 1rem;
  --text-panel-control--line-height: 1.5;

  --text-panel-section: 1.25rem;
  --text-panel-section--line-height: 1.3;

  --text-panel-price: 1.5rem;
  --text-panel-price--line-height: 1.2;

  --text-panel-title: 1.75rem;
  --text-panel-title--line-height: 1.15;

  --text-panel-title-desktop: 2.25rem;
  --text-panel-title-desktop--line-height: 1.15;
}

/* Portal ile dışarı taşınan editorial dialog'a da uygulanabilir. */
[data-panel-theme="editorial"] {
  --panel-canvas: #F6F3EC;
  --panel-surface: #FFFEFA;
  --panel-subtle: #EAE5D9;

  --panel-ink: #26332D;
  --panel-muted: #60685F;
  --panel-line: #DED8CC;
  --panel-control: #85897F;

  --panel-accent: #B85C3B;
  --panel-accent-hover: #9C482E;
  --panel-accent-soft: #F3E4DB;

  --panel-success: #356247;
  --panel-success-soft: #E8EFE7;
  --panel-warning: #78571F;
  --panel-warning-soft: #F4ECD9;
  --panel-danger: #963D32;
  --panel-danger-soft: #F5E5E0;

  --panel-space-1: 0.25rem;
  --panel-space-2: 0.5rem;
  --panel-space-3: 0.75rem;
  --panel-space-4: 1rem;
  --panel-space-5: 1.25rem;
  --panel-space-6: 1.5rem;
  --panel-space-8: 2rem;
  --panel-space-10: 2.5rem;
  --panel-space-12: 3rem;
  --panel-space-16: 4rem;

  --panel-content-max: 70rem;
  --panel-touch-target: 2.75rem;
  --panel-duration: 160ms;

  min-inline-size: 0;
  color-scheme: light;
  color: var(--panel-ink);
  background: var(--panel-canvas);
  font-family: var(--font-inter), Arial, sans-serif;
}

.panel-container {
  inline-size: 100%;
  max-inline-size: var(--panel-content-max);
  margin-inline: auto;
  padding-inline: var(--panel-space-4);
}

.panel-page {
  padding-block: var(--panel-space-6) var(--panel-space-12);
}

.panel-title {
  font-family: var(--font-lora), Georgia, serif;
  font-size: 1.75rem;
  line-height: 1.15;
  font-weight: 500;
  letter-spacing: -0.025em;
}

.panel-surface {
  border: 1px solid var(--panel-line);
  border-radius: 0.75rem;
  background: var(--panel-surface);
  box-shadow: 0 4px 16px rgb(38 51 45 / 5%);
}

[data-panel-theme="editorial"] :where(
  a, button, input, select, textarea, summary
):focus-visible {
  outline: 2px solid var(--panel-ink);
  outline-offset: 3px;
}

@media (min-width: 48rem) {
  .panel-container {
    padding-inline: var(--panel-space-8);
  }

  .panel-page {
    padding-block: var(--panel-space-10) var(--panel-space-16);
  }

  .panel-title {
    font-size: 2.25rem;
  }
}

@media (prefers-reduced-motion: reduce) {
  [data-panel-theme="editorial"] {
    --panel-duration: 0ms;
  }
}
```

**Kontrast kararı:** Sanat raporundaki `#73796F` yerine yardımcı metinde daha koyu `#60685F` öneriyorum. Taş rengi yüzey ayırıcılarında kullanılmalı; form sınırının anlaşılması için daha belirgin `panel-control` kullanılmalı. Son renk eşleşmeleri uygulama sırasında ölçülmeli.

### Tipografi kullanımı

| Öğe | Font / boyut / ağırlık |
|---|---|
| Sayfa başlığı | Lora, mobil 28px / masaüstü 36px, 500 |
| Bölüm başlığı | Lora, 20px, 500 |
| İlan başlığı | Inter, 16px, 600 |
| Dolu fiyat | Inter, 24px, 600, tabular rakam |
| Eksik fiyat | Inter, 14px, 400, muted |
| Gövde | Inter, 14px / 1.6 |
| Form kontrolü | Inter, 16px |
| Alan etiketi | Inter, 13px, 500 |
| Rozet ve kısa metadata | Inter, 12px, 500 |

Form etiketlerinde mevcut tamamı büyük harf ve geniş harf aralığı kaldırılmalı.

## 3. Font yükleme

Projede zaten `next/font/google` kullanıldığı için aynı yöntem sürdürülmeli. Yerel Next font kılavuzu da okundu.

**Lora yalnızca agent segmentine eklenmeli.** Inter kök layout’ta zaten tanımlı; tekrar yüklenmemeli.

`web/src/app/agent/layout.tsx` için öneri:

```tsx
import type { ReactNode } from "react";
import { Lora } from "next/font/google";
import { AppShell } from "@/components/app-shell/app-shell";

const lora = Lora({
  variable: "--font-lora",
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600"],
  style: "normal",
  display: "swap",
});

export const instant = false;

export default function AgentLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div
      data-panel-theme="editorial"
      className={`${lora.variable} flex min-h-dvh flex-1 flex-col`}
    >
      <AppShell appearance="editorial">{children}</AppShell>
    </div>
  );
}
```

Buradaki `appearance`, `AppShell` ve `AppHeader` için önerilen yeni, isteğe bağlı sunum prop’udur.

- Türkçe karakterler için `latin-ext` korunmalı.
- Kök layout’taki mevcut fontlar bu iş kapsamında silinmemeli.
- Google font indirmesine izin vermeyen build ortamı varsa lisanslı yerel WOFF2 dosyaları ve `next/font/local` kullanılmalı; bu ikinci seçenek ayrıca gerçek font dosyaları gerektirir.
- Kabul örneği: **“İstanbul, Çeşme, Şişli, Iğdır, Üsküdar”** başlık ve form metinlerinde aynı font ailesinden görünmeli.

## 4. Dosya dosya değişiklik planı

### A. Uygulama kabuğu ve header

**`web/src/components/app-shell/app-shell.tsx`**

- İsteğe bağlı `appearance` prop’u ekle; varsayılan mevcut görünüm.
- Editorial görünümde `min-h-dvh`, krem zemin ve Inter uygula.
- Askıya alınmış hesap mesajını aynı tema ile biçimlendir.
- Kullanıcı sorgusu, `showProfile`, askıya alma koşulu ve children render koşulu aynen kalsın.
- Header’a yalnızca görünüm prop’u geçir; yeni sorgu ekleme.

**`web/src/components/app-shell/app-header.tsx`**

Önerilen kompozisyon:

- **Masaüstü:** Marka solda, mevcut dört gezinme bağlantısı ortada, hesap sağda.
- **Mobil:** Birinci satır marka ve hesap; ikinci satır dört eşit gezinme alanı.
- Krem yüzey, taş alt çizgi, mürekkep metin.
- Aktif sayfada terakota alt çizgi + kalın yazı + mevcut `aria-current`.
- Header içeriği sayfanın `1120px` dış genişliğiyle hizalansın.
- Marka Lora; gezinme ve hesap Inter.
- Hesap tetikleyicisi en az `44 × 44px`.
- Menü genişliği: `min(16rem, calc(100vw - 2rem))`.
- Uzun hesap adı menüyü veya üst satırı genişletmesin.

**Korunacaklar:** Mevcut bağlantılar, `homeHref`, admin’in özel sections desteği, profil görünürlüğü, çıkış formu, Escape/ok tuşları/odak davranışı.

Bildirim zili dashboard başlığında kalmalı. Header’a taşımak için veri sahipliğini değiştirmek bu tasarım işine gereksiz kapsam ekler.

### B. Dashboard

**`web/src/app/agent/dashboard/page.tsx`**

Mevcut `280px` sabit sol filtre sütunu kaldırılmalı. Önerilen DOM ve görsel sıra:

1. Sayfa başlığı, açıklama, abonelik rozeti.
2. Bildirim kontrolleri.
3. Mevcut başarı/erişim/hata mesajları.
4. Sonuç özeti ve filtre açma kontrolü.
5. Aktif filtre kapsülleri.
6. Açılır filtre paneli.
7. Günlük kullanım/kota bilgisi.
8. İlan listesi veya ilgili boş durum.

**Sonuç özeti:**

- Başlangıç metni: **“Bu sayfada 8 ilan gösteriliyor”**.
- `feed.items.length`, toplam sonuç sayısı olarak sunulmamalı.
- Kilitli kartlar varsa görünür listedeki açık/kilitli sayıları ayrıca hesaplanabilir.
- Hata halinde **“0 ilan”** yazılmamalı; sonuç yüklenemedi durumu gösterilmeli.
- Yeni toplam sayım sorgusu eklenmemeli.

**Kota:**

- Sonuç sayısından ayrı, sakin bir bilgi satırı olmalı.
- Mevcut `openToday` ve `limit` değerlerini kullanmalı.
- Metin, alanın gerçekten günlük açılmış ilan sayısını temsil ettiği mevcut sözleşmeyle doğrulanarak **“Bugün açılan ilan: 0 / 10”** biçiminde netleştirilmeli.
- Kotayı temsil etmeyen doluluk yüzdesi veya “kalan ilan” hesabı icat edilmemeli.
- Mevcut plan yükseltme koşulu korunmalı.

**İlan yerleşimi:**

```tsx
<ul className="grid grid-cols-1 gap-4 md:grid-cols-2">
  {/* Mevcut items.map ve ListingCard kullanımı korunur. */}
</ul>
```

1280px’te iki geniş kart sütunu, mevcut dar üçlü kartlardan daha okunabilir olur. Tek ilan varsa kart bir sütunda kalmalı; ekranı doldurmak için aşırı büyütülmemeli.

### C. Filtreleri açılır panel yapmak

**Yeni: `web/src/app/agent/dashboard/filter-panel.tsx`**

İlk uygulama için native `<details>` öneriyorum. Drawer, overlay veya yeni modal bağımlılığı gerektirmez; JavaScript olmadan açılıp kapanabilir.

```tsx
<details className="panel-surface group">
  <summary className="flex min-h-11 cursor-pointer items-center gap-2 px-4 py-3">
    <span className="font-medium">Filtrele</span>
    <span className="text-panel-muted">
      {activeCount > 0 ? `(${activeCount} etkin)` : ""}
    </span>
    {/* Dekoratif aç/kapa ikonu */}
  </summary>

  <div className="border-t border-panel-line p-4 md:p-6">
    {children}
  </div>
</details>
```

- İlk yüklemede kapalı.
- Aktif filtreler dışarıda görünür; panelin kapalı olması uygulanmış filtreyi gizlemez.
- Panel başlığı ile içerikteki ilk alan arasında 16px.
- Filtre açıkken sonuçların aşağı itilmesi, kullanıcının bilinçli açma eyleminin sonucu olur.

**`web/src/app/agent/dashboard/feed-filters.tsx`**

- GET formu ve mevcut alan adları korunmalı.
- Dış form: mobil tek sütun, masaüstü üç sütun.
- Fiyat aralığı mobil 320px’te alt alta; yeterli genişlikte yan yana.
- Alanlar `min-width: 0`, tam genişlik, en az 44px yükseklik.
- Kontrol metni 16px, etiket 13px.
- `dropEmptyFields` davranışı korunmalı.
- İl/ilçe seçeneklerini veya sorgulama zamanını değiştiren otomatik submit eklenmemeli.
- “Uygula” birincil; “Sıfırla” ikincil metin eylemi.
- URL’den gelen filtre değişikliklerinde uncontrolled alanların eski değer göstermemesi için form, normalize filtre anahtarıyla yeniden kurulmalı veya eşdeğer kontrollü senkronizasyon yapılmalı.

### D. Aktif filtre kapsülleri

**Yeni: `web/src/app/agent/dashboard/active-filters.tsx`**

Sunucu tarafında render edilebilen sade bir bileşen yeterli.

Örnekler:

- `İl: İstanbul ×`
- `İlçe: Kadıköy ×`
- `Oda: 3+1 ×`
- `En düşük: 2.000.000 TRY ×`
- `Kapsam: Kendi gruplarım ×`
- `Tümünü temizle`

Kurallar:

- Kapsüller ham query’den değil, **normalize edilmiş `filters` değerlerinden** üretilmeli.
- Kaldırma işlemi mevcut URL parametre adlarıyla link üretmeli.
- Bir filtre kaldırıldığında diğerleri korunmalı; sayfa `1`’e dönmeli.
- İl kaldırıldığında bağımlı ilçe de kaldırılmalı.
- Uzun grup adları satır kırabilmeli.
- Görsel kapsül küçük olsa da tıklama alanı en az 44px yüksekliğinde olmalı.
- Erişilebilir ad: **“İstanbul il filtresini kaldır”**.
- Yeni filtre veya sıralama parametresi eklenmemeli.

### E. İlan kartı

**`web/src/app/agent/dashboard/listing-card.tsx`**

Kart yapısı:

1. Görsel/placeholder alanı.
2. Kaynak veya kişisel grup rozeti.
3. Başlık.
4. Fiyat.
5. Oda ve metrekare bilgileri.
6. Alt çizgi altında konum ve geliş zamanı.

**Görsel kararı:** Mevcut kart render’ında fotoğraf alanı kullanılmıyor. Bu kapsamda tüm açık kartlarda dürüst bir **mimari placeholder** kullanılmalı.

**Yeni:** `web/public/illustrations/property-placeholder.svg`

- Taş zemin, mürekkep ince çizgiler, küçük terakota detay.
- Genel bina/cephe çizimi.
- Gerçek mülk fotoğrafı izlenimi vermemeli.
- Kartta “Görsel bulunmuyor” açıklaması.
- Dekoratif SVG için boş alternatif metin; açıklama görünür metinde.
- Yeni görsel URL alanı, API sorgusu veya `remotePatterns` gerektirmemeli.

**Yerleşim:**

- 320px’te üstte yaklaşık `16:9` placeholder, altta içerik.
- Yeterli kart genişliğinde solda `120 × 96px` placeholder, sağda içerik.
- Yatay düzene geçiş yalnız viewport’a değil gerçek kart genişliğine göre yapılmalı; gerekirse CSS container query kullanılmalı.
- İç dolgu mobil 16px, masaüstü 20px.
- Kart üstünde ince terakota imza çizgisi.
- Bilgi grupları arasında 12–16px; metadata öncesinde belirgin boşluk.

**Fiyat:**

```tsx
<p
  className={
    listing.price === null
      ? "text-panel-body font-normal text-panel-muted"
      : "text-panel-price font-semibold text-panel-ink tabular-nums"
  }
>
  {formatPrice(listing.price, listing.currency)}
</p>
```

`price === null` kontrolü kullanılmalı; `0` fiyat yanlışlıkla eksik kabul edilmemeli.

**Eksik veri:**

- `Başlıksız ilan` sade, nötr ağırlıkta kalmalı.
- Fiyat yoksa en büyük metin olmamalı.
- Konum ve kaynak için mevcut formatter metinleri korunabilir; tasarım bütünlüğüyle daha sakin sunulmalı.
- Eksik oda/metrekare yerine sahte değer veya `0 m²` yazılmamalı.
- Uzun başlıklar iki satırla sınırlandırılabilir; kritik fiyat kesilmemeli.
- Kaynak adı tooltip’e bağımlı olmadan okunabilir olmalı.

**Eylem:** Mevcut açık kartta detay bağlantısı yok. Bu işte çalışmayan **“İlanı incele”** düğmesi eklenmemeli. Kartın tamamı tıklanabilir gibi gösterilmemeli.

**Kilitli kart:** Ayrı dal korunmalı. Yalnız izinli konum/zaman, kilit açıklaması ve mevcut `/pricing` bağlantısı gösterilmeli. Gizli başlık/fiyat gerçek veriyle blur yapılmamalı; DOM’a, erişilebilir ada veya görsel açıklamasına taşınmamalı.

### F. WhatsApp sayfası

**`web/src/app/agent/whatsapp/page.tsx`**

- Dashboard ile aynı container ve tam ekran krem zemin.
- Başlık: **“WhatsApp bağlantısı”**.
- Kısa açıklama: **“İlan okunacak grupları bağlantı kurduktan sonra seçebilirsiniz.”**
- “Panele dön” bağlantısı ikincil gezinme olarak korunabilir.
- İçerik, dar `max-w-xl` sınırına tekrar tekrar sıkıştırılmamalı.
- Feature flag, auth, consent ve ilk durum yükleme kodları değişmemeli.

**`web/src/app/agent/whatsapp/wa-panel.tsx`**

Üç aşamalı görünür süreç:

1. **Riski incele ve onayla**
2. **QR kodla bağlan**
3. **Grupları seç**

Adımlar mevcut durumdan türetilmeli; yeni bir bağlantı state machine kurulmasın.

#### Durum rozeti ve tek ana eylem

| Mevcut durum | Görünür durum | Ana eylem |
|---|---|---|
| Onay yok | Risk onayı gerekli | Onay kutusundan sonra “Riski onayla” |
| Onay var, `none` | Bağlı değil | “Bağlantıyı başlat” |
| `pending` | QR hazırlanıyor | Yeni bağlantı eylemi yok; bekleme açıklaması |
| `qr` | QR okutmanız bekleniyor | Telefon talimatı; yeni bağlantı düğmesi yok |
| `connected` | Bağlı | Grup bölümünde “Seçimi kaydet” |
| `disconnecting` | Bağlantı kaldırılıyor | İşlem sürüyor bilgisi |
| `error` / `disconnected` / `logged_out` | Mevcut hata açıklaması | İlgili mevcut yeniden deneme eylemi |

**Onay ve bağlantı ayrı sunucu işlemleri olarak kalmalı.** “Riski onayla” başarılı olduktan sonra “Bağlantıyı başlat” gösterilir. Otomatik bağlanma eklenmemeli. Aynı anda iki ana düğme gösterilmemeli.

Hata dalında retry varken normal connect düğmesi tekrar render edilmemeli.

#### Risk kartı

Üç taranabilir bilgi:

- **Hesap riski:** Resmî olmayan bağlantılar kısıtlanabilir; numara kapatılabilir.
- **Okunan içerik:** Yalnız seçilen gruplardaki ilanlar.
- **Gönderim:** Sistem numaradan mesaj göndermez.

Mevcut `CONSENT_TEXT`, kabul etiketi ve `WA_CONSENT_VERSION` korunmalı. Görsel başlıklar ve maddeleme eklenebilir; uyarının anlamı hafifletilmemeli.

- Sol terakota/uyarı çizgisi, açık sıcak zemin.
- Checkbox en az 20px.
- Tüm etiket satırı tıklanabilir ve en az 44px yüksekliğinde.
- Devre dışı düğmenin yanında “Devam etmek için risk onayını işaretleyin.”
- Kabul sonrası uyarı, salt okunur “Risk bilgisi” ayrıntısında erişilebilir kalabilir.

#### QR alanı

- QR, marka rengine boyanmamalı: koyu kod, beyaz zemin.
- Mevcut `qrcode` üretimi ve güvenli kaynak korunmalı.
- QR’nin boş çevre payı kesilmemeli.
- Alan 320px’te taşmadan sığmalı; SVG en fazla kapsayıcı genişliğinde olmalı.
- QR hazırlanırken aynı alanda sakin bir yer tutucu.
- Telefon talimatı kodun hemen yanında/altında.
- Mevcut backend durumunda olmayan süre veya sahte geri sayım gösterilmemeli.
- Mobilde kodun **bağlanacak telefondan okutulacağı** açık yazılmalı; desteklenmeyen telefon kodu eşleştirme seçeneği eklenmemeli.

#### Bağlantıyı kaldırma

- Bağlı durumda ana eylemden ayrılmış ikincil/tehlikeli işlem.
- Mevcut inline dialog yerine ortak `ConfirmDialog` kullanımı.
- Güvenli ilk odak “Vazgeç”; Escape ve Tab yönetimi korunmalı.
- Kapanınca odak kaldırma düğmesine dönmeli.
- Mevcut disconnect action, timeout ve polling sonlandırma kuralları değişmemeli.

### G. Grup seçimi

**`web/src/app/agent/whatsapp/group-picker.tsx`**

- Aynı yüzey, tipografi ve checkbox standardı.
- `selected.size / initial.max` bilgisi: **“3 / 20 grup seçildi”**; üst sınır prop’tan gelmeli.
- Kaydedilmemiş seçim sayısı, “okunan grup sayısı” diye sunulmamalı.
- Seçilen satırda sıcak yüzey, belirgin checkbox.
- Her satır en az 44px; uzun grup adı kırılmalı.
- Kaydetme, salt okunur ve limit koşulları korunmalı.
- Senkronizasyon sürüyor ile gerçekten boş grup listesi farklı görünmeli.
- Sıfır seçim başarı mesajındaki **“Hiçbir grup okunmuyor”** bilgisi korunmalı.
- Bu iş kapsamında otomatik kaydetme veya grup araması eklenmemeli.

### H. Buton, rozet, ikon ve bildirim standardı

**`web/src/components/ui/button.tsx`**

Mevcut props ve pending davranışına dokunmadan isteğe bağlı editorial görünüm eklenmeli:

```tsx
const editorialBase =
  "min-h-11 rounded-panel-control px-[18px] py-2 " +
  "text-sm font-semibold transition-colors " +
  "disabled:cursor-not-allowed";

const editorialVariants = {
  primary:
    "bg-panel-accent text-white hover:bg-panel-accent-hover",
  secondary:
    "border border-panel-control bg-panel-surface " +
    "text-panel-ink hover:bg-panel-subtle",
};
```

- Minimum 44px yükseklik.
- 320px’te gerekli ana eylemler tam genişlik.
- Pending sırasında işlem tekrarlanamamalı; mevcut `aria-busy` korunmalı.
- Disabled görünüm soluk somon yerine anlaşılır nötr yüzey ve açıklama kullanmalı.
- Gezinen linklere `<button>` semantiği verilmemeli; aynı stil paylaşılabilir.

**Yeni: `web/src/components/ui/status-badge.tsx`**

- `neutral`, `success`, `warning`, `danger` tonları.
- 12px yazı, `6px 9px` dolgu, pill radius.
- Durum noktası dekoratif; yanında metin zorunlu.
- Abonelik ve WhatsApp durumları aynı bileşeni kullanmalı.
- Badge tıklanabilir değilse buton gibi hover almamalı.

**İkon standardı**

- 20px, `strokeWidth={1.75}`, yuvarlak uçlar.
- En az 44px tıklama alanı.
- Az sayıdaki ikon için mevcut inline SVG yaklaşımı yeterli; ikon paketi eklemek gerekmiyor.
- Dekoratif ikon `aria-hidden`; yalnız ikon düğmesinde erişilebilir ad zorunlu.

**`notification-bell.tsx` ve `push-toggle.tsx`**

Yalnız görünüm düzenlenmeli. Sayım, görüldü kaydı, polling, izin isteme ve service worker işlemleri korunmalı.

**`alert.tsx` ve `confirm-dialog.tsx`**

Editorial görünüm seçeneği eklenmeli; mevcut çağıranların varsayılan görünümü korunmalı. `alert`/`status` rolleri değiştirilmemeli. Portal kullanılırsa tema tokenları portal köküne de taşınmalı.

### I. Boş, yüklenen ve erişim durumları

**Dashboard `page.tsx`:**

| Durum | Sunum |
|---|---|
| Filtre sonucu boş | “Filtrelere uyan ilan bulunamadı” + mevcut filtreleri temizleme |
| Filtresiz liste boş | “Henüz gösterilecek ilan yok” + gruplardan gelen ilanların burada görüneceği açıklaması |
| İlan yükleme hatası | Hata bildirimi + parametreleri koruyan mevcut tekrar dene linki |
| Abonelik erişimi yok | Mevcut abonelik açıklaması ve bağlantısı |
| Abonelik durumu okunamadı | Veri okuma sorunu görünür kalmalı; kullanıcı kesin aboneliksizmiş gibi sunulmamalı |
| Askıya alınmış hesap | Mevcut engel ekranı ve açıklaması |

Bağlantı durumu dashboard’da yüklenmediği için boş listeyi otomatik olarak **“WhatsApp bağlı değil”** diye açıklamak yanlış olur.

**`web/src/app/agent/loading.tsx`**

Yeni **`dashboard/feed-skeleton.tsx`** gibi agent’a ait bir iskelet çağırmalı. Paylaşılan admin iskeleti değiştirilmeden bırakılabilir.

İskelet: başlık, sonuç araç çubuğu, iki kart. `role="status"`, `aria-busy` ve reduced-motion desteği korunmalı.

## 5. 320px ve 1280px yerleşim kuralları

| Öğe | 320px mobil | 1280px masaüstü |
|---|---|---|
| Ana kapsayıcı | 16px yan boşluk, 288px kullanılabilir alan | Dış genişlik 1120px, ortalanmış; 32px iç yan dolgu |
| Header | Marka/hesap satırı + dört gezinme alanı | Tek yatay satır |
| Sayfa başlığı | 28px | 36px |
| Ana bölüm aralığı | 24px | 32px |
| Sonuç araç çubuğu | Gerektiğinde iki satır | Özet solda, filtre kontrolü sağda |
| Filtreler | Başlangıçta kapalı, tek sütun | Başlangıçta kapalı, açıldığında üç sütun |
| Aktif filtreler | Satır kırar | Satır kırar |
| İlanlar | Tek sütun | İki sütun |
| Kart görseli | Üstte 16:9 placeholder | Yeterli kart genişliğinde 120×96px |
| WhatsApp | Durum → adımlar → risk/QR → gruplar | Yaklaşık `minmax(0,1fr) 320px` iki sütun; gruplar altta |
| Ana düğme | Gerekli alanlarda tam genişlik | İçeriğe göre genişlik |
| Kontroller | En az 44px, 16px alan metni | En az 44px |

Ek kurallar:

- `min-width: 0` grid/flex çocuklarında açıkça uygulanmalı.
- Yatay taşma `overflow-x: hidden` ile örtülmemeli.
- Fiyat, QR, uzun grup adı ve hesap e-postası ayrı ayrı zorlanmalı.
- Görsel sıra ile DOM sırası aynı kalmalı.
- Mobilde filtre kapalıyken sonuç özeti ve ilk kartın başlangıcı ilk 800px yüksekliğe sığması hedeflenmeli; erişim/hata mesajları gerektiğinde öncelik almalı.
- Header ilk sürümde sticky yapılmamalı; 320px’te iki satırlı başlığın içerik alanını sürekli daraltması önlenmeli.
- 768px ara genişlikte de düzen doğrulanmalı; yalnız iki uç genişliğe göre tasarlanmamalı.

## 6. İş mantığına ve API’ye dokunmama sınırları

**Bu işin değişiklik alanı:** JSX düzeni, CSS/tokenlar, sunum bileşenleri, filtre paneli açıklığı, mevcut query parametrelerinden üretilen kaldırma bağlantıları ve erişilebilirlik.

**Değiştirilmeyecekler:**

- `dashboard/actions.ts`, `push-actions.ts`, `whatsapp/actions.ts`.
- `src/lib/listings-feed/` sorgu, parse, erişim ve kota kuralları.
- `src/lib/whatsapp/` durum ve grup sözleşmeleri.
- Supabase sorguları, RPC’ler, RLS, migration, API route’ları.
- Deneme başlatma ve abonelik kontrolü.
- `instant = false`, mevcut istek zamanı işaretlemeleri.
- WhatsApp feature flag.
- Consent sürümü, action sırası, polling süreleri ve sınırları.
- Grup seçim limiti ve salt okunur koşulları.
- Kilitli/açık veri ayrımı.
- Bildirim izninin kullanıcı eylemiyle istenmesi.

### Başlıca riskler ve karşılıkları

| Risk | Önlem |
|---|---|
| Ortak token değişikliği diğer ekranları bozar | Ayrı `panel-*` tokenları ve isteğe bağlı appearance |
| Birleşik WhatsApp düğmesi işlem sırasını değiştirir | Onay ve connect ayrı kalır; aşama başına tek CTA |
| Filtre kaldırma diğer parametreleri kaybettirir | Normalize filtrelerden URL üret, bağımlılık ve sayfayı açık yönet |
| Kapalı filtre eski form değeri gösterir | URL değişiminde form değerlerini yeniden senkronize et |
| Kilitli veri görsel veya DOM üzerinden sızar | Ayrı render dalını koru; yalnız izinli alanlar |
| Fotoğraf beklentisi API kapsamını büyütür | Bu sürümde dürüst statik mimari placeholder |
| Sonuç/kota metni yanlış anlam yaratır | Sayfa adedini toplamdan ayır; kota sözleşmesini koru |
| Ortak dialog yeni görünümü alamaz | Appearance ve gerekiyorsa portal tema kapsamı |
| “1 Issue” rozeti CSS ile gizlenir | Üretim build’inde ekran al; alttaki uyarıyı ayrıca incele |

`next.config.ts` tasarım için değiştirilmemeli. Geliştirme göstergesini CSS ile gizlemek, gerçek geliştirme hatasını çözmez.

## 7. Uygulama sırası

1. **Mevcut davranışı sabitle:** Dashboard ve WhatsApp’ın mevcut testlerini çalıştır; erişim, kilitli veri ve consent akışını başlangıç referansı olarak kaydet.
2. **Token ve fontları ekle:** `globals.css`, agent Lora yüklemesi, scoped tema.
3. **Ortak kabuğu düzenle:** `AppShell`/`AppHeader` editorial görünümü; hesap/admin varsayılanlarının korunması.
4. **Kontrol standardını kur:** Button, badge, alert ve dialog görünümü.
5. **Dashboard hiyerarşisini değiştir:** Sonuç özeti üstte, sabit yan filtre yerine açılır panel.
6. **Aktif filtreleri ekle:** Kaldırma, sıfırlama, il/ilçe bağımlılığı ve form senkronizasyonu.
7. **İlan kartlarını düzenle:** Placeholder, fiyat/eksik veri ayrımı, kilitli kart.
8. **WhatsApp sunumunu düzenle:** Durum rozeti, üç aşama, risk kartı, tek ana eylem.
9. **QR, grup seçimi ve kaldırma dialogunu tamamla.**
10. **Boş/hata/yükleme durumlarını aynı dile getir.**
11. **Davranış testleri, build ve çoklu genişlik görsel kontrolünü yap.**
12. **Yalnız kanıtlanan sorunları düzelt; son ekranları üretim modunda karşılaştır.**

### Doğrulama kontrol listesi

**Kod ve davranış**

- [ ] `web/` içinde `npm run lint`, `npx tsc --noEmit`, `npm test`, `npm run build` başarılı.
- [ ] Mevcut header, filtre, kart, dashboard, WhatsApp panel ve grup seçimi testleri geçiyor.
- [ ] Filtre GET alan adları ve boş alan temizleme davranışı aynı.
- [ ] Kapsül kaldırma diğer filtreleri koruyor; il kaldırılınca ilçe temizleniyor.
- [ ] URL navigasyonu sonrası form doğru uygulanmış değerleri gösteriyor.
- [ ] Filtreyi yalnız açmak/kapamak ağ isteği veya action oluşturmuyor.
- [ ] Onay kaydı başarılı olmadan bağlantı başlatılmıyor.
- [ ] Her WhatsApp aşamasında en fazla bir ana eylem var.
- [ ] Polling, timeout, retry, grup limiti ve kaldırma akışı aynı çalışıyor.
- [ ] Kilitli kart testlerinde başlık/fiyat/alan bilgisi DOM’da bulunmuyor.
- [ ] Yeni API, sorgu, migration veya bağımlılık eklenmemiş.

**Görsel ve erişilebilirlik**

- [ ] Dashboard ve WhatsApp: `320×800`, `768×1024`, `1280×900`.
- [ ] Yatay taşma, örtüşme ve kesilmiş kontrol yok.
- [ ] Mobilde filtre kapalıyken ilanlar formun altında kaybolmuyor.
- [ ] Sayfa zemini ekran boyunca krem.
- [ ] Lora/Inter ve Türkçe karakterler doğru yükleniyor.
- [ ] Normal metin kontrastı en az 4,5:1; kontrol sınırları ve odak belirgin.
- [ ] Tüm etkileşimler klavyeyle kullanılabiliyor; hedefler en az 44px.
- [ ] Hesap menüsü ve kaldırma dialogunda odak yönetimi doğru.
- [ ] Durumlar yalnız renkle anlatılmıyor.
- [ ] QR 320px’te taşmıyor ve gerçek telefonla okunabiliyor.
- [ ] Eksik fiyat, eksik başlık, çok uzun fiyat/grup adı ve tamamen boş liste denenmiş.
- [ ] Hata, erişim yok ve boş sonuç birbirinden ayrılıyor.
- [ ] Tanıtım, hesap ve admin ekranlarında ortak bileşen regresyonu yok.
- [ ] Son ekran görüntüleri `next build` + `next start` ortamından alınmış.

**Tamamlanma ölçütü:** Kullanıcı dashboard’da önce sonuçları görür; filtreleri gerektiğinde açar. WhatsApp ekranında mevcut durumu, kabul ettiği riski ve sıradaki tek eylemi anlayabilir. Bu iyileşmeler mevcut veri ve işlem sözleşmeleri korunarak sağlanır.