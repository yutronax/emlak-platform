# https://www.youtube.com/watch?v=jmUAhP3-Dx8 — Gemini (gemini-3.5-flash) analizi

### 1. Zaman Çizelgesi ve Kurgu Analizi

*   **[00:00 - 00:01] Sabit Duruş & Başlangıç (Hard Cut)**
    *   **Tür:** Standart Giriş / Ses Tetiklemeli Başlangıç.
    *   **Yapılış:** Araba sabit durur (%100 hız). Motor sesi yükseldiği anda arka spoiler kalkar ve patlama/egzoz sesiyle hızlı rampaya girer.
*   **[00:01 - 00:03] Hız Rampası & Duman Efekti (Speed Ramp + Motion Blur)**
    *   **Tür:** Hız Rampası (Speed Ramp).
    *   **Yapılış:** Hız eğrisi %100 → %300 → %100. İki kare arasında akselerasyon ve duman patlamasıyla dinamizm sağlanır. Kamera hareketi sabittir, hareket arabaya aittir.
*   **[00:03 - 00:05] Uzaklaşma & Tipografi Girişi (Motion Tracked Text / Lower Third)**
    *   **Tür:** Kaybolma / Metin Animasyonu (Text Overlay).
    *   **Yapılış:** Araba uzaklaşırken alt sol/sağ köşelerde dinamik glitch/strobe efektli metin grafikler belirir. Görüntüyü kapatmaz, alt 1/3'lük alanda kalır.

---

### 2. "İçinden Geçme" ve Obje Geçişleri

*   **Maske/Kamera Tekniği:** Kamera sabit dururken arabanın çıkardığı yoğun duman (smoke mask) ekranı kaplayarak doğal bir geçiş/katman oluşturur.
*   **Uygulama:** Obje veya duman kadrajı doldurduğunda Alfa Maske (Opacity Mask) kullanılarak alt katmandaki yeni sahneye yumuşak geçiş sağlanır.

---

### 3. Hız Rampası Deseni

*   **Yavaş Kısım:** 0.5 sn (%100 hız - duruş/başlangıç).
*   **Hızlı Kısım:** 1.2 sn (%300 - %500 hız - patlama ve ivmelenme).
*   **Eğri Şekli (Ease In/Out):** *Fast In - Exponential Out* (Hızlı başlayıp yumuşak yavaşlayan eğri).
*   **Toplam Süre:** ~2 saniye periyotlar.

---

### 4. Metin ve Grafik Kullanımı

*   **Konum:** Ekranın alt sol ve sağ köşeleri (Lower Thirds).
*   **Kullanım:** Odak noktası olan arabanın/yolun önünü kapatmaz. Tipografi hızlı stüdyo/glitch animasyonu ile ses ritmine uyumlu şekilde belirir.

---

### 5. Çekim Teknikleri

*   **Kamera:** Sabit gimbal veya tripod.
*   **Işık & Yüzey:** Islak asfalt (yansımaları artırmak için), kırmızı stop lambalarının ıslak zeminde yarattığı yüksek kontrastlı renk doygunluğu.
*   **Aksiyon:** Araç tekerlek döndürme (burnout) ile duman çıkararak kadrajdan uzaklaşır.

---

### 6. FFmpeg ve Parametre Yapılandırması

#### Hız Rampası (FFmpeg)
```bash
ffmpeg -i input.mp4 -filter_complex "[0:v]setpts='if(gt(TN,1),if(gt(TN,3),PTS-1/TB,1+(PTS-1/TB)*0.3),PTS)'[v]" -map "[v]" output.mp4
```

#### GSAP Animasyon (HTML5/HyperFrames)
```javascript
gsap.timeline()
  .to(".clip", { duration: 0.3, scale: 1.1, ease: "power2.in" })
  .to(".clip", { duration: 0.8, scale: 1.0, ease: "power4.out" })
  .from(".text-overlay", { duration: 0.2, opacity: 0, y: 20 }, "-=0.4");
```

---

### EMLAĞA TAŞINABİLECEK 10 TEKNİK

1.  **Dramatik Ses Senkronu:** Dış çekimden iç mekana geçerken kapı açılma sesini müzik vuruşuyla eşleştirin.
2.  **Yansıma ve Islak Zemin Etkisi:** Havuz başı veya teras çekimlerinde zemini hafif ıslatarak ışık yansımalarını artırın.
3.  **Hız Rampalı Koridor Geçişleri:** Uzun koridorlarda hızlı giriş (%400) yapıp salona girerken aniden yavaşlayın (%100).
4.  **Doğal Duman/Perde Maskeleme:** Pencere perdesi veya kolondan geçerken kesme yapıp diğer odaya geçin (Mask Transition).
5.  **Alt 1/3 Minimalist Grafik:** Metrekare ve oda bilgilerini görüntüyü kapatmayacak şekilde alt köşelere yerleştirin.
6.  **Işık Patlaması (Flash Cut):** Karanlık antreden aydınlık salona geçerken 2 karelik beyaz flaş/ışık patlaması ekleyin.
7.  **Dinamik Stop Lambası / Detay Vurgusu:** Mutfak tezgahı, şömine veya akıllı ev paneli gibi detayları ani zoom ve ses efektiyle vurgulayın.
8.  **Match Cut (Eşleşmeli Kesim):** Bir odadaki pencere açısıyla diğer odadaki pencere açısını aynı hizada birleştirin.
9.  **Bas/Motor Etkili Ses Tasarımı (Sub-bass Rumbles):** Geniş lüks alanlar gösterilirken alçak frekanslı (sub-bass) ses efektleri kullanarak ihtişam hissi yaratın.
10. **Hızlı Kapanış Cingle'ı:** Videoyu mülkün dış cephe gece çekimi ve hızlı bir hız rampası eşliğinde logo gösterimiyle bitirin.
