# Codex görevi: Şablon 12 — "hareket" (yoğun motion grafik, baştan sona sen yap)

Kullanıcı: "Güzel olmuş ama artık hareketli animasyonlar yapalım." Önceki şablonlar fazla durağan/sunum gibi
algılanıyor. Bu şablonun ana karakteri HAREKET: motion graphics + kinetik tipografi + derinlikli kamera.
Soru sorma, kararlarını raporda gerekçelendir. Çalışma klasörü `video-calisma/`, proje `kurgu/projeler/hareket/`.

## Hareket hedefleri (hepsi zorunlu)
1. **Sürekli hareket:** Ekranda 0.5 sn'den uzun tamamen durağan an olmasın (her an en az bir öğe anlamlı hareket
   ediyor; titreme/rastgele değil, kompozisyona hizmet eden hareket).
2. **Kinetik tipografi:** Kelimeler vuruşta gelir; harf harf / kelime kelime farklı hareketler (yay, dönme, maske
   kayması, ölçek patlaması, karakter değişimi). Bir kelime bir sonrakine dönüşebilir (morph / swap).
3. **2.5D paralaks kamera:** En az 2 fotoğrafı ön/orta/arka katmanlara ayır (kendi görsel aracınla katman/maske
   üret ya da ffmpeg + elle maske; boşalan arka planı aracınla doldur), sonra katmanlara farklı hızda kamera
   hareketi (dolly, yörünge, yükselme) ver → gerçek derinlik hissi. Mimariyi değiştirme; dolgu yalnız gizli kalan
   kenarlar için.
4. **Çizgi animasyonu:** Oda ikonları / mimari çizgiler SVG ile çizilir, morph olur (ör. kapı ikonu → kapı açılır
   → sahne). Yol/iz animasyonu (motion path) en az bir kez.
5. **3D hareket:** Kart çevirme, perspektifli kayma ya da 3D kamera ile en az bir sahne.
6. **Müzik senkronu:** `npx --yes hyperframes@0.9.11 beats` ile vuruşları çıkar; kesimler ve tipografi vuruşlarda.
   Hareketlere uygun sentezlenmiş ses efektleri (swoosh, tık, pop — ffmpeg ile, lisanssız).
7. **Kolaylaştırma (easing):** Doğrusal hareket yok; overshoot, elastic, expo ile karakterli eğriler; hareketler
   birbirini devralsın (overlap / follow-through).

Kendi önceki işlerini (galeri, defter, tahmin, plan, eşik, yz) ve `kurgu/TEKNIK-HAVUZU.md`'deki ✓ teknikleri
TEKRARLAMA; HyperFrames kataloğunu tara (`npx --yes hyperframes@0.9.11 catalog --json`; ör. `kinetic-type-swap`,
`weight-wave`, `kinetic-center-build`, `arc-motion-path`, `camera-rig-depth-stack`, `transitions-3d`, `morph-text`,
`extended-keyframe`) — bloklar yatay 1920×1080, dikeye ve fotoğrafa uyarla.

## Ortam
PATH'te node, npx, ffmpeg, ffprobe; Python `.venv-capcut\Scripts\python.exe -X utf8`; `HYPERFRAMES_BROWSER_PATH`,
`GEMINI_API_KEY` ortamda (yazdırma). Medya `capcut/medya5/video*.mp4`, `capcut/medya2/*.jpg`, sanal döşemeler
`varliklar/yz/*_doseli.png` (kullanırsan "yapay zekâ ile sanal döşeme · temsilidir" etiketi zorunlu). Tezgahsız
mutfak / inşaat artığı / hortum görünen kareler yok. `kurgu/kur.py` → `klip_hazirla(... sabitle=True)`.
Marka: `marka/inza-logo-saydam.png`, `varliklar/font/BebasNeue-Regular.ttf`, altın #F2B526, lacivert #16213E.
Müzik `muzik/luxury-real-estate.mp3`. İskelet `hyperframes/ilan/`. Seslendirme gerekirse `kurgu/yz_ses.py`.

## Dersler
- PowerShell ile dosya yazma (Türkçe bozulur) → Python UTF-8; satır içi `python -c` yok.
- Her turun kaynağını `index-turN.html.bak`, render'ını `cikti/hareket-turN.mp4` olarak sakla; EN İYİ turu teslim et;
  hedef tutunca gereksiz tur açma.
- Kanca: ilk 1 sn hareketli ve dolu. left/top/width/height animasyonu yok (lint hatası, titrer) → transform.
- Çok hareket = okunurluk riski: her yazı ≥ 0.5 + 0.3×kelime sn okunur durumda kalmalı (hareket ederken de).
- Render `ffmpeg_timeout` → klipleri kısa tut, 30 fps, `-preset fast -g 30`.

## Kurallar
1080×1920 30 fps · yazı güvenli alanı x 72–930, y 220–1440 · z-index katmanları · ilk kare kapak · deterministik
(Math.random/Date yok; "rastgele" görünüm için sabit tohumlu formül) · fiyat/m²/telefon MOCK · başka projelere dokunma.

## Kalite döngüsü (en az 2, en çok 4 tur)
check (0 hata; `nested_structure` hariç uyarıları düzelt) → snapshot + contact sheet'i AÇ → render →
`izlet.py cikti/hareket-turN.mp4 "<bağlam; HAREKET/ANİMASYON kalitesini, akıcılığı ve yeniliği ayrıca puanla>"`.
Hedef: genel ≥ 9.0, yenilik ≥ 9.0, hareket/animasyon ≥ 9.0.

## Teslim
En iyi tur → `cikti/hareket-ornek.mp4`, `cikti/hareket-ornek-telefon.mp4` (720p crf 26), `cikti/hareket-ornek-RAPOR.md`
(UTF-8: hareket teknikleri listesi, katman ayırma yöntemi, turlar/puanlar, seçilen tur ve nedeni, kontrol listesi,
MOCK, riskler). `kurgu/SABLONLAR.md`'ye "Şablon 12 — hareket", `TEKNIK-HAVUZU.md`'ye yeni teknikler. Son mesaj Türkçe, kısa.
