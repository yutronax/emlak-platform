# https://www.youtube.com/watch?v=fwPH-1xLquo — Gemini (gemini-3.5-flash) analizi

Videoda kullanılan kurgu ve motion tasarım tekniklerinin tersine mühendislik dökümü aşağıdadır:

---

### 1. Zaman Çizelgesi ve Geçiş Analizi

* **00:06 (Zoom/Whip In):** Dış çekimden salona hızlı zoom-in ve whip geçişi. Hız rampası: %100 → %700 → %100 (yaklaşık 8 kare). Yön: İleri. Motion blur yüksek. Müzik vuruşuna tam oturuyor.
* **00:07 - 00:13 (Seri Hızlı Kesmeler):** Salon, mutfak, detaylar arası hızlı whip pan ve zoom geçişleri. Her kesme 6-10 kare arası hız rampası (%500) ve yatay/dikey hareket bulanıklığı içeriyor.
* **00:13 - 00:17 (İçinden Geçme & Zoom Out/Up):** Koridordan hareketli çekim, 00:16'da dikey hızlı zoom/whip pan ile havadan aerial (drone) çekime geçiş.
* **00:18 - 00:26 (Kapı Maskeleme / Fast Zoom):** Havadan yatak odasına kapı çerçevresinden zoom-in geçişi. Ardından banyo ve arka bahçeye hızlı rampa geçişleri.
* **00:26 - 00:30 (Eşleşmeli Kesme / Match Cut):** Sunucunun odaya girişi ve kıyafet değişimi (gömlekten takıma) hızlı geçiş ve hareket eşleşmesiyle yapılmış.
* **00:35 - 00:42 (Görüş Açısı / İçinden Geçme):** Dar koridor/tuğla duvar arasından kameranın geçişi (Mask overlay + forward speed ramp). Havuza çıkış.
* **00:53 - 00:57 (Gün Batımı Zoom Out):** Ön plandaki çiçekten/güneş parlamasından gökyüzü drone çekimine hızlı whip/zoom out geçişi.

---

### 2. "İçinden Geçme" (Through Transition) Adımları

1. **Çekim:** Kamera kapı, kolon veya dar bir nesneye sıfır yanaşır (ekran kararır/kapanır). İkinci çekim aynı nesnenin arkasından başlar.
2. **Maskeleme:** İlk klibin sonuna veya ikinci klibin başına dinamik maske (feather: 15-20px) uygulanır.
3. **Birleştirme:** İki klip birleştiği an hız rampası (%600) ve yönlü hareket bulanıklığı (Directional Blur) eklenerek geçiş gizlenir.

---

### 3. Hız Rampası Desenleri

* **Normal Kesit:** %100 hız (0.5 - 1.0 saniye).
* **Hız geçişi (Transition Zone):** %500 - %800 hız (0.1 - 0.3 saniye / 6-10 kare).
* **Eğri Tipi:** S-Curve (Exponential Ease-in / Ease-out).
* **Senkronizasyon:** Hızlı tepe noktası tam olarak müziğin bas/trampet vuruşuna denk getirilir.

---

### 4. Yazı ve Grafik Kullanımı

* **00:02 - 00:04:** 3D Camera Tracking ile mekana sabitlenmiş fiyat yazısı ($1,699,999). Sarı/yeşil parlama (glow) ve pop-up efekti mevcut. Görüntüyü kapatmıyor, merkezde.
* **00:58 - 01:00:** Kapanışta 3D logomsu grafik ekran ortasına yerleştirilmiş.

---

### 5. Çekim Tarafı (Kamera Tekniği)

* **Gimbal:** Tüm yürüyüşlerde aktif gimbal takibi.
* **Fiziksel Whip/Push:** Geçiş öncesinde kameraman kamerayı hızla ileri iter veya sağa/sola sertçe çevirir (whip).
* **Ön Plan Nesneleri:** Geçiş noktalarında bilinçli olarak duvar, bitki veya kapı kasaları ön plana alınarak kamera bunlara yaklaştırılmıştır.

---

### 6. FFmpeg / Edit Parametre Reçetesi

* **Hız Rampası (FFmpeg):** `setpts=0.15*PTS` (Hızlı 6 karelik geçiş bölgesi için).
* **Motion Blur:** 30px ile 50px arası dikey/yatay yönlü blur.
* **Zoom Effect:** 5 kare içinde Scale %100'den %160'a büyüme, Ease-In-Out eğrisi.
* **Maskeleme (Alpha Matte):** Softness/Feather: 10-20px, geçiş süresi 0.2 saniye.
