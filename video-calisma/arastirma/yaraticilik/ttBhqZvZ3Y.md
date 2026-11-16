# https://www.youtube.com/watch?v=-ttBhqZvZ3Y — Gemini (gemini-3.5-flash) analizi

İşte izlenen videonun kurgu, teknik ve stratejik analizi:

---

### 1. Zaman Çizelgesi ve Kurgu Analizi

> **Not:** Paylaşılan video bir emlak tanıtım videosu değil; bir içerik üreticisinin videosudur (*"Signature Style Builder"*).

- **00:00 - 00:06 (Giriş / Hook)**: 
  - **Tür**: Dinamik Tipografi + Görsel Pop-up Overlay.
  - **Teknik**: Müzik ritmine senkronize metin katmanları, %100 $\rightarrow$ %110 ani ölçek değişimleri (punch-in cut).
- **00:06 - 11:30 (A-Roll Konuşan Kafa)**:
  - **Tür**: Konuşan kafa kurgusu, dinamik ölçek sıçramaları (Jump cut / Punch-in).
  - **Teknik**: Konuşmadaki vurgu noktalarında %100 ölçekten %112 ölçeğe kesme (1 karelik değişim). Motion blur yok, sert kesme.
- **11:30 - 23:07 (B-Roll & Ekran Kaydı Sunumu)**:
  - **Tür**: PiP (Picture-in-Picture) ve daire maskeli konuşan kafa overlay.
  - **Teknik**: Sol altta `Circle Crop` (yumuşak kenar/feather: 5px) konuşan kafa, sağda web uygulaması ekran kaydı.
- **23:08 - 24:08 (Kapanış & Veda)**:
  - **Tür**: A-Roll'a dönüş, imza el hareketi ve kapanış.

---

### 2. "İçinden Geçme" ve Maske Geçişleri

- Videoda mekanlar arası fiziksel içinden geçme geçişi yoktur.
- **Daire Maske (Circle Mask Overlay)**: Konuşan kafa ekran kaydı üzerine sol alt köşeye %20 boyutunda yuvarlak maske ile yerleştirilmiştir.

---

### 3. Hız Rampası ve Geçiş Deseni

- **Punch-In Zoom**: Konuşmanın temposunu korumak için 4-8 saniyede bir %100 $\rightarrow$ %112 ölçek sıçraması.
- **Geçiş Süresi**: 0 kare (sert kesme / hard cut).

---

### 4. Yazı ve Grafik (Typography / Motion)

- **Düzen**: Alt kısımda ekranı kapatmayan minimal alt yazılar.
- **Fontlar**: Sans-serif (`Switzer`, `Dominate`) ve el yazısı (`Addentina Script`).
- **Renkler**: Mat turuncu, koyu yeşil ve kirli beyaz vurgular.

---

### 5. Çekim Tarafı ve Prodüksiyon

- **Kamera & LENS**: Sony A7 serisi, geniş diyafram (f/1.8 - f/2.8) ile sığ alan derinliği.
- **Işık**: Yumuşak ana ışık (Key light) + yeşil bitkilerle desteklenmiş sıcak arka plan ışıkları.
- **Ses**: Shure SM7B mikrofon, dolgun bas ve doğal tiz dengesi.

---

### 6. Yeniden Üretim İçin Teknik Parametreler (Preset / Code)

- **Punch-In Zoom**:
  - `Scale`: %100 $\rightarrow$ %112 (Sert kesme)
- **Overlay Maske**:
  - `Crop`: Circle (%20 W/H)
  - `Position`: Sol alt ($X: 15\%, Y: 80\%$)
  - `Feather`: 5px

---

### EMLAK VE İÇERİK VİDEOLARINDA YARATICILIĞI SÜREKLİ YENİLEMEK İÇİN 8 SOMUT KURAL

1. **Eksiltici Stil Anlayışı**: Çok fazla efekt eklemek yerine az sayıda seçeneği tekrarlayarak tutarlı bir imza oluşturun.
2. **Moodboard İle Başlayın**: Kurguya girmeden önce renk, font ve B-Roll referanslarınızı görsel bir panoda toplayın.
3. **Tipografi Hiyerarşisi Oluşturun**: En fazla 2-3 uyumlu font seçin (Başlık, vurgu ve alt yazı için).
4. **Sabit Renk Paleti (LUT) Kullanın**: Markanızı temsil eden ana renkleri ve tonlamaları her videoda koruyun.
5. **Ses İmzası Belirleyin**: Geçişler ve vurgular için karakteristik ses efektleri (Riser, Flash SFX, Tonal Hit) seçin.
6. **Ritmi Değiştirin**: Sabit süreler yerine kurgu temposunu müziğin vuruşlarına göre dinamik olarak ayarlayın.
7. **İmza Açılış (Hook) Tekniği**: Videonun ilk 3 saniyesinde izleyicinin hemen tanıyacağı standart bir giriş hareketi kullanın.
8. **Şablonlaştırarak Zaman Kazanın**: Doğaçlama yapmak yerine önceden hazırlanmış preset ve şablon sistemleriyle üretim süresini kısaltın.
