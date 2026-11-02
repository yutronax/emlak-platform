# Tasarım dili — Stellar × Concrete uyarlaması

> Kullanıcı seçimi (2026-11-02): Awwwards emlak kategorisinden **Stellar Management** ve **Concrete**.
> Kaynaklar canlı sitelerde ölçüldü (stellarmanagement.com, concretemanagement.ch/fr). Amaç kopya değil:
> iki sitenin *ilkelerini* Emlak Platformu kimliğine uyarlamak. Görsel/metin/logo alınmaz.

## 1. Referanslardan ölçülenler

| | Stellar Management | Concrete |
|---|---|---|
| Başlık fontu | General Sans 500, H1 57,6px, harf aralığı **−4%** | Otto 300 (ince), H1 **144px**, harf aralığı **−7%** |
| Vurgu fontu | Playfair Display *italik* — cümledeki tek kelime ("find *home*", "Featured *properties*") | yok (tek aile) |
| Gövde | General Sans 500 | Inter Display 400, 16/20,8 |
| Renk | lacivert **#06184F**, metin #181513, beyaz | kömür **#141416**, taş **#DCD9C8**, krem **#FFFDF1**, sıcak gri **#97968D**, bordo **#5F4242** |
| Düğme | lacivert dolu, 12×24 iç boşluk, **asimetrik köşe `0 8px`** | — |
| İlk ekran | 100vh tam ekran fotoğraf, başlık sol altta beyaz | 100vh koyu, dev başlık + altta 4 rakam (600M €, 4,8/5, %90, %100) |
| Rakamlar | 85px ince (400) rakam + küçük etiket, **ince çizgili ızgara**, lacivert zemin | 40px beyaz rakam, ilk ekranın altında satır |
| Liste dili | — | hizmetler 144px dev satırlar; aktif olan koyu, diğerleri sıcak gri |
| Ritim | bölümler ~900px, büyük boşluk (160px üst) | taş zemin üzerinde uzun bölümler |

## 2. Bize uyarlanmış dil ("Taş & Lacivert")

### Renk (mevcut `ink-900` korunur — Stellar laciverti zaten çok yakın)
| Token | Değer | Kullanım |
|---|---|---|
| `ink-900` | #10253F (mevcut) | birincil düğme, koyu bölümler, rakam bandı |
| `charcoal` | #141416 | ana metin (koyu kahve-siyah yerine) |
| `stone-200` | #DCD9C8 | pazarlama bölüm zemini (Concrete taşı) |
| `cream-50` | #FFFDF1 | kart/form yüzeyi, açık zemin |
| `ash-400` | #97968D | ikincil metin, pasif liste satırları |
| `terracotta-600` | #C1532B (mevcut) | **yalnız küçük vurgu**: rozet, aktif çizgi, "yeni" etiketi — düğme rengi olmaktan çıkar |
| `moss-700` / `brick-700` | mevcut | başarı / hata (değişmez) |

### Tipografi
- **Başlık:** *Inter Tight* (Google Fonts) 300 büyük boylarda / 500 orta boylarda, harf aralığı −4…−6%. Sora bırakılır.
- **Vurgu:** *Instrument Serif* italik (Google Fonts) — her başlıkta **en fazla bir kelime** ("İlanlar *tek akışta*").
- **Gövde:** Inter 400/500 (mevcut).
- Ölçek (masaüstü): ilk ekran 96–120px · bölüm 56–72px · alt başlık 32px · rakam 72–88px ince · gövde 16–18px.

### Biçim
- **İmza köşe:** düğme ve kartlarda asimetrik `border-radius: 0 10px` (Stellar'dan uyarlama).
- Çizgiler: rakam ızgarası ve listelerde 1px ince ayırıcı (`ink/15` koyuda, `charcoal/10` açıkta).
- Gölge yok denecek kadar az; derinlik zemin tonlarıyla (stone ↔ cream ↔ ink).

### Bölüm kalıpları (pazarlama)
1. **İlk ekran:** 100vh tam ekran görsel/video, sol altta dev başlık (+ serif vurgu kelimesi), altında Concrete gibi 3–4 güven rakamı satırı.
2. **Beyan:** taş zemin, ortada 56px tek paragraf (Stellar "From historic blocks…" gibi).
3. **Nasıl çalışır:** Concrete dev liste — 3 adım 96px satırlar, kaydırdıkça aktif satır koyulaşır, diğerleri `ash-400`.
4. **Rakam bandı:** lacivert zemin, 3×2 ince çizgili ızgara, 80px ince rakamlar (Stellar).
5. **Vitrin önizleme:** "Vitrinde *yayında*" — kart kaydırıcı (Stellar "Featured *properties*").
6. **Kapanış:** tam genişlik lacivert "Hadi *başlayalım*" + birincil düğme.

### Uygulama ekranları (panel / admin / hesap)
Aynı token'lar, sakin dozda: krem yüzeyler, taş arka plan yerine `cream-50`/beyaz, başlıklar Inter Tight 500,
asimetrik köşeli lacivert düğmeler, terracotta yalnız rozet/aktif çizgi. Yoğunluk ve okunabilirlik önce.

## 3. Kararlar (kullanıcı, 2026-11-02)
1. **Görseller:** lisanslı stok (ücretsiz ticari kullanım lisanslı; her görselin kaynağı ve lisansı `web/public/images/CREDITS.md`'de).
2. **Terracotta:** küçük vurgu — birincil düğmeler lacivert (`ink-900`), turuncu yalnız rozet/aktif çizgi/etiket.
3. **Sıra:** önce pazarlama (ana sayfa → fiyatlar → giriş/kayıt → vitrin → onay), sonra panel/admin.
