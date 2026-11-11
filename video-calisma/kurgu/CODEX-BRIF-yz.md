# Codex görevi: Şablon 11 — yapay zekâ destekli ilan videosu (baştan sona sen yap)

Kullanıcı: "Şimdiki akımlarda biraz yapay zekâ desteği koyuyorlar." Bu şablonun TAMAMINI sen yap; soru sorma,
kararlarını raporda gerekçelendir. Çalışma klasörü: `video-calisma/`. Proje: `kurgu/projeler/yz/` (adı istersen
değiştir, ama klasör/dosya adlarını raporda yaz).

## Yapay zekâ bileşenleri
1. **Sanal döşeme (senin görsel üretim/düzenleme aracınla):** Gerçek boş oda fotoğraflarını döşe. Örnek başarılı iş:
   `varliklar/yz/salon_doseli.png` (kaynak `capcut/medya2/salon.jpg`) — duvar, pencere, kapı, tavan, zemin, ışık,
   kamera açısı, boru/kablo, dolap AYNEN korundu; yalnız mobilya + dekor eklendi; sıcak, modern, aydınlık Türk ailesi evi,
   gerçekçi, abartısız. Aynı kuralla en az 2 oda daha döşe (ör. `capcut/medya2/oda1.jpg` veya `oda2.jpg` yatak odası,
   `balkon.jpg` balkon oturma köşesi). Tezgahsız mutfağı DÖŞEME (tezgah yapı unsuru; eklemek yanıltıcı olur).
   Her üretimden sonra orijinalle yan yana karşılaştırma görüntüsü çıkarıp AÇ ve kontrol et: pencere/kapı/duvar
   değişmişse yeniden üret. Çıktılar `varliklar/yz/<oda>_doseli.png`.
2. **Türkçe yapay zekâ seslendirme:** `kurgu/yz_ses.py <cikti.wav> "<metin>" [ses]` (Gemini TTS; `GEMINI_API_KEY`
   ortamda). Kısa, sıcak, abartısız metin yaz (≈ 15–20 sn); uydurma özellik/ölçü/fiyat söyleme — yalnız görüntüde
   görüneni ve "sanal döşeme fikir vermek içindir" gibi dürüst bir cümleyi söyle. Müziği konuşma altında 0.15–0.25'e indir.
   Seslendirmeye uyumlu kelime kelime altyazı (zamanlamayı ffmpeg `silencedetect` ya da HyperFrames transcript ile çıkar;
   transcript yoksa cümle bazlı zamanla).
3. **Etiket (zorunlu, dürüstlük):** Döşenmiş her karede okunur bir etiket: "Yapay zekâ ile sanal döşeme · temsilidir".
   Kapanışta: "Seslendirme ve döşeme yapay zekâ ile üretildi." Kullanıcı yanıltıcı içerik istemez; ilan siteleri de bunu ister.

## Görsel dil (önceki şablonları TEKRARLAMA)
`kurgu/SABLONLAR.md` ve `kurgu/TEKNIK-HAVUZU.md`'yi oku. Eşik şablonu ham/renk karşılaştırması için düz bir
**önce/sonra kaydırıcı** kullandı — bunu aynen tekrarlama. Döşemenin ortaya çıkışı için yeni bir dil bul, ör.:
boş odada ışık süpürmesiyle mobilyanın "belirmesi" (maske + parlama), boş → döşeli arasında kamera itmesiyle eşleşen
çözülme, nesne nesne beliren katmanlar (katman ayırma yoksa maske dairesel/ışık yayılımı), "fikir" defteri gibi değil.
HyperFrames katalog (`npx --yes hyperframes@0.9.11 catalog --json`) ve örnek projeler: `kurgu/projeler/galeri`,
`plan`, `esik` (WebGL, maske, SVG örnekleri).

## Ortam
PATH'te node, npx, ffmpeg, ffprobe; Python `.venv-capcut\Scripts\python.exe -X utf8`; `HYPERFRAMES_BROWSER_PATH`
ve `GEMINI_API_KEY` ortamda (anahtarı ASLA yazdırma). Klip hazırlığı `kurgu/kur.py` → `klip_hazirla` (`sabitle=True`).
Marka: `marka/inza-logo-saydam.png`, `varliklar/font/BebasNeue-Regular.ttf`, altın #F2B526, lacivert #16213E.
Müzik `muzik/luxury-real-estate.mp3`. Proje iskeleti `hyperframes/ilan/` (package.json, hyperframes.json, AGENTS.md, CLAUDE.md).
Komutlar: `npx --yes hyperframes@0.9.11 check | snapshot | render -o ...`.

## Dersler (tekrarlama)
- Dosyaları PowerShell Set-Content/Out-File ile YAZMA (Türkçe bozulur) → Python UTF-8. Satır içi `python -c` yok.
- **Her turun kaynağını yedekle** (`index-turN.html.bak`) ve render'ını `cikti/<ad>-turN.mp4` olarak sakla.
  Eşik'te tur 3–4 puanı düşürdü; **en iyi turu** teslim et.
- **Hedef tutunca gereksiz tur açma.** Kanca: ilk 1 sn hareketli ve dolu.
- Render `VIDEO_EXTRACTION_FAILED/ffmpeg_timeout` → klipleri kısa tut, 30 fps, `-preset fast -g 30` ile yeniden kodla.

## Kurallar (ihlal = başarısız)
1080×1920 30 fps · yazı güvenli alanı x 72–930, y 220–1440 · z-index katmanları (medya 10 · ton 20 · grafik 30–40 ·
yazı 50 · marka 60 · efekt 70) · ilk kare kapak · yazı ≥ 0.5 + 0.3×kelime sn, kapanış ≥ 2 sn · left/top/width/height
animasyonu yok · deterministik · fiyat/m²/telefon UYDURMA (MOCK yer tutucu) · başka projelere dokunma.

## Kalite döngüsü (en az 2, en çok 4 tur)
check (0 hata; `nested_structure` hariç uyarıları düzelt) → snapshot + contact sheet'i AÇ ve bak → render →
`izlet.py cikti/<ad>-turN.mp4 "<bağlam; yenilik ve yapay zekâ kullanımının dürüstlüğünü ayrıca puanla>"` →
düzelt. Hedef: Gemini genel ≥ 9.0, yenilik ≥ 9.0.

## Teslim
En iyi tur → `cikti/<ad>-ornek.mp4` + `cikti/<ad>-ornek-telefon.mp4` (720p crf 26). `cikti/<ad>-ornek-RAPOR.md`
(UTF-8): yapay zekâ üretimleri listesi (oda, kaynak, çıktı, kaç deneme), seslendirme metni, turlar/puanlar tablosu,
hangi turun seçildiği ve neden, kontrol listesi, MOCK alanlar, riskler (yapay zekâ kaynaklı yanıltma riski dahil).
`kurgu/SABLONLAR.md`'ye "Şablon 11 — <ad>" bölümü; `TEKNIK-HAVUZU.md`'ye yeni teknikleri ekle. Son mesaj Türkçe, kısa.
