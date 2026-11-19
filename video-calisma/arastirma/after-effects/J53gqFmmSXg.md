# https://www.youtube.com/watch?v=J53gqFmmSXg — Gemini (gemini-3.5-flash) analizi

İşte Boris FX Sapphire efektlerinin incelenmesi, kurgu tekniklerinin analizi ve 9:16 dikey emlak ilan tanıtım videoları için kullanım rehberi:

---

### 1. Zaman Çizelgesi & Geçiş Analizi (Örnek Kesitler)

* **[13:21] S_CardFlip:** Kart çevirme geçişi. 3D eksende dönme. 0.5 sn.
* **[13:26] S_Dissolve / DissolveBlur:** Erime ve bulanıklaşma geçişi. 0.4 sn, doğrusal yumuşama.
* **[13:45] S_DissolveLensFlare:** Işık patlamasıyla sahne değişimi. Flaş etkisi yaratır, 0.3 sn.
* **[14:05] S_HyperPull / HyperPush:** Hızlı zoom-in/zoom-out geçişi. Hız rampası: %100 → %600 → %100 (ease-in-out, 12 kare), hareket bulanıklığı yüksek.
* **[14:11] S_SwishPan / WhipLash:** Hızlı pan/kırbaç (whip) geçişi. İki çekim aynı yatay yönde ivmelenir (10-15 kare).
* **[14:15] S_WhipLash:** Ani açı değişimi. Müzik ritmine (beat) oturtulmuş, kare duraksamalı.

---

### 2. "İçinden Geçme" (Through Transition) Adım Adım Tarif

Kameranın kapı, pencere veya kolondan geçerek sonraki mekana girmesi tekniği:

1. **Çekim:** Kamerayı kapı/pencere çerçevsine tam ortalayarak hızla yaklaştırın.
2. **Maskeleme:** Açıklık alanını (kapı içi) pen tool ile maskeleyin ve feather verin (15-30px).
3. **Zoom Rampası:** Çerçeveye yaklaşırken Scale değerini %100'den %300'e hızlıca çıkarın (Ease Out).
4. **Harmanlama:** İkinci klip arka katmana konur; maske büyüdükçe ikinci mekan görünür hale gelir. Motion Blur açılır.

---

### 3. Hız Rampası (Speed Ramp) Ortak Deseni

* **Yavaş Kısım:** %100 (Normal hız) – Mekanın/odanın tanıtıldığı ana bölüm (1.5 - 2 sn).
* **Hızlı Kısım:** %400 - %800 – Geçiş anı (8 - 12 kare / ~0.3-0.4 sn).
* **Eğri (Ease):** S-Curve (Bezier). Hızlı ivmelenme ve yumuşak duruş.
* **Toplam Geçiş Süresi:** 0.3 - 0.5 saniye.

---

### 4. Yazı ve Grafik Kullanımı

* **Görsel Alan:** Metinler ekranın merkezini veya önemli mimari detayları kapatmamalı, alt/üst 1/3'lük alanlara yerleştirilmelidir.
* **Takip (Tracking):** Binaya veya iç mekan duvarına sabitlenmiş 3D Motion Tracking metinler, mekana derinlik katar.

---

### 5. Emlak Çekim / Prodüksiyon Tavsiyeleri

* **Gimbal Hareketi:** Odaya girerken veya dış çekimde tek yönde (ileri/sağa) sabit hızla ilerleyin.
* **Hızlı Bitiş:** Geçiş yapılacak klip sonlarında gimbal'ı hızlıca geçiş yönüne çevirin (Whip pan desteği için).
* **Düzgün Işık:** İç mekandan dış mekana geçerken pozlamayı kilitleyin veya HDR çekin.

---

### 6. FFmpeg ve GSAP/HyperFrames ile Yeniden Üretim

#### FFmpeg Hız Rampası ve Zoom Geçişi
```bash
ffmpeg -i in1.mp4 -i in2.mp4 -filter_complex \
"[0:v]setpts=0.5*PTS,scale=1080:1920,zoompan=z='min(zoom+0.05,1.5)':d=15:s=1080x1920[v1]; \
 [1:v]setpts=0.5*PTS,scale=1080:1920[v2]; \
 [v1][v2]gltransition=duration=0.4:source=crosswarp" out.mp4
```

#### GSAP (HyperFrames) Animasyon Eğrisi
```javascript
// İleri Doğru Zoom ve Hız Rampası
gsap.to("#clip1", {
  duration: 0.4,
  scale: 2.5,
  ease: "power3.in",
  filter: "blur(10px)"
});
```

---

### 7. Videodaki Efekt Grupları ve Emlak Tanıtımına Uygunluğu

| Efekt Grubu | Videodaki İşlevi | Emlak Tanıtımında Kullanımı |
| :--- | :--- | :--- |
| **S_Adjust** | Renk, kanal, doygunluk ayarları. | **Kısmen Uygun:** Doğal renk düzeltmeleri için `S_Gamma` ve `S_HueSatBright` kullanılabilir. Aşırı doygun/psikedelik olanlar kullanılmamalı. |
| **S_Blur & Sharpen** | Bulanıklaştırma ve netleştirme. | **Çok Uygun:** `S_Beauty` cilt/yüzey pürüzsüzleştirir, `S_EdgeAwareBlur` ve `S_Sharpen` detay belirginleştirir. |
| **S_Distort** | Bükme, dalgalandırma, perspektif. | **Uygun Değil:** Mekanın mimari yapısını bozduğu için gerçeklik algısını zedeler (Kullanmayın). |
| **S_Lighting** | Işık huzmeleri, lens parlaması, glow. | **Çok Uygun:** `S_Glow`, `S_LightLeak`, `S_Rays` pencerelerden giren güneş ışığını ve lüks atmosferi vurgular. |
| **S_Render** | Doku, yıldız, bulut, şimşek üretimi. | **Kısmen Uygun:** Yalnızca `S_Gradient` ve `S_Sky/NightSky` (hava durumu rötuşları) işe yarar. |
| **S_Stylize** | Çizgi film, mozaik, glitch, eskiz. | **Uygun Değil:** Emlak videolarını kalitesiz ve ciddiyetten uzak gösterir. |
| **S_Time** | Kare dondurma, stroboskop, iz bırakma. | **Kısmen Uygun:** `S_Retime` yumuşak ağır çekimler (slow-motion) için uygundur. |
| **S_Transitions** | Çeşitli geçiş efektleri. | **Çok Uygun:** `S_SwishPan`, `S_DissolveBlur`, `S_HyperPull/Push` dinamik mekan geçişleri sağlar. |

---

### 8. Emlak Tanıtımı İçin Öneriler

#### EN VERİMLİ 15 EFEKT / ÖN AYAR

1. **S_Glow:** Odadaki ışık kaynaklarına ve pencerelere lüks, yumuşak bir parlama verir.
2. **S_LightLeak:** Sahne geçişlerinde doğal sıcak güneş ışığı süzülmesi hissi yaratır.
3. **S_Rays:** Pencerelerden giren sinematik güneş huzmeleri (god rays) oluşturur.
4. **S_Sharpen:** Dış cephe, taş ve ahşap dokularındaki detayları netleştirir.
5. **S_Beauty:** Mutfak tezgahı, fayans gibi yüzeylerdeki mikro kusurları pürüzsüzleştirir.
6. **S_EdgeAwareBlur:** Arka planı yumuşatırken mimari kenarları keskin tutar.
7. **S_Vignette:** Odak noktasını (ör. ada mutfak) öne çıkarıp kenarları hafif karartır.
8. **S_SwishPan:** Odalar arası hızlı ve akıcı geçiş sağlar.
9. **S_HyperPull / Push:** Dış çekimden iç mekana geçerken dinamik zoom etkisi sunar.
10. **S_DissolveBlur:** Odalar arası yumuşak ve sinematik geçiş oluşturur.
11. **S_LensFlare (Minimal):** Lüks aydınlatma armatürlerine şık parlamalar ekler.
12. **S_UltraGlow:** Beyaz/aydınlık iç mekanlarda ferahlık hissini artırır.
13. **S_HueSatBright:** Renk dengesini ve ahşap/çim tonlarının canlılığını ayarlar.
14. **S_Gradient:** Gökyüzü veya boş duvarlara ton geçişi ekler.
15. **S_Retime:** Yüksek kaliteli ağır çekim (slow-motion) detay turları için idealdir.

#### KAÇINILMASI GEREKENLER

* **Glitch ve Bozulma Efektleri (`S_DigitalDamage`, `S_TVDamage`, `S_PixelSort`):** Gayrimenkulün kalitesiz veya sorunlu olduğu algısını yaratır.
* **Psikedelik Renkler (`S_PsykoBlobs`, `S_Invert`, `S_QuadTone`):** Gerçek renkleri yok eder, müşteriyi yanıltır.
* **Aşırı Stilizasyon (`S_Cartoon`, `S_Crosshatch`, `S_Mosaic`):** Mimari detayları gizler.
* **Şiddetli Bükülmeler (`S_WarpVortex`, `S_WarpBubble`, `S_Shake`):** İzleyicide baş dönmesi yaratır ve mekanın boyut hissini bozar.
