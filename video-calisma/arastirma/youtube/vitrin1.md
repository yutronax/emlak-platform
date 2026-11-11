# https://www.youtube.com/watch?v=aO_kPW39um8 — Gemini (gemini-3.5-flash) analizi

İşte videodaki kurgu ve motion grafik tekniklerinin tersine mühendislik analizi:

---

### 1. Zaman Çizelgesi & Geçiş Analizi

*   **00:00 - 00:05 | Giriş:** Sabit/yavaş pan çekimleri, logo ve adres alt bant metinleri (Hızlı/sert kesmeler, %100 sabit hız).
*   **00:06 - 00:07 | Dış Cephe → İç Mekan:** **Zoom In + Speed Ramp** (%100 → %600 → %100). Ön cepheden mutfak adasına hızlı giriş. Müzik vuruşuna tam oturur.
*   **00:11 - 00:13 | Mutfak Geniş → Ada/Tezgah:** **Whip Pan (Hızlı Pan) + Speed Ramp**. Sağa doğru hızlı hareket bulanıklığı (motion blur).
*   **00:17 - 00:19 | Salon → Havadan Çekim:** **Wipe / Zoom Out Transition**. Odadan havadan mahalle görüntüsüne hızlı geçiş.
*   **00:24 - 00:26 | Yaprak Maskesi → Bahçe/Veranda:** **Foreground Masking (Ön Plan Maskesi)**. Yaprakların arasından dış mekana geçiş.
*   **00:31 - 00:33 | Banyo → Koridor/Merdiven:** **Through Wall/Door Frame (Kapı/Duvar İçinden Geçiş)**. Kapı kasası ekranı kapladığı anda kesme/maske geçişi.
*   **00:44 - 00:46 | Merdiven → Mutfak → Veranda:** **Chain Speed Ramp (Zincirleme Hız Rampası)**. Merdivenden aşağı hızlı iniş, mutfağa ve ardından dış verandaya kesintisiz zoom/pan geçişleri (%100 → %800 → %100).
*   **00:50 - 00:52 | Havuz Yanı → Yan Yolu (Depo Arkası):** **Object Occlusion / Masking Transition**. Depo paneli kameranın önünü kapatır, nesne arkasında diğer çekim açılır.
*   **00:54 - 00:56 | Dış Mekan → İç Mekan:** **Fast Spin / Whip Zoom**. Dışarıdan salona hızlı dönerek zoom geçişi.

---

### 2. "İçinden Geçme" (Pass-Through) Geçişleri (Adım Adım)

1.  **Duvar/Kapı Maskesi (00:32 & 00:51):**
    *   *Adım 1:* Çekim A'da kamera nesneye (kapı kenarı veya panel) iyice yaklaşır, nesne tüm kadrajı karartır/kapatır.
    *   *Adım 2:* Çekim B aynı hareket yönünde (soldan sağa veya ileri) başlar.
    *   *Adım 3:* Geçiş noktasına dikey maske uygulanarak veya nesnenin ekranı %100 kapladığı karede sert kesme yapılarak kesintisiz geçiş sağlanır.

2.  **Ön Plan Yaprak/Bitişik Nesne (00:24):**
    *   *Adım 1:* Ön plandaki bulanık nesneler (ağaç dalları) kameranın önünden geçer.
    *   *Adım 2:* Hareket bulanıklığı tepe noktaya ulaştığında sonraki çekim ile birleştirilir.

---

### 3. Hız Rampası (Speed Ramp) Deseni

*   **Normal Hız (%100):** ~1.0 - 1.5 saniye (Odaklanılan alan).
*   **Hızlanma Eğrisi (%100 → %800):** 4 - 6 kare (Exponential In / Ease In).
*   **Hızlı Geçiş (%800):** 2 - 4 kare.
*   **Yavaşlama Eğrisi (%800 → %100):** 4 - 6 kare (Exponential Out / Ease Out).
*   **Toplam Geçiş Süresi:** ~0.5 - 0.8 saniye.

---

### 4. Grafik ve Tipografi Kullanımı

*   **Yerleşim:** Temiz, minimalist, ortalanmış veya sol alt bant.
*   **Yazı Tipi:** Modern Sans-Serif, beyaz renk, yüksek harf arası boşluk (tracking).
*   **Görüntü Kaplama:** Minimal. Kadrajın merkezini veya alt tarafını az miktarda kaplar, mekanı gölgelemez.

---

### 5. Çekim Teknikleri (Sette Yapılması Gerekenler)

*   **Gimbal Kullanımı:** Tüm geçişlerde akıcı, sarsıntısız lineer veya dairesel hareket şarttır.
*   **Yön Uyumu:** Bir sonraki çekime geçmeden önce gimbal hızla ileri sürülür veya sağa/sola pan yaptırılır (Whip Pan).
*   **Ön Plan Nesneleri:** Geçiş noktaları için kapı kasaları, sütunlar, bitkiler ön plan engeli olarak bilinçli şekilde kadrajlanır.

---

### 6. FFmpeg / GSAP Kurgu Parametreleri

#### A. FFmpeg ile Speed Ramp & Blur Simülasyonu
```bash
# Hız rampası ve hareket bulanıklığı (0.5s geçiş)
ffmpeg -i input.mp4 -filter_complex \
"[0:v]trim=start=0:end=1,setpts=PTS-STARTPTS[v1]; \
 [0:v]trim=start=1:end=1.5,setpts=0.125*(PTS-STARTPTS),tblend=all_mode=average[v2]; \
 [0:v]trim=start=1.5:end=3,setpts=PTS-STARTPTS[v3]; \
 [v1][v2][v3]concat=n=3:v=1:a=0[outv]" -map "[outv]" output.mp4
```

#### B. GSAP / HyperFrames Örnek Geçiş Parametreleri
*   **Duration:** `0.6s`
*   **Scale / Zoom In:** `1.0` -> `1.4` (Ease: `power2.inOut`)
*   **Motion Blur Amount:** `12px` (Transition merkezinde)
*   **Mask X Position:** `-100%` -> `100%` (Linear/EaseIn)
