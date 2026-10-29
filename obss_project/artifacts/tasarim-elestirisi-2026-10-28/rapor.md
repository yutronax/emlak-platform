# Emlak Platformu — Sert UX/UI Raporu
_2026-10-28 · Opus alt-ajanı, 7 ekran görüntüsü (localhost dev) · Giriş sonrası panel kapsam dışı (oturum yoktu)_

Görüntüler: [1] landing hero (masaüstü), [2] nasıl çalışır + video, [3] fiyatlar, [4] kayıt ol, [5] landing mobil, [6] fiyatlar mobil, [7] giriş mobil.

## 1. Genel hüküm
Site bir Tailwind şablonuna undraw çizimleri eklenmiş, logosuz bir hafta sonu projesi gibi duruyor. Başlık doğru şeyi söylüyor ama "düzenli"nin neye benzediği hiç gösterilmiyor; tek ürün kanıtı [1]'deki küçük, sönük balon→ok→kart. Güven sıfıra yakın: marka, logo, yorum, rakam, emlakçı yüzü yok; footer'da sahte numara, kartlarda "(placeholder)". WhatsApp hesabını bağlatmak isteyen bir site için ölümcül — "bunlar kim?" sorusuna cevap yok.

## 2. UI
### Tipografi ve hiyerarşi
- [1] H1 5 satıra kırılıyor, ekranın yarısını yiyor, CTA'ları fold dibine itiyor → ~%25 küçült, 3 satır hedefle.
- [1][5] "Uygulama yok. Kurulum yok…" satırı alt başlıktan küçük ama daha koyu; hiyerarşi ters → güven rozetlerine çevir.
- [1][3][4] Masaüstü nav/logo metni çok küçük → nav ≥15–16px, logo 18–20px.
- [3] "99,00 ₺" → "99 ₺".
- [2] Asıl bilgiyi taşıyan gövde metni en sönük öğe.

### Renk ve kontrast
- [2][3] Kırık beyaz üstünde açık gri metin AA sınırında/altında → en az #4A5563.
- [1] Demo balonu zeminde kayboluyor.
- [3] Lacivert Destek butonu lacivert footer'da kayboluyor.
- [3] Öne çıkması gereken Pro kartının butonu beyaz, diğerleri terracotta — ters mantık.

### Boşluk, grid, hizalama
- [1] Header logosu hero metninden ~35px içeride — iki farklı container genişliği.
- [1] Sağ yarının ~%80'i boş noktalı zemin.
- [3] Okunmayan minik monitör illüstrasyonu + başlıktan kopuk "Reklam videosu ayrı…" satırı.
- [4] 50/50 bölünme: sol panel boş, form sağda küçük.

### Bileşenler
- Header [5][6][7]: 375px'te "Emlak/Platformu" ve "Kayıt/Ol" ikiye kırılıyor, header ~90px. → nowrap, kısa logo, hamburger.
- Aktif sayfa göstergesi yok; kayıt sayfasında "Kayıt Ol" butonu duruyor.
- [1][5] İki CTA aynı ağırlıkta, birbiriyle yarışıyor.
- [2] Video seçenek kartları tıklanabilir görünüyor ama CTA/fiyat yok.
- [4][7] Placeholder, şifre kuralı, göster/gizle, "Şifremi unuttum" yok; [4]'te "Ücretsiz Deneyin" başlık+buton tekrarı.
- [5][6][7] Destek butonu mobilde içeriği örtüyor, etiketi kayboluyor.

### İllüstrasyonlar
- [2] Çizimler WhatsApp'ı/grubu/ilan akışını göstermiyor; 2. adımdaki kilit ikonu korku uyandırıyor.
- [2] Video bölümü "merdivene tırmanan yaratıklar" — profesyonel video satarken amatörlük sinyali, tek gerçek video karesi yok.
- [4] Belinden kırpılmış adam, kutu içinde kutu.
- [3] Okunmayan ürün ekranı.
- Genel: gerçek ürün ekranı yok; hero'da büyük telefon mockup'ı olmalı.

### Mobil
- [5] Demo CTA'ların altına, fold dışına düşüyor.
- [7] ~250px lacivert pazarlama bandı formu aşağı itiyor.
- [6] Tam ekran kartlar alt alta, karşılaştırılamıyor.

## 3. UX
### Değer önerisi
- Özellik anlatılıyor, kazanç değil ("hiçbir portföyü kaçırma", "50 grubu tek tek okuma").
- [7] "WhatsApp'a attığınız ilanlar" — ürün gruplara düşenleri topluyor; mesaj çelişiyor.
- [2] Video ürünü fiyatsız, sipariş yolu yok.

### Güven
- Logo, şirket bilgisi, yorum, sosyal kanıt yok.
- En kritik: "mesajlarımı okuyor musunuz, banlanır mıyım, KVKK?" sorularının hiçbiri cevaplanmıyor.
- [3] Sahte numara + "(placeholder)" canlıda iyzico ödeme sayfasında güveni öldürür.

### Dönüşüm
- [3] "Kredi kartı istemeden deneyin" vs üç "Satın Al" butonu — deneme nerede?
- [3] Planlar neredeyse aynı, "önerilen" rozeti/yıllık seçenek yok, emlakçı kaç gruba ihtiyacı olduğunu bilmiyor.
- [4] WhatsApp ürününde telefon alanı yok; e-posta+şifre+şirket adı isteniyor; KVKK onay kutusu yok (yasal risk).
- CTA dili: "Kayıt Ol / Ücretsiz Deneyin / Satın Al / Giriş yap" aynı huni için 4 kelime.

### Hedef kitle
- E-posta+şifre en büyük sürtünme → telefon + SMS/WhatsApp kodu.
- "Bağlayın" teknik ve korkutucu; QR adımı gösterilmiyor.
- Doğrudan "WhatsApp'tan yazın" butonu yok.

### Bilgi mimarisi
- Nav'da SSS, Güvenlik, Video, İletişim, "Nasıl çalışır" anchor'ı yok.

### Erişilebilirlik (görüntüden)
- Düşük kontrastlı gri metin, küçük nav, ikon-only destek butonu, footer'da kaybolan buton.

## 4. Karne
| Sayfa | Puan | En kötü 3 şey |
|---|---|---|
| Landing masaüstü [1][2] | 4/10 | Sönük demo; ilgisiz/çocuksu çizimler; WhatsApp güvenliği açıklaması yok |
| Fiyatlar masaüstü [3] | 3/10 | Deneme vs "Satın Al" çelişkisi; placeholder + sahte numara; zayıf Pro kartı |
| Kayıt masaüstü [4] | 3/10 | Boş sol panel, kırpık çizim; telefon/KVKK yok; aktif sayfada "Kayıt Ol" |
| Landing mobil [5] | 4/10 | Kırılan logo/buton; demo fold dışı; destek butonu örtüyor |
| Fiyatlar mobil [6] | 3/10 | Karşılaştırılamayan kartlar; destek butonu fiyatı örtüyor; ",00" ve placeholder |
| Giriş mobil [7] | 4/10 | Formu iten lacivert bant; "Şifremi unuttum" yok; çelişen kopya |

## 5. Öncelikli düzeltmeler
**P0 (canlı öncesi şart)**
- Placeholder plan adları + sahte numara → gerçek (etki çok yüksek / efor çok düşük)
- Mobil header kırılması (yüksek / düşük)
- Fiyat CTA'ları "X gün ücretsiz dene" + deneme/ödeme mantığı (yüksek / düşük)
- Kayıtta KVKK/sözleşme onayı (yasal / düşük)
- "WhatsApp'ım güvende mi?" bölümü (çok yüksek / orta)
- "Şifremi unuttum" (yüksek / düşük)
- Destek butonu mobilde örtmesin, footer kontrastı (orta / düşük)

**P1**
- Hero'ya gerçek ürün akışlı telefon mockup'ı (yüksek / orta)
- Telefon + kodla kayıt/giriş (çok yüksek / yüksek)
- Container hizası + aktif sayfa göstergesi (orta / düşük)
- Kayıt/giriş boş panellerini kaldır, form üste (orta / düşük)
- Gri metin AA, nav puntosu (orta / düşük)
- Video hizmetine fiyat+CTA ya da landing'den çıkar (orta / orta)
- Logo/marka, sosyal kanıt, şirket bilgisi (yüksek / orta)

**P2**
- undraw → ürün ekranları/gerçek fotoğraf (orta / orta)
- Pro'ya "En çok tercih edilen" rozeti + terracotta buton (orta / düşük)
- ",00" kaldır, yıllık plan (düşük / düşük)
- Nav'a SSS + "Nasıl çalışır" (orta / düşük)
- Görünür WhatsApp destek butonu (orta / düşük)
- Mobil fiyat karşılaştırma tablosu/yatay kaydırma (orta / orta)

## 6. Değerlendirilemeyenler
Giriş sonrası panel/ilan akışı/filtreler/WhatsApp bağlama/onboarding; hover/focus/disabled durumları ve klavye; form doğrulama ve hata mesajları; destek butonunun içeriği; landing'in görülmeyen kısımları, masaüstü giriş ve mobil kayıt; ölçülmüş kontrast oranları, alt metinler, ekran okuyucu, hız; gerçek telefonda dokunma hedefleri; iyzico ödeme akışı.
