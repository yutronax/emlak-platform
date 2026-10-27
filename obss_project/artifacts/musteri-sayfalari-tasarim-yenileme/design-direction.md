# Design Direction — musteri-sayfalari-tasarim-yenileme

## Konu ve Çıkış Noktası
Ürünün gerçek mekaniği: emlakçı WhatsApp grubuna ilan atıyor → sistem onu videolu bir vitrin kaydına dönüştürüyor. Bu, jenerik bir "SaaS dashboard" hikayesi değil, somut ve görsel olarak temsil edilebilir bir dönüşüm. Hero ve genel görsel dil bunu yansıtmalı — soyut gradient/ikon yığını yerine "mesajdan ilana" motifi.

## Jenerik Varsayılanlardan Kaçınma Kontrolü (zorunlu self-check)
AI-üretimi tasarımların en sık düştüğü 5 tuzak ve bu projede nasıl önlendiği:
1. **Sıcak krem + serif + terracotta #D97757** (Claude'un kendi rengi, bariz bir "tell") — Önlendi: zemin SOĞUK kırık beyaz (yeşilimsi-gri ton, krem DEĞİL), tipografi serif DEĞİL sans-serif, terracotta tonu daha koyu/toprak-tuğla (#C1532B), SADECE buton yüzeylerinde kullanılıyor (dekoratif serpiştirme yok).
2. **Neredeyse-siyah + tek parlak vurgu** — Önlendi: ana yüzey kırık beyaz (açık), lacivert sadece header/form-panel gibi sınırlı alanlarda.
3. **Broadsheet/gazete düzeni** — Uygulanmadı, bu markaya uymuyor.
4. **SaaS kart kiti (hepsi aynı border-radius, aynı gölge, rozet dışında ayrışmayan kartlar)** — Önlendi: Pro planı gerçekten farklı bir yüzeyde (lacivert zemin, yükseltilmiş), auth sayfaları simetrik değil (lacivert bilgi paneli + beyaz form paneli split).
5. **Şablon "chrome" (ALL-CAPS eyebrow, orta-nokta meta, em-dash etiket, buton sonunda →)** — Hiçbiri kullanılmıyor, açık prensip olarak yasaklandı.

## Token Sistemi (WCAG AA doğrulanmış — normal metin ≥4.5:1)

| Token | Hex | Kullanım | Kontrast (Fog White üzerinde) |
|---|---|---|---|
| `ink-900` (Ink Navy) | `#10253F` | Ana koyu renk: header/footer zemin, başlık metni, form-panel zemini | 14.27:1 (beyaz zemin üzerinde metin) |
| `fog-50` (Fog White) | `#F5F6F4` | Ana sayfa zemini (soğuk kırık beyaz, krem DEĞİL) | — (zemin) |
| `terracotta-600` (Action) | `#C1532B` | SADECE buton/CTA zemini (beyaz metinle) | Üzerinde beyaz metin: 4.63:1 (AA geçer) |
| `terracotta-700` (Text) | `#9C4423` | Terracotta'nın metin/link versiyonu (Fog White üzerinde OKUNABİLİR) — `terracotta-600` asla doğrudan metin rengi olarak kullanılmaz (4.27:1, AA'nın altında kalır) | Fog White üzerinde: 5.93:1 (AA geçer) |
| `slate-500` | `#5B6B7A` | İkincil/muted metin (açıklama, placeholder sonrası yardımcı metin) | 5.06:1 (AA geçer) |
| `mist-200` (Line Mist) | `#DCE1E0` | Hairline border, kart ayracı | — (dekoratif) |
| `moss-700` (Success) | `#2F6E4F` | Başarı banner'ı (`role="status"`) | 5.59:1 (AA geçer) |
| `brick-700` (Error) | `#A23B2E` | Hata banner'ı (`role="alert"`) | 6.05:1 (AA geçer) |

**Kural:** `terracotta-600` HİÇBİR ZAMAN doğrudan metin rengi olarak kullanılmaz (kontrastı yetersiz) — sadece buton zemini. Metin/link olarak terracotta gerekiyorsa `terracotta-700` kullanılır.

## Tipografi
- **Başlık (display):** Sora (next/font/google) — geometrik ama karaktersiz değil, varsayılan "her yerde Inter" hissinden ayrışıyor. Ağırlıklar: 600/700.
- **Gövde/form/UI:** Inter (next/font/google) — Türkçe karakterler (ı, ğ, ş, ç, ö, ü) için iyi test edilmiş, form/küçük metin için en güvenilir okunabilirlik. Ağırlık: 400/500.
- İki aile net ayrışıyor (geometrik display vs. nötr workhorse gövde) — tek aile kullanmak yerine.
- Satır uzunluğu: gövde metninde <80 karakter (`max-w-prose` civarı).
- `next/font` kullanımı ZORUNLU (CLS önleme, atdd.md Risks).

## Layout Konsepti

**Landing — asimetrik split, SOL hizalı (ortalanmış marketing-sayfa klişesi DEĞİL):**
```
+------------------------------------------------------------+
| [Logo]                    Fiyatlar   Giriş      [Kayıt Ol] |  <- fog-50 zemin, ink-900 metin
+------------------------------------------------------------+
|                              |                               |
|  WhatsApp'tan ilana,         |   [mesaj balonu -> ilan kartı |
|  dakikalar içinde.           |    dönüşüm motifi, play ikonu |
|                              |    ile video vurgusu]         |
|  Emlakçı ilanlarını WhatsApp  |                               |
|  grubundan alıp videolu       |                               |
|  vitrine dönüştürüyoruz.      |                               |
|                              |                               |
|  [Kayıt Ol] [Fiyatları Gör]  |                               |
+------------------------------------------------------------+
|  1  WhatsApp'a ilan at                                      |  <- gerçek bir sıra olduğu için
|  2  Video ile hazırlanır                                     |     numaralandırma UYGUN
|  3  Vitrine çıkar                                             |
+------------------------------------------------------------+
| footer (ink-900 zemin)                                       |
+------------------------------------------------------------+
```
Mobilde: sağ görsel sütun üstte küçük bir motif olarak kalır veya gizlenir, sol metin sütunu tam genişlik, dikey istiflenir.

**Pricing — asimetrik 3'lü, Pro GERÇEKTEN farklı yüzeyde (rozet-only değil):**
```
+-----------+  +----------------+  +-----------+
|  Temel    |  |   Pro          |  |  Kurumsal |
|  (fog-50, |  |  (ink-900 zemin,|  |  (fog-50, |
|   hairline|  |   yükseltilmiş, |  |   hairline|
|   border) |  |   beyaz metin)  |  |   border) |
|  99 TL/ay |  |  299 TL/ay      |  |  599 TL/ay|
|  [Satın Al]| |  [Satın Al]     |  |  [Satın Al]|
+-----------+  +----------------+  +-----------+
```
Pro kartı gerçekten farklı bir zemin rengi taşıyor (ink-900), diğer ikisi fog-50 + hairline border — "hepsi aynı kart, biri rozetli" klişesinden kaçınıyor.

**Login/Signup — split panel, dikey ortalanmış DEĞİL marka-bağlamlı:**
```
+-------------------+-------------------+
|  ink-900 panel    |  fog-50 form      |
|  kısa başlık +     |  Label            |
|  ürün cümlesi      |  [input]          |
|                    |  Label            |
|                    |  [input]          |
|                    |  [Giriş yap]      |
+-------------------+-------------------+
```
Mobilde: ink-900 panel ince bir üst şerit olarak kalır (tam yükseklik DEĞİL), form tam genişlik altta.

## Hareket (Motion)
Tek, orkestre edilmiş bir an: landing hero'daki mesaj-balonu→ilan-kartı motifi sayfa yüklendiğinde BİR KEZ bu dönüşümü gösterir (CSS animasyonu, `prefers-reduced-motion` ile devre dışı kalır). Kart hover'larında scatter'lanmış fade-slide efektleri YOK — sadece fonksiyonel hover/focus durumları (renk/border değişimi, translateY yok).

## Prensipler (özet)
1. Hero, ürünün gerçek mekaniğini (WhatsApp→video) temsil ediyor, soyut değil.
2. Terracotta SADECE eylem (buton) rengi — dekoratif serpiştirme yok.
3. Hiyerarşi gerçek yüzey farkıyla kuruluyor (Pro'nun lacivert zemini, auth'un split paneli) — rozet/border-only ayrım değil.
4. Sol hizalı, taranabilir metin — ortalanmış marketing klişesi değil.
5. Numaralandırma SADECE gerçek bir sıra olan "nasıl çalışır" bölümünde var (1-2-3), başka yerde eyebrow/label süsü yok.
6. ALL-CAPS etiket, orta-nokta meta, em-dash, buton sonu ok YOK.
