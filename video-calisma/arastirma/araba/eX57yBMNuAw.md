# https://www.youtube.com/watch?v=eX57yBMNuAw — Gemini (gemini-3.5-flash) analizi

İşte videonun kurgu tekniklerinin tersine mühendislik analizi ve emlak kurgularına uyarlanması:

---

### 1. Zaman Çizelgesi ve Geçiş Analizi

*   **[00:00 - 00:01]** *Ön Görsel / Title Zoom* — Hız Rampası (%100→%500→%100) + Hızlı Zoom In. Vuruşla senkronize.
*   **[00:01 - 00:03]** *Yan Profil -> Döner Viraj* — Eşleşmeli Kesim (Match Cut) & Hız Rampası (%100→%800→%100, 6 kare). Sol-sağ kamera hareketi uyumlu.
*   **[00:03 - 00:05]** *Sokak Panorama -> Ön Yakın Çekim* — Whip / Speed Ramp Geçişi. Hareket bulanıklığı (Motion Blur) yüksek.
*   **[00:05 - 00:07]** *Ön Izgara -> Ön Far Close-up* — Zoom In Rampası (%100→%600, 4 kare). Nesneye yaklaşma hareketi tamamlıyor.
*   **[00:07 - 00:09]** *Far Close-up -> Arka Stoplar* — Kesme (Hard Cut) + Bas Vuruşunda Parlama/Flaş efekti.
*   **[00:09 - 00:12]** *Arka Profil -> Park Halinde Ön Profil* — Hız Rampası (%100→%400→%100). Nesne ortalama eşleşmesi.
*   **[00:12 - 00:16]** *Otopark Girişi -> Gri BMW Ön* — Dikey Whip Geçişi + Hız Eğrisi (Ease-in / Ease-out).
*   **[00:17 - 00:20]** *Gri BMW Far -> Çift Araç Arka Stoplar* — Maske Geçişi (Kolon arkasından geçiş) + Flaş.
*   **[00:21 - 00:27]** *Siyah BMW Far Close-up* — Düşük Işık Hız Rampası (%100→%500). Ses efekti (Whoosh) ile vuruşa oturma.
*   **[00:28 - 00:33]** *Siyah BMW -> Yeşil Lamborghini* — Renk & Yön Eşleşmeli Whip Transition (Soldan sağa pan hareketi).
*   **[00:33 - 00:37]** *Lamborghini Jant -> Ön Izgara & Gökyüzü* — Dikey Kaydırma / Zoom Rampası (%100→%800→%100, 5 kare).
*   **[00:38 - 00:44]** *Egzoz -> V12 Amblem* — Nesne Eşleşmeli Kesim (Match Cut). Odak noktası merkezde tutulmuş.
*   **[00:45 - 00:48]** *Kokpit -> Çalıştırma Butonu* — Hızlı Dahili Maske / Kesme. Vuruşa tam senkronize.
*   **[00:49 - 00:53]** *Kapı Açılışı -> Arka Far* — Yavaşlama Rampası (%300→%100). Akıcı geçiş.
*   **[00:53 - 01:03]** *Mercedes AMG Çift Araç -> Kapanış* — Seriye Bağlı Hız Rampaları (%100→%1000→%100, 3-5 kare geçişleri) + Bas Vuruşu Kesmeleri.

---

### 2. "İçinden Geçme" (Through Transition) Adım Adım Yapılışı

1.  **Çekim:** Kamerayla bir nesneye (kolon, duvar, kapı kasası) teğet veya tam üzerine doğru hızlıca yaklaşılır. Kesit tamamen kadrajı kaplamalıdır.
2.  **Maskeleme:** İkinci klip, birinci klibin nesneyle kaplandığı kareden itibaren Alfa Kanallı maske (Rotoscoping / Pen Tool) ile açılır.
3.  **Hız Rampası:** Geçiş noktasına 3-5 kare kala hız %100'den %600+% seviyesine çıkarılır.
4.  **Bulanıklaştırma:** Geçiş karesine Directional Blur (Motion Blur) eklenerek kesim gizlenir.

---

### 3. Hız Rampalarının Ortak Deseni

*   **Yavaş Kısım Süresi:** ~0.8 sn - 1.2 sn (%100 hız veya %50 slow-motion).
*   **Hızlı Kısım (Transition Peak):** ~0.1 sn - 0.2 sn (3 ila 6 kare, %600 - %1000 hız).
*   **Eğri Şekli (S-Curve / Bezier):** Hızlı ivmelenme (Ease-In), anlık tepe noktası, yumuşak yavaşlama (Ease-Out).
*   **Toplam Geçiş Süresi:** ortalama 0.3 - 0.5 saniye.

---

### 4. Yazı / Grafik Kullanımı

*   **Tip:** Minimalist, büyük, modern tipografi ("WAIT", "SUBSCRIBE").
*   **Konum:** Video başında ekranı kaplayan ancak 1 saniyeden az kalan glitch/zoom efektli metin.
*   **Görüntü Kaplama:** Görüntünün detaylarını engellemez; hızlı vurup kaybolur, odağı araca yönlendirir.

---

### 5. Çekim Tarafı Gereksinimleri

*   **Gimbal/Kamera Hareketi:** Çekimler sabit değil; sürekli ileri zoom, hızlı sağa/sola pan veya nesneye yaklaşma içerir.
*   **Yön Uyumluğu:** Bir klibin bitiş hareketi (örn. sağa pan) sonraki klibin başlangıç hareketiyle aynı yönde olmalıdır.
*   **Yüksek Kare Hızı (FPS):** Min. 60 FPS / 120 FPS çekim yapılarak hız rampalarındaki yavaş kısımların takılmaması sağlanır.

---

### 6. FFmpeg / GSAP (HyperFrames) Teknik Parametreleri

*   **Hız Rampası (FFmpeg setpts):**
    `setpts='if(gt(TN,1), if(gt(TN,1.2), PTS-STARTPTS, (PTS-STARTPTS)*0.15), (PTS-STARTPTS))'`
*   **Motion Blur (FFmpeg tblend):**
    `tblend=all_mode=average,framestep=2`
*   **GSAP Scale/Zoom Transition:**
    `gsap.to(target, { duration: 0.2, scale: 1.5, ease: "power4.inOut" });`
*   **Masking (GSAP clipPath / CSS):**
    `clipPath: 'inset(0% 0% 0% 0%)' -> 'inset(0% 0% 0% 100%)'` (0.2s, `power2.in`)

---

### 7. EMLAĞA TAŞINABİLECEK 10 TEKNİK

1.  **Kapı Kasasından İçinden Geçiş (Through Transition):** Dış çekimden salona geçerken kapı kasası kullanılarak dikişsiz geçiş.
2.  **Mutfak Tezgahı Eşleşmeli Kesme (Match Cut):** Mutfak adasından banyo tezgahına aynı açıyla hızlı geçiş.
3.  **Hızlı Bölüm Geçiş Rampası (%100→%800→%100):** Koridordan odaya geçerken koridor kısmını hızlandırıp odada duraklama.
4.  **Pencere Manzara Maskeleme:** Salon çekiminden pencereye yaklaşarak balkona/manzaraya yumuşak geçiş.
5.  **Dikey Pan ile Kat Geçişleri:** Merdivenlerden üst kata çıkarken dikey whip pan hareketiyle geçiş.
6.  **Işık/Flaş Senkronizasyonu:** Spot ışıkları veya avize detaylarında müzik ritmine uygun hafif flaş/parlama kesmeleri.
7.  **Detay-Geniş Açı Match Cut:** Musluk/priz gibi lüks detaylardan anında odanın genel geniş açısına ivmeli zoom geçişi.
8.  **Kolon / Duvar Arkası Maskeleme:** Açık plan mimaride bir kolunun arkasından geçerek diğer yaşam alanını gösterme.
9.  **Minimalist Ritmik Yazılar:** Oda metrekareleri veya özellikleri gösterirken hızlı zoom/glitch font kullanımı.
10. **Gimbal İleri İtme (Push-in) Rampası:** Dış cepheden binaya yaklaşırken hız rampası ile ana kapıya dikişsiz bağlanma.
