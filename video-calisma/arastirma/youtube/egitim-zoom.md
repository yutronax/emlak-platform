# https://www.youtube.com/watch?v=VyGkilcMq5Q — Gemini (gemini-3.5-flash) analizi

İşte emlak videosundaki kurgu tekniklerinin ve hız rampalı zoom geçişinin tersine mühendislik analizi:

---

### 1. Zaman Çizelgesi ve Geçiş Analizi

* **01:57 - 02:05 | Demo Geçişi:** İç mekandan dron çekimine Zoom + Speed Ramp geçişi.
* **02:13 - 04:30 | 1. Klip (İç Mekan):** 
  * *Teknik:* Time Remapping (Hız Rampası).
  * *Değerler:* %100 normal hızdan başlar, klip sonunda %3200 tepe hızına ulaşır. Bezier eğrisi ile yumuşatılmıştır.
* **04:31 - 05:28 | 2. Klip (Dron / Dış Mekan):** 
  * *Teknik:* Time Remapping (Ters Rampalama).
  * *Değerler:* %1600 tepe hızıyla başlar, klip ortasına doğru %100 normal hıza düşer.
* **05:29 - 08:59 | Zoom & Motion Blur Katmanı:**
  * *Teknik:* Adjustment Layer üzerine `Transform` efekti.
  * *Değerler:* Scale %150'den %100'e düşürülür (Zoom-out hissi). `Use Composition's Shutter` kapatılıp `Shutter Angle: 360°` yapılarak dinamik hareket bulanıklığı (Motion Blur) oluşturulur.
* **09:00 - 09:33 | Kesim (Cut Optimization):**
  * *Teknik:* İki klip arasındaki duraksayan orta bölüm jilet (Razor) ile kesilip silinir; geçiş ivmesi kesintisiz hale getirilir.
* **09:34 - 10:14 | Ses Hizalama:**
  * *Teknik:* `Whoosh` ses efekti tam hız rampasının tepe noktasına hizalanır ve ses seviyesi `-9 dB`'e düşürülür.

---

### 2. "İçinden Geçme" / Zoom Geçiş Yapısı (Adım Adım)

1. **Ayar Katmanı (Adjustment Layer):** İki klibin birleşim noktasına yerleştirilir.
2. **Transform Efekti:** Katmana eklenir, ölçek (Scale) %150 yapılır.
3. **Keyframe Animasyonu:** Geçişin başladığı noktada %150, rampanın bittiği noktada %100 olacak şekilde keyframe konur.
4. **Motion Blur:** `Shutter Angle` 360° yapılarak hızlı yakınlaşma/uzaklaşma anında optik bulanıklık sağlanır.

---

### 3. Hız Rampalarının Ortak Deseni

* **Yavaş Kısım Süresi:** Normal akış (%100 hız).
* **Hızlı Kısım Süresi:** Yaklaşık 0.5 - 1 saniye.
* **Tepe Hızı:** %1600 - %3200 arası.
* **Eğri Şekli:** Bezier (S-Curve) kullanılarak yumuşak giriş/çıkış (Ease-in / Ease-out) sağlanır.

---

### 4. Yazı ve Grafik Kullanımı

* Video anlatımında ekranı kapatan yoğun grafikler yoktur.
* 00:12 - 00:20 arasında kanal jeneriği ve 10:54 sonrasında standart yönlendirme (end screen) kartları mevcuttur.

---

### 5. Çekim Tarafı Gereksinimleri

* **Geniş Açı:** Kurguda %150 ölçekleme (crop) yapılacağı için çekimler ekstra geniş açı ile yapılmalıdır.
* **Hareket Uyumu:** İç mekan çekimi ile dış mekan dron çekiminin eksenel hareketleri (ileri/geri) birbirini tamamlamalıdır.

---

### 6. FFmpeg / GSAP (HyperFrames) Yeniden Üretim Tarifi

* **Speed Ramp (FFmpeg):** `setpts` filtresi ile hız değişimi tanımlanır.
  * 1. Parça: `setpts=1.0*PTS`
  * Geçiş Bölgesi: `setpts=0.03*PTS` (Yaklaşık %3000 hızlanma)
* **Zoom & Blur (GSAP / CSS):**
  * **Scale:** `scale: 1.5` değerinden `scale: 1.0` değerine `power2.inOut` easing ile geçiş.
  * **Blur:** Peak noktasında `filter: blur(12px)` veya yönlü bulanıklık uygulanır.
* **Audio:** Ses efekti tepe noktasına offset edilip gain `-9dB` ayarlanır.
