# https://www.youtube.com/watch?v=b_Fb3IUgrl0 — Gemini (gemini-3.5-flash) analizi

İşte emlak videosundaki kurgu ve çekim tekniklerinin tersine mühendislik analizi:

---

### 1. Zaman Çizelgesi (Geçiş ve Kesimler)

*   **00:10 - 00:15 | Dış Cephe → Salon** *(Speed Zoom / Push-in)*
    *   **Teknik:** Dışarıdan evin orta cam paneline gimbal ile hızlı yaklaşma, hız rampası ve blur ile salona geçiş.
    *   **Hız Eğrisi:** %100 → %2000 (kesim anı) → %100 (10-12 kare geçiş).
    *   **Yön/Kamera:** Her iki klipte de ileri yönlü (düz hat).
    *   **Müzik Uyum:** Ritim vuruşuna oturuyor.
*   **00:15 - 00:17 | Salon → Balkon** *(Speed Zoom / Push-in)*
    *   **Teknik:** Şömine/Orta pencereye kilitlenip hızla ilerleme, kesimde hız rampası + hafif Gaussian blur.
    *   **Hız Eğrisi:** %100 → %2000 → %100.
*   **00:17 - 00:20 | Balkon → Mutfak** *(Speed Zoom / Push-in)*
    *   **Teknik:** Balkon korkuluğunun ortasına doğru push-in, mutfak koridoruna geçiş.
*   **00:20 - 00:23 | Mutfak → Havadan Çekim (Drone)** *(Window Push-Through / Speed Zoom)*
    *   **Teknik:** Mutfak sonundaki pencereye hızla yaklaşma, pencerenin içine "giriyormuş" gibi drone karesine geçiş.
*   **09:16 - 09:37 | Final Gösterim Sequence (Tüm Kesimler)**
    *   Tüm sahneler (Dış cephe → Salon → Balkon → Mutfak → Drone) arka arkaya tam ritim vuruşlarına (beat) denk getirilmiş, geçiş anlarına **Whoosh / Riser SFX** ve kesim noktalarında üst katmanda 10-15 karelik **Gaussian Blur + Cross Dissolve** uygulanmıştır.

---

### 2. "İçinden Geçme" (Through Transition) Adım Adım Yapılışı

1.  **Çekim A (Giriş):** Gimbal ile odanın ortasındaki odak noktasına (kapı, pencere, kolon) doğru düz bir hatta uzun süre ilerleyin.
2.  **Çekim B (Çıkış):** Yeni mekânda, aynı merkez hizasını koruyarak nesneden/kapıdan ileriye doğru yürümeye devam edin.
3.  **Kesim ve Speed Ramp:** 
    *   A klip sonuna `Shift + B` (FCPX) ile kesim noktası koyun.
    *   B klip başına kesim noktası koyun.
    *   Aradaki 5-10 karelik geçiş bölgesinin hızını **%2000 (20x)** yapın.
4.  **Blur Maskeleme:**
    *   Klipslerin üstüne bir **Adjustment Layer** (Ayar Katmanı) ekleyin.
    *   Katmana hafif **Gaussian Blur (Değer: 15-25)** ekleyin.
    *   Katmanın giriş ve çıkışına 2-3 karelik **Cross Dissolve** vererek yumuşatın.
5.  **Ses Tasarımı:** Kesim noktasına rampa yükselişiyle çakışan bir **Whoosh SFX** yerleştirin.

---

### 3. Hız Rampalarının (Speed Ramp) Ortak Deseni

*   **Normal Hız Süresi:** 1.5 – 2.5 saniye (%100 hız, 60 fps / yavaşlatılmış %40 oynatma).
*   **Hızlı Geçiş Süresi:** 6 – 12 kare (%2000 / 20x hız).
*   **Eğri Şekli:** Sert S-Curve (Hızlı ivmelenme ve aniden durma).
*   **Toplam Geçiş Süresi:** ~0.4 – 0.6 saniye.

---

### 4. Yazı ve Grafik Kullanımı

*   **00:04 | Ekran Ortası Title:** "BREAKING DOWN VIDEO TRENDS" (Glitch efektli, tipografik odaklı).
*   **00:43 | Teknik Kart (Lower Third/Overlay):** Ekranın alt-orta kısmında şeffaf 4 sütun halinde çekim ayarları (4K, 60fps, 1/120, f2.8-5.6). Görüntüyü kapatmaz.
*   **03:08 | Kılavuz Çizgileri:** Kompozisyon hizalamasını göstermek için 1/3 kuralı ve X-Merkez matris çizgileri yarı saydam overlay olarak verilmiş.
*   **03:46 | Listeleme Kartı:** Adım adım kurgu aşamaları (Edit Steps I-II-III) sol tarafta sade metin olarak listelenmiş.

---

### 5. Çekim Tarafında Yapılanlar

*   **Lens Seçimi:** Ultra geniş açı (16mm veya 12mm). Geniş açı, kenarlardaki hareketi bozarak hız hissini artırır.
*   **Gimbal Hareketi:** Yürüyüş sarsıntısını engelleyen "Ninja walk" tekniği.
*   **Kadrajlama:** Odak noktası (pencere/çerçeve) ekranın tam X-Y merkezinde tutulur.
*   **Mesafe:** Normal push-in shots'a göre hareket mesafesi 3 kat daha uzun tutulur (Speed ramp için yeterli veri karesi sağlamak adına).

---

### 6. FFmpeg ve HTML-GSAP ile Yeniden Üretim Parametreleri

#### FFmpeg Komutu (Hız Rampası + Blur)
```bash
ffmpeg -i clip1.mp4 -i clip2.mp4 -filter_complex \
"[0:v]trim=start=0:end=2,setpts=PTS-STARTPTS[v0]; \
 [0:v]trim=start=2:end=2.3,setpts=0.05*(PTS-STARTPTS),gblur=sigma=20[v1]; \
 [1:v]trim=start=0:end=0.3,setpts=0.05*(PTS-STARTPTS),gblur=sigma=20[v2]; \
 [1:v]trim=start=0.3:end=3,setpts=PTS-STARTPTS[v3]; \
 [v0][v1][v2][v3]concat=n=4:v=1:a=0[outv]" \
 -map "[outv]" output.mp4
```

#### HTML-GSAP (HyperFrames) Kod Yapısı
```javascript
const tl = gsap.timeline();

// Clip 1 Hızlı Zoom ve Bulanıklaşma
tl.to("#clip1", {
  scale: 2.2,
  filter: "blur(15px)",
  duration: 0.3,
  ease: "power4.in"
})
// Klip Değişimi ve Clip 2 Girişi
.to("#clip1", { opacity: 0, duration: 0.05 })
.fromTo("#clip2", 
  { scale: 0.4, opacity: 0, filter: "blur(15px)" },
  { scale: 1, opacity: 1, filter: "blur(0px)", duration: 0.3, ease: "power4.out" }
);
```
