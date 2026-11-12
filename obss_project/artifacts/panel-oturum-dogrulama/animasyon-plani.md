Kodu okudum; dosya değiştirmedim. Önerim: **“Ağırbaşlı, kısa ve dokunsal.”** Hareket; ilanları okumayı kolaylaştırmalı, filtre işlemini doğrulamalı ve WhatsApp bağlantısının hangi aşamada olduğunu anlatmalı.

Mevcut kodla ilgili üç önemli bulgu:

- `listing-card.tsx` ve `feed-filters.tsx`, `agent/dashboard/` altında. Dashboard ve kartlar Server Component; giriş animasyonları için client bileşene dönüştürmek gerekmiyor.
- Görsellerdeki büyük mobil yer tutucu ve bulanık kilitli kart, mevcut koddan farklı. Kod artık küçük mimari yer tutucu ve açıkça belirtilmiş kilit durumu kullanıyor. Planı mevcut koda göre hazırladım.
- WhatsApp paneli iki saniyede bir durum sorguluyor; hesap menüsü `{open && …}` ile eklenip kaldırılıyor. Animasyonları her sorguda yeniden başlatmamak ve kapanış animasyonunu ayrıca ele almak gerekiyor.

**1. Motion kimliği**

Hareket karakteri: iyi basılmış bir emlak dergisinin sayfaları gibi; küçük mesafeler, yumuşak duruş, kesin geri bildirim.

- Dikey hareket: masaüstünde en fazla **8 px**, mobilde **4 px**.
- Hover yükselmesi: **2 px**.
- Yaylanma, overshoot ve elastik easing kullanılmaz.
- İçerik hiçbir zaman animasyonun bitmesini beklemez; bağlantılar ve kontroller hemen çalışır.

`globals.css` içinde mevcut editorial kapsamına eklenebilecek token’lar:

```css
[data-panel-theme="editorial"] {
  --motion-fast: 120ms;
  --motion-ui: 180ms;
  --motion-panel: 240ms;
  --motion-enter: 320ms;
  --motion-step: 40ms;

  --ease-settle: cubic-bezier(.22, 1, .36, 1);
  --ease-ui: cubic-bezier(.2, 0, .2, 1);

  --motion-rise: 8px;
}

@media (max-width: 767px) {
  [data-panel-theme="editorial"] {
    --motion-rise: 4px;
    --motion-step: 24ms;
  }
}
```

**2. Sayfa girişi**

Üç katman yeterli; rozet, başlık ve açıklamayı ayrı ayrı dans ettirmeyin.

| Katman | Başlangıç | Süre | Hareket |
|---|---:|---:|---|
| Başlık grubu | 0 ms | 320 ms | Opacity + 8/4 px yükselme |
| Sonuç özeti ve filtre alanı | 40 ms | 240 ms | Opacity + 4 px |
| Kartlar | 80 ms + sıra × 40 ms | 320 ms | Opacity + 8/4 px |

Mobilde kartların başlangıcı `48 ms + sıra × 24 ms` olabilir. Stagger yalnızca ilk **altı kartta** uygulanmalı; sonraki kartlar gecikmesiz görünmeli.

Filtre güncellemesinde bütün başlığı tekrar oynatmayın. Yalnızca sonuç alanı kısa bir fade ile güncellensin. CSS animasyonu DOM’a eklenince çalışır; server render tek başına “her navigasyonda yeniden oynar” garantisi vermez. Yeniden oynatmayı gerekiyorsa yalnızca sonuç listesi düzeyinde yönetin.

**3. İlan kartı**

Mevcut açık kartlarda etkileşimli bağlantı yok. Bu nedenle bütün karta hover yükselmesi vermek, tıklanabilirlik beklentisi yaratır.

- **Mevcut yapı:** kart sabit; içinde gerçek bir kontrol varsa `focus-within` ile sınır vurgusu.
- **İlan detay bağlantısı eklendiğinde:** hover destekleyen cihazlarda `translateY(-2px)`, 180 ms.
- Gölge: mevcut `%5` gölgeden `%9` düzeyine; geniş, sakin.
- Terakota üst çizgi mevcut **2 px** kalınlığını korur. Hover sırasında kalınlık değiştirilmez; yerleşim oynamaz.
- Klavye odağı hemen görünür; outline’a gecikme verilmez.
- Kilitli kartta yükselme yok; “Planı yükselt” bağlantısı kendi geri bildirimini verir.

**Yeni ilan:** sürekli nabız yerine, ilk kez gösterildiğinde **900 ms tek seferlik sıcak yüzey vurgusu** ve kalıcı küçük “Yeni” etiketi. “Kendi grubun” rozeti yeni ilan anlamına gelmez.

Mevcut `ListingCard` çağrısına yenilik bilgisi aktarılmıyor. Bunu `created_at` üzerinden keyfî bir süreyle üretmek yerine mevcut `listings_seen_at` mantığıyla uyumlu `isNew` verisiyle belirleyin. Filtre değişiminde ve sayfa yenilemede aynı ilan tekrar parlamamalı.

**4. Filtre paneli ve kapsüller**

`<details>` semantiğini koruyun.

- Chevron: **180 ms**, 0 → 180°.
- Açılma/kapanma: **240 ms**, doğal içerik yüksekliği.
- Açılırken içerik 0 → 1 opacity; alanların tek tek stagger’ı yok.
- `max-height: 1000px` çözümünden kaçının; süreyi içerik yüksekliğine göre tutarsızlaştırır.
- Modern CSS desteğinde `::details-content` ile iki yönlü geçiş; desteklenmeyen tarayıcıda anında açılıp kapanma kabul edilebilir.

Aktif kapsüller:

- Ekleme: **160 ms**, opacity ve 4 px yükselme.
- Hover: arka plan/sınır rengi **120 ms**; × işareti dönmez.
- Kaldırma: bağlantı navigasyonu **hemen** başlar. Çıkış animasyonu uğruna filtre işlemi geciktirilmez.
- Gerçek çıkış animasyonu istenirse küçük bir client kapsül listesi gerekir: 100 ms opacity çıkışı, navigasyonla eşzamanlı; sunucu yanıtı esas alınır.
- Kaldırılan kapsülde odak varsa güncellemeden sonra sonraki kapsüle, kapsül kalmadıysa “Filtrele” özetine taşınır.

**5. WhatsApp akışı**

Burada hareket dekorasyondan çok durum anlatımıdır.

| Olay | Öneri |
|---|---|
| Risk kutusu işaretlenir | Native checkbox korunur; butonun etkin renklerine geçişi 120 ms |
| Onay kaydedilir | Başarılı sunucu yanıtından sonra sonraki içerik 240 ms / 4 px ile görünür |
| `pending` | Sabit boyutlu gösterge + “Bağlantı hazırlanıyor” |
| QR hazır | Hazır SVG 180 ms opacity ile görünür |
| QR yenilenir | Eski QR hemen kaldırılır; yeni kod hazır olunca gösterilir |
| `connected` | Yeşil onay işareti bir kez çizilir, 320 ms |
| Gruplar bekleniyor | Ayrı “Gruplar getiriliyor” durumu; bağlantı başarısı görünür kalır |
| Hata / süre dolması | Sabit hata metni; shake veya kırmızı flaş yok |

QR kodun kendisine scale, blur, tarama çizgisi veya pulse uygulamayın. Tarama sırasında sabit ve keskin kalmalı. QR alanının ölçüsünü önceden ayırın; kod geldiğinde metin aşağı sıçramasın.

Adım animasyonunun anahtarı ham yanıt nesnesi veya QR içeriği olmamalı:

```tsx
const motionPhase = !consent
  ? "consent"
  : status.status === "connected"
    ? "groups"
    : "connect";
```

Yalnızca ilgili içerik gövdesini `key={motionPhase}` ile değiştirin; bütün paneli veya `GroupPicker`ı animasyon için yeniden kurmayın.

“Bağlandı” kutlaması yalnızca bu oturumdaki gerçek `pending/qr → connected` geçişinde çalışsın. Sayfa zaten bağlı açıldığında ve `router.refresh()` sonrasında tekrar kutlama yapılmasın. Mevcut `lastStatusRef` yenileme mantığı korunmalı; kutlama için ayrı geçiş takibi kullanın.

Mevcut `aria-live="polite"` alanında durum metni duyurulsun. Animasyonlu simgeler `aria-hidden` olmalı; her poll sonucu yeniden duyurulmamalı.

**6. Header, hesap menüsü ve bildirim**

**Aktif sekme**

Mevcut `aria-current="page"` doğru temel.

- Metin ve yüzey rengi: **120 ms**.
- Yeni aktif sekmenin terakota çizgisi: soldan `scaleX(0 → 1)`, **180 ms**.
- Sekmeler arasında kayan ortak gösterge gereksiz; mobilde iki satırlı header yapısında ölçüm ve sıçrama riski getirir.
- Mevcut aktif `font-semibold`, yazı genişliğini değiştirebilir. Alanları sabit tutun veya tüm sekmelerde aynı font ağırlığını kullanın.

**Hesap menüsü**

- Sağ üst köşe kaynaklı, **160 ms**, opacity + `translateY(-4px)`.
- Kapanış: **100 ms** fade isteğe bağlı.
- Mevcut `{open && …}` yapısına yalnızca transition eklemek kapanışı oynatmaz.
- İlk sürümde giriş animasyonu + anında kapanış yeterli. İki yönlü sürümde küçük bir “DOM’da tutuluyor / açık” ayrımı gerekir; kapanan menü anında `inert` olmalı.
- Mevcut ilk öğeye odaklanma, Escape, ok tuşları ve odağı tetikleyiciye döndürme davranışları korunmalı.

**Bildirim zili**

Zil header’da değil, `dashboard/notification-bell.tsx` içinde.

- Sayaç gerçekten arttığında: ikon **320 ms**, ±6° tek salınım.
- Rozet: **160 ms** opacity girişi.
- İlk yüklemede mevcut sayı için zil çalmasın.
- Her 60 saniyelik sorguda animasyon başlamasın; yalnızca `nextCount > previousCount`.
- Sayı sıfırlanınca zil hareket etmesin.

**7. Skeleton**

Mimari yer tutucu skeleton değildir; gerçek veri eksikliği durumudur ve sabit kalmalıdır.

- Skeleton yalnızca veri beklenirken kullanılır.
- Kartın son yüksekliğine yakın alan ayrılır; fiyat, başlık ve meta satırları taklit edilir.
- Kart başına farklı ritim yerine ortak **1.6 saniyelik** yumuşak opacity döngüsü.
- Çok kısa isteklerde skeleton yanıp sönmesini azaltmak için yaklaşık **150 ms gösterim eşiği** kullanılabilir; sonuç hazırsa hemen gösterilir.
- Hata durumunda skeleton durur ve hata içeriği görünür.
- Kapsayıcıda `aria-busy`, tek bir erişilebilir “İlanlar yükleniyor” metni; dekoratif bloklarda `aria-hidden`.

Dashboard server tarafında veriyi bekliyor. Skeleton’ın gerçekten görünmesi için uygun `loading.tsx` veya `Suspense` sınırı gerekir; yalnızca CSS eklemek yükleme durumu oluşturmaz.

**8. Kaçınılacaklar ve azaltılmış hareket**

Kaçının:

- Kartlarda tilt, parallax ve fotoğraf zoom’u.
- Fiyatların sayarak yükselmesi.
- Sürekli parlayan “Yeni” rozeti.
- Risk onayını teşvik eden pulse.
- QR üzerinde hareket.
- `transition-all`.
- Sayfa genelinde kalıcı `will-change`.
- Animasyon bitene kadar tıklamayı veya navigasyonu engelleme.

`prefers-reduced-motion` açıkken giriş, stagger, yükselme, zil salınımı, spinner ve skeleton hareketleri kapatılır. Durum metinleri, renkler, odak halkaları ve kalıcı başarı simgesi korunur.

**9. Hazır CSS ve dosya bazında uygulama**

Aşağıdaki bloklar öneri olarak hazırlanmıştır; mevcut dosyalara uygulanmadı. Tailwind 4 `@utility` tanımları üst seviyede, token’lar editorial kapsamda tutulur.

```css
@keyframes panel-enter {
  from {
    opacity: 0;
    transform: translateY(var(--motion-rise));
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes panel-menu {
  from { opacity: 0; transform: translateY(-4px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes panel-new {
  from { background-color: #F4ECD9; }
  to { background-color: #FFFEFA; }
}

@keyframes panel-skeleton {
  0%, 100% { opacity: .55; }
  50% { opacity: .85; }
}

@keyframes panel-spin {
  to { transform: rotate(360deg); }
}

@keyframes panel-bell {
  0%, 100% { transform: rotate(0); }
  25% { transform: rotate(6deg); }
  65% { transform: rotate(-6deg); }
}

@keyframes panel-check {
  from { stroke-dashoffset: 1; }
  to { stroke-dashoffset: 0; }
}

@utility panel-enter {
  animation: panel-enter var(--motion-enter)
    var(--ease-settle) var(--enter-delay, 0ms) backwards;
}

@utility panel-stagger {
  --enter-delay: calc(
    80ms + var(--enter-index, 0) * var(--motion-step)
  );
}

@utility panel-menu {
  transform-origin: top right;
  animation: panel-menu 160ms var(--ease-settle) backwards;
}

@utility panel-new {
  animation: panel-new 900ms var(--ease-ui);
}

@utility panel-skeleton {
  background-color: #EAE5D9;
  animation: panel-skeleton 1600ms ease-in-out infinite;
}

@utility panel-spinner {
  animation: panel-spin 1000ms linear infinite;
}

@utility panel-bell {
  transform-origin: 50% 20%;
  animation: panel-bell 320ms var(--ease-ui);
}

@utility panel-check {
  stroke-dasharray: 1;
  stroke-dashoffset: 0;
  animation: panel-check 320ms var(--ease-settle) backwards;
}

@media (max-width: 767px) {
  [data-panel-theme="editorial"] .panel-stagger {
    --enter-delay: calc(
      48ms + var(--enter-index, 0) * var(--motion-step)
    );
  }
}
```

Kart yükselmesi yalnızca gerçekten etkileşimli kartlara:

```css
[data-panel-theme="editorial"] .panel-card {
  transition:
    transform var(--motion-ui) var(--ease-settle),
    box-shadow var(--motion-ui) var(--ease-ui),
    border-color var(--motion-fast) var(--ease-ui);
}

@media (hover: hover) and (pointer: fine) {
  [data-panel-theme="editorial"]
  .panel-card[data-interactive="true"]:hover {
    transform: translateY(-2px);
    box-shadow: 0 10px 24px rgb(38 51 45 / 9%);
  }
}

[data-panel-theme="editorial"] .panel-card:focus-within {
  border-color: var(--color-terracotta-600);
}
```

Modern `<details>` geçişi; destek yoksa native davranış devam eder:

```css
@supports (interpolate-size: allow-keywords) and
          (transition-behavior: allow-discrete) {
  [data-panel-theme="editorial"] .panel-details {
    interpolate-size: allow-keywords;
  }

  [data-panel-theme="editorial"]
  .panel-details::details-content {
    block-size: 0;
    overflow: hidden;
    opacity: 0;
    transition:
      block-size var(--motion-panel) var(--ease-ui),
      opacity var(--motion-ui) var(--ease-ui),
      content-visibility var(--motion-panel) allow-discrete;
  }

  [data-panel-theme="editorial"]
  .panel-details[open]::details-content {
    block-size: auto;
    opacity: 1;
  }
}
```

Azaltılmış hareket kuralını bu stillerden sonra koyun:

```css
@media (prefers-reduced-motion: reduce) {
  [data-panel-theme="editorial"],
  [data-panel-theme="editorial"] *,
  [data-panel-theme="editorial"] *::before,
  [data-panel-theme="editorial"] *::after,
  [data-panel-theme="editorial"] .panel-details::details-content {
    animation: none !important;
    transition: none !important;
    scroll-behavior: auto !important;
  }

  [data-panel-theme="editorial"] .panel-card {
    transform: none !important;
  }
}
```

Dosya bazında kullanım:

| Dosya | Uygulama |
|---|---|
| `globals.css` | Token’lar, keyframe ve utility’ler; editorial kapsam ve reduced-motion |
| `dashboard/page.tsx` | Başlık grubuna `panel-enter`; özete kısa giriş; `<details>` üzerine `panel-details`; kart sıra bilgisini aktar |
| `dashboard/listing-card.tsx` | `panel-card`; dış `<li>` giriş animasyonu; iç yüzeyde tek seferlik yeni ilan vurgusu |
| `dashboard/feed-filters.tsx` | Alanlarda yalnızca renk geçişi; gönderim sırasında gerçek pending geri bildirimi gerekiyorsa küçük client durum yönetimi |
| `whatsapp/page.tsx` | Başlık ve ana panel grubuna giriş; mobilde aşağıda kalan aside’a uzun gecikme yok |
| `whatsapp/wa-panel.tsx` | Faz bazlı içerik girişi, sabit QR alanı, bekleme simgesi, gerçek geçişte başarı işareti |
| `app-header.tsx` | Sekme çizgisi, menü girişi; mevcut klavye davranışlarını koru |
| `dashboard/notification-bell.tsx` | Sayaç artışı tespiti ve tek seferlik salınım |
| Yeni yükleme sınırı | Gerçek veri bekleme alanına skeleton; route/Suspense yerleşimine göre |

Tailwind kullanım örnekleri:

```tsx
// Başlık grubu
<div className="panel-enter">...</div>

// Sonuç özeti
<div
  className="panel-enter [--motion-enter:240ms]"
  style={{ "--enter-delay": "40ms" } as React.CSSProperties}
>
  ...
</div>

// ListingCard dış <li>; yeni ilan yüzeyi içeride ayrı tutulur.
// İki animation utility'sini aynı elemana koymayın.
<li
  className={`panel-card ${index < 6 ? "panel-enter panel-stagger" : ""}`}
  style={{ "--enter-index": index } as React.CSSProperties}
>
  <div className={highlightNew ? "panel-new rounded-[inherit]" : undefined}>
    ...
  </div>
</li>

// Mevcut details chevron
<svg className="
  h-5 w-5 transition-transform
  duration-[var(--motion-ui)] ease-[var(--ease-ui)]
  group-open:rotate-180 motion-reduce:transition-none
" />

// Hesap menüsü: mevcut koşullu render ile giriş çalışır.
<div className="panel-menu ...">...</div>

// Başarı SVG yolu: uzunluk normalize edilir.
<path pathLength={1} className="panel-check" d="..." />
```

En etkili beş uygulama, öncelik sırasıyla:

1. **WhatsApp durum geçişleri ve sabit QR alanı:** bekleme ve başarıyı anlaşılır kılar.
2. **Filtre açılma/kapanması ve chevron:** en sık kullanılan kontrolü daha anlaşılır yapar.
3. **Kısa sayfa girişi ve sınırlı kart stagger’ı:** sıcak editorial karakteri kurar.
4. **Hesap menüsü girişi ve sekme çizgisi:** ortak kabuğu bütünleştirir.
5. **Gerçek veri beklemesine bağlı skeleton:** yüklemenin algılanan kararlılığını artırır.

Reduced-motion desteği ilk uygulamayla birlikte eklenmeli; sonradan yapılacak bir rötuş olarak bırakılmamalı.