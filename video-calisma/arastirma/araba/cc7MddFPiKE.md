# https://www.youtube.com/watch?v=cc7MddFPiKE — Gemini (gemini-3.5-flash) analizi

İşte bu dinamik araba kurgusunun (editi) tersine mühendislik analizi ve tekniklerin emlak videolarına uyarlanması:

---

### 1. Zaman Çizelgesi ve Geçiş Analizi

*   **[00:04] Dikey Whip / Zoom Cut:** Animasyondan gerçek araç çekimine hızlı dikey kaydırma ve zoom ile geçiş. Müzik vuruşuna tam senkron.
*   **[00:09] Whip Pan (Kamçı Geçiş):** Soldan sağa hızlı kamera savurması. Hız eğrisi: %100 → %600 → %100 (4 kare bulanıklık). Kamera hareketi çekim anında eşleşiyor.
*   **[00:14] Flaş / Beat Cut:** Siyahtan otomobilin arka detayına geçiş. Flaş efekti + müzik bas vurumu.
*   **[00:20] Pop-Out / Mini Car Match Cut:** Ön ızgaradan çıkan 3D mini araba görseli üzerinden gerçek araç çekimine kesim.
*   **[00:27] Logo / Text Wipe:** Logo yazısından hızlı siyah ekran geçişi, ardından %800 hız rampasıyla giren araba.
*   **[00:43] Maske Geçişi (Yerden Yukarı):** Kamera zemindeki karolardan yukarı kalkarken nesne/zemin maskesiyle Dodge Challenger'a geçiş.
*   **[01:03] Köpük/Yıkama Flaş Kesim:** Araç yıkama köpük sahnesinden hızlı ön/arka açı değişimleri. Basa duyarlı 2 karelik beyaz flaşlar.
*   **[01:14] Ekran İçi Zoom (Scanner Effect):** Çizim taraç ekranındaki araç resmine hızlı optik zoom (%100 → %500) yapılarak gerçek sahneye girilmesi.
*   **[01:28] Gün Batımı Match Cut:** Aracın duruş açısı bozulmadan ön görünümden arka görünüme 1 karelik eşleşmeli kesim (Match Cut).
*   **[01:43] Çoklu Kutu / Slice Transition:** Araçların üst üste dikey dilimler halinde sahneye girmesi (Slice wipe).
*   **[02:02] Meme / Karakter Maskeleme:** Konuşan karakter sahnesinden aracın ön panjuruna maske takibiyle yumuşak geçiş.
*   **[02:18] Far Eşleşmeli Kesim (Headlight Match Cut):** Beyaz ve kırmızı araçların farları aynı noktaya hizalanıp ritme göre hızla değiştiriliyor.
*   **[02:41] İç Mekan - Dış Mekan Pop-Up:** Direksiyondan M5 CS eşik logosuna, oradan dikey hız rampasıyla dairesel araç sürüşüne geçiş.
*   **[03:07] Dikey Dilim Geçişi (Vertical Bar Wipe):** Porsche 911 sahnesinde soldan sağa kayan dikey şeritlerle sahne değişimi.
*   **[03:39] Yanma / Alev Efekti Maskesi (Dissolve Glow):** Ferrari sahnesinde alev efektiyle araç hatlarının ortaya çıkması.
*   **[04:22] 4'lü Izgara (Grid) / Tam Ekran:** 4 farklı açı aynı anda ekranda, bas vurumuyla ana açıya hızlı zoom-in.
*   **[04:51] Siyah-Beyaz Strobe Cut:** Kaput önündeki kişiden motor alanına ritmik siyah-beyaz ve flaş kesimler.
*   **[05:52] Su Sıçratma Whip Pan:** Suda kayan aracın çıkardığı sudan güç alan hızlı yönlü bulanıklık (Motion Blur) geçişi.

---

### 2. "İçinden Geçme" (Pass-Through) Teknikleri (Adım Adım)

1.  **Işık/Panjur İçinden Geçiş ([01:14]):**
    *   *Adım 1:* Taraç ekranı merkezine dikey hizalama yapılır.
    *   *Adım 2:* Ekrandaki araç görselinin ölçeği (Scale) %100'den %1000'e hızlıca büyütülür (Ease-in).
    *   *Adım 3:* Ölçek %800'e ulaştığında gerçek araç çekimine yumuşak geçiş (Cross Dissolve / Mask) yapılır.
2.  **Zemin / Nesne Arkasından Geçiş ([00:43]):**
    *   *Adım 1:* Kamera aşağı dikey eğilir (Tilt down) ve zemin kadrajı kaplar.
    *   *Adım 2:* Zemin dokusunun üzerinden geçen çizgi boyunca vektörel maske (Pen tool) çizilir.
    *   *Adım 3:* Maske hareket ettikçe alttaki yeni araç sahnesi ortaya çıkar.

---

### 3. Hız Rampalarının Ortak Deseni

*   **Yavaş Kısım:** %100 veya %70 (Süre: 0.8 sn – 1.2 sn) — Aracın/detayın sergilendiği an.
*   **Hızlı Kısım (Rampa):** %600 ile %1200 arası (Süre: 0.15 sn – 0.3 sn / 4-8 kare).
*   **Eğri Şekli (Easing):** S-Curve (Exponential Ease-In / Ease-Out). Giriş yavaş, geçiş anı aşırı hızlı, çıkış tekrar yavaş.
*   **Toplam Geçiş Süresi:** Ortalama 0.3 - 0.5 saniye.

---

### 4. Yazı ve Grafik Kullanımı

*   **Yerleşim:** Ekranın alt-orta kısmında sabitleşmiş küçük fontlar (`Bmw B2`, editör imzaları).
*   **Tipografi:** Tipik "Cyberpunk" veya "Phonk" tarzı sert, grotesk/gothic sans-serif fontlar.
*   **Görüntü Kaplama:** Yazılar ana odağı kesmez, transparanlık %80 veya kısa süreli merkez tam opak (örn. [01:49] "FENDI"). Ritimle birlikte yanıp söner.

---

### 5. Çekim Tarafı (Kamera Hareketleri)

*   **Hızlı Kamçı (Whip):** Gimbal pan ekseni serbest bırakılarak çekim sonunda sağa/sola çok hızlı savrulur. Sonraki çekim aynı yönde başlar.
*   **Yaklaşma (Push-in):** Gimbal ile objeye (fara, logosuna) hızla koşarak yaklaşılır.
*   **Açı Eşleme:** Arka arkaya gelecek araçların kadrajdaki oranları ve açıları (3/4 ön açı vb.) birebir aynı tutulur.

---

### 6. Yeniden Üretim İçin Somut Parametreler

#### FFmpeg ile Hız Rampası ve Motion Blur
```bash
# 0-1sn normal, 1-1.3sn %800 hızlı, 1.3-2.5sn normal + Motion Blur
ffmpeg -i input.mp4 -filter_complex \
"[0:v]trim=0:1,setpts=PTS-STARTPTS[v1]; \
 [0:v]trim=1:1.3,setpts=0.125*(PTS-STARTPTS),tblend=all_mode=average[v2]; \
 [0:v]trim=1.3:2.5,setpts=PTS-STARTPTS[v3]; \
 [v1][v2][v3]concat=n=3:v=1:a=0[outv]" -map "[outv]" output.mp4
```

#### GSAP / HTML Animasyon (Zoom & Flash Transition)
```javascript
// Ritim Vuruşunda Zoom ve Flaş
const tl = gsap.timeline();
tl.to(".video-container", { scale: 1.15, duration: 0.08, ease: "power4.in" })
  .to(".flash-overlay", { opacity: 0.8, duration: 0.04 }, "<")
  .to(".video-container", { scale: 1.0, duration: 0.2, ease: "power2.out" })
  .to(".flash-overlay", { opacity: 0, duration: 0.15 }, "<");
```

---

### EMLAĞA TAŞINABİLECEK 10 TEKNİK

1.  **Dış Cepheden Salona Pencereli Maske Geçişi:** Dışarıdan pencereli çekimden pencere çerçevesi içine zoom yapılarak salonun içine "içinden geçme" tekniğiyle girilmesi.
2.  **Mutfak Tezgahı Hız Rampası:** Tezgah üzerindeki detaylarda (musluk, kahve makinesi) yavaş (%70), dolap kapaklarına geçerken aşırı hızlı (%800) geçiş.
3.  **Kapı Açılış Flaş Kesimi:** Dış kapının koluna yaklaşma + kapı açıldığı an müzik vurumuyla birlikte 2 karelik beyaz flaşla koridora geçiş.
4.  **Far Eşleşmesi Yanılsaması → Spot Işık Eşleşmesi:** Salondaki sarkıt lambadan banyodaki aynalı spot ışığa birebir kadraj eşleşmeli kesim (Match Cut).
5.  **Parke / Halı Yönlü Whip Pan:** Koridorda yürürken kamerayı yere savurup (Whip) diğer odanın zemininden yukarı doğru açılış yapmak.
6.  **Ritmik Detay Izgarası (Grid View):** Evin 4 farklı lüks detayını (akıllı ev paneli, şömine, jakuzi, manzara) ritimle eşleşen 4’lü ekranda sunup ana odaya zoom yapmak.
7.  **Manzara Kolon Maskeleme:** Balkondaki kolunun arkasından geçerken maske kullanarak manzara açısını gün batımı moduna değiştirmek.
8.  **Kat Planı Pop-Out (Mini Map):** Videonun köşesinde 3D kat planının belirmesi ve gezilen odaya geçildikçe plan üzerinde o odanın parlaması.
9.  **Gece/Gündüz Match Cut:** Aynı açıdan çekilmiş gündüz salon çekiminden ritm vurumuyla anında gece aydınlatmalı salona geçiş.
10. **Cinematic Sound Design (Egzoz Yerine Mimari Sesler):** Araba videolarındaki agresif bass/akustik efektleri; mimari ahşap gıcırtısı, kilit sesi, su akışı ve yüksek kaliteli ambiyans baslarıyla harmanlama.
