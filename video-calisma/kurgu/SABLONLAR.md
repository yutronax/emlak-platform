# Kurgu şablon sistemi (İNZA Gayrimenkul & Yatırım)

Çalışma ortamı: **HyperFrames** (HTML + GSAP zaman çizelgesi → yerel mp4 render). Ajan doğrudan düzenler,
`check` yerleşim/kontrast/hareket hatalarını yakalar, `snapshot` kare önizler, mp4 Gemini'ye izletilir.
CapCut yalnızca son elle rötuş için. Motor: `kurgu/kur.py` (brif JSON → HyperFrames projesi → render).

## Ortak sistem (bütün şablonlar)

### Kanvas ve güvenli alan (1080×1920)
| Bölge | Değer | Neden |
|---|---|---|
| Üst güvenli boşluk | 220 px | durum çubuğu, Reels/Shorts üst ikonları |
| Alt güvenli boşluk | 440 px | açıklama metni, beğen/yorum/paylaş, ilerleme çubuğu |
| Sağ kenar | 150 px | Reels sağ ikon sütunu |
| Sol kenar | 72 px | |
| **Yazı bölgesi** | x 72–930, y 220–1480 | hiçbir yazı/altyazı bu dışa taşmaz |
| Altyazı bandı | alt kenarı **y ≤ 1440** | "ekranın dibine" asla |

Her çekimde `konu` (özne konumu: `ust`/`orta`/`alt`) verilir; altyazı öznenin **karşı** bölgesine yerleşir
(özne altta → altyazı üst bandda, y 300–620). Böylece yüz/ürün/CTA kapanmaz.

### Katman sırası (z-index, değişmez)
| z | Katman |
|---|---|
| 10 | Ana görüntü (video/foto) |
| 20 | Renk tonu / gölge gradyanı (okunurluk) |
| 30 | B-roll / ara görüntü / kart |
| 40 | Grafik (çizgi, şekil, sayaç) |
| 50 | Başlık ve altyazı |
| 60 | Marka (logo, filigran) |
| 70 | Efekt (ışık sızması, flaş, gren, vinyet) — `pointer-events:none`, yazıyı karartmaz |

### Tipografi ve renk
- Başlık: Bebas Neue, 120–150 px; altyazı/açıklama: Montserrat 600, **60–72 px** (telefonda okunur), en çok 2 satır,
  satır başı ~22 karakter; telefon/fiyat: Montserrat 800, 80+ px.
- Renk: mürekkep #FFFFFF, altın #F2B526 (vurgu, tek kelime), lacivert #16213E (kart zemini %88).
- Okunurluk: yazı altında her zaman ya lacivert kart ya alt/üst gradyan (z20); kontrast ≥ 4.5:1 (`check` doğrular).

### Ses
- Müzik −8 dB civarı (0.8), konuşma varsa −18 dB'e düşer (ducking); SFX: whoosh 0.35–0.5, vuruş 0.6–0.8.
- Kesimler müzik vuruşunda (135 BPM → 0.4497 sn); her şablonun kendi vuruş planı var.

### Kalite kapısı (her taslakta)
1. `npm run check` hatasız (lint, layout, contrast, motion).
2. Snapshot: her sahnenin ortası + her geçişin ortası; yazı güvenli bölgede mi, özne kapanıyor mu.
3. Render → `izlet.py` (Gemini sesli izler) → rapor.
4. Kontrol listesi: altyazı okunuyor mu · yanlış kesim · ritim · önemli alan kapanıyor mu · ses dengesi ·
   şablonun görsel dili korunuyor mu.
5. Emin olunmayan görsel kararda **A/B iki taslak**, fark raporda.

---

## Şablon 1 — `ilan_turu` (ürün/hizmet tanıtımı: ilan videosu)
- **Amaç:** tek bir ilanı 15–20 sn'de gezdirmek.
- **Giriş ritmi:** 0–1.8 sn en güçlü geniş açı + 2 satır başlık (özellik). Logo küçük, sağ üstte.
- **Kesme sıklığı:** 4 vuruş (1.8 sn) ana ritim; nefes planı 6 vuruş; toplam 6–8 plan.
- **Altyazı:** plan başına tek özellik ("Balkona açılan salon"), lacivert kart, 64 px, özne karşı bandında.
- **B-roll:** detay planı (banyo, mutfak dolabı) ana plan arasına 2 vuruşluk ara; bitmemiş/kirli kare yok.
- **Zoom/geçiş:** her planda yavaş itme (1.00→1.06); geçişler çoğunlukla düz kesim, yalnız mekân değişiminde
  0.25 sn kayma; en fazla bir ışık sızması.
- **Müzik/SFX:** müzik 0.8; whoosh yalnız mekân değişiminde 0.35.
- **Kapanış:** 4 sn: logo + fiyat (altın) + "YERİNDE GÖRÜN" + telefon, hepsi yazı bölgesinde.

- **Durum:** motorda uygulandı (`kur.py`). Varyant A (lacivert kart) seçildi — A/B testinde A 6.9, B 5.9;
  tur 2 sonrası A **8.5/10** (Gemini). Tur 2'de eklenen kurallar:
  - Başlık da altyazıyla aynı kart dilinde (tek tipografi sistemi).
  - Renk sıcak: colorbalance kırmızı +, mavi −, doygunluk 1.06 (boş daire soğuk/inşaat hissi vermesin).
  - Mekân değişimi = düz kesim + itmeden oturma (kayma geçişi "slayt gösterisi" gibi; kullanılmaz).
  - `kirp_ust` ile tavan kablosu/tesisat kadraj dışı; `parlak` ile karanlık oda eşitlenir.
  - Açılış 1.10→1.00 oturma (kanca hareketi), ilk kare kapaktır: siyahtan açılış yok, başlık 0. sn'de görünür.
  - Okuma süresi: yazı ekranda ≥ 0.5 + 0.3×kelime sn; motor gerekirse plana vuruş ekler.

- **Varyant C — hareketli** (kullanıcı: A "profesyonel ama biraz sıkıcı"; C tur 2 = **8.6/10**, kanca 8.8):
  - Açılış: en ferah dış/manzara planı + başlık kartı (bitmemiş iç mekânla açılmaz). Salon 2. plan.
  - Planlar 3–5 vuruş, aralarda 2 vuruşluk yazısız ara çekim (temiz detay/foto) — ritim yükselir, okunurluk korunur.
  - Velocity rampası (ffmpeg, kesintisiz): hedefin %25'i 2.5x → %50'si 0.6x → %25'i 2.5x; kaynak ≈ 1.55 × plan
    süresi ister (motor yetmezse durur). Rampa açılışta değil, mekân geçişlerinde.
  - Her kesimde "pull-in": blur 14px + parlaklık 1.25 → net, 0.28 sn; whoosh 0.3 her kesimde.
  - Kart girişi back.out(2.2) ile zıplar; iki ışık sızması (zıt yönlerden); kapanışa tek beyaz flaş.
  - `kirp_alt` ile alt kusur (balkon demirleri) kırpılır; fiyat 160 px.

## Şablon 6 — `galeri` (editoryal; kullanıcı: "sürekli aynı efektler, yeni şeyler bul") — **9.2/10, yenilik 9.0**
Proje: `kurgu/projeler/galeri/` (elle yazılmış kompozisyon; medya `kurgu/galeri_hazirla.py`). A/C ile ortak
öğesi yok; HyperFrames kataloğundan (448 blok) seçilip dikey + fotoğraf dokusuna uyarlandı.
- **Açılış (7 vuruş):** krem zemin #F4EFE6, kelime döndürme ("FERAH → AYDINLIK → YENİ / DAİRE", maskeli slot,
  ~0.8 sn arayla), 3 oda kartı eğik gelir (back.out), orta kart **transform ile** tam ekrana büyüyüp salona dönüşür
  (left/top ile animasyon YASAK: piksele yuvarlanıp titrer — lint hatası).
- **Altyazı:** kartsız; altın şerit soldan uzar → yazı clip-path ile açılır → şerit sağa çekilir; "01 — SALON" sayaç.
- **Geçişler (WebGL, her biri bir kez):** whip-pan (yönlü bulanıklık), cross-warp (bükülerek akış), **pencereden
  iris** (oda penceresine yaklaşırken pencere merkezinden manzaraya açılır — mekânsal anlamı olan geçiş).
  Shader'lar giden/gelen klibin uç karelerini doku olarak kullanır (katalog blokları yalnız düz renk/yazı çizer).
- **Bilgi:** bulanık balkon zemini, m² sayacı (90→145; 0'dan sayınca anlamsız ara değerler görünür), dolan iz,
  zıplayan haplar (64 px).
- **Fiyat:** split-flap pano (deterministik karakter dönüşü), son fiyat ≥ 2 sn ekranda.
- **Kapanış:** logo vuruşu (1.7→1, power4.out) + altın halka + tek beyaz kare, çağrı ve telefon ≥ 2 sn.
- Klipler `sabitle=True` (ffmpeg deshake) — el çekimi titremesi.
- **Yapılacak:** brif JSON'dan otomatik üretim (şu an zamanlar/metinler HTML'de).

## Şablon 7 — `defter` (el yapımı) — **9.3/10, "insan eli" 10/10**
Proje: `kurgu/projeler/defter/` (medya `kurgu/defter_hazirla.py`). Kaynak: D&AD 2025 "Unmistakably Human" +
"Radical Candour", SERHANT. Super 8 (TEKNIK-HAVUZU #5 #6 #7 #18).
- Kâğıt doku zemin (ffmpeg, vinyet hafif PI/9 — koyu vinyet "kirli" duruyor), el yazısı Caveat + daktilo Special Elite.
- Klipler Super 8: sıcak ton, siyah hafif kalkık, gren, kare titremesi (sin), ışık titreşimi, 24 fps.
- Yırtık kâğıt şerit altyazı (clip-path), elle çizilmiş oval (deterministik dalgalı yol, 1.1 tur) — özneyi
  KAPATMADAN çevreler (kapı/pencere konumu ilk kareden ölçülür), oklar, alt çizgi; hepsi stroke-dashoffset ile çizilir.
- Bantlı polaroid kolaj (düşer + bant yapışır), dürüst sarı not (görüntüde görüneni söyler, söz vermez),
  tik atılan liste, SATILIK damgası (ölçek 2.2→1 + sarsıntı + damga sesi).
- Sesler ffmpeg ile üretildi: kalem cızırtısı (pembe gürültü + bant geçiren + titreşim), kâğıt hışırtısı; müzik kısık 0.55.

## Şablon 8 — `tahmin` (platform-yerli oyun) — **9.2/10, etkileşim/yenilik 9.8**
Proje: `kurgu/projeler/tahmin/` (medya `kurgu/tahmin_hazirla.py`). Kaynak: Cannes Lions 2025 Social & Creator jürisi
("sosyal olmadan çalışır mıydı?", "trendi çevir") — TEKNIK-HAVUZU #9 #10 #11 #17.
- Kanca: Instagram soru çıkartması (beyaz kart, lacivert→altın bant, "Tahminini yaz…" alanı) ilk karede; aşağı ok nabzı.
- POV yürüyüş: beyaz + siyah konturlu "POV: …" üst yazı (logo filigranıyla çakışmasın: sağ boşluk 320 px),
  yürüyüş sallantısı (y ±10, 0.24 sn yoyo) + ileri itme, her odada altın ipucu çıkartması (back.out pop).
- Evin sesi (ffmpeg sentez, lisanssız): kapı gıcırtısı, adım, kuş, pop, tik, doğru zili; müzik 0.5'e kısık.
- Donma: son kare + flaş + 1.12 ani yaklaşma + "KARAR VER!" (Bebas, siyah kontur).
- Anket: 3 şık + halka geri sayım 3-2-1 (tik sesi); cevap koyu yeşil #15803D (açık yeşil kontrast hatası),
  harf dairesinde yazı rengi açıkça lacivert. Uydurma oy yüzdesi YOK (sahte veri olur).
- Çağrı: yorum balonu, "yazıyor…" noktaları → metin; logo + telefon (logo 930, telefon 1310 — çakışmasın).

## Şablon 2 — `hizli_bilgi` (hızlı bilgi videosu: "Ev alırken 3 hata")
- **Giriş:** 0–1.2 sn soru başlığı (dev, ortada), arka plan bulanık görüntü.
- **Kesme:** madde başına 3 vuruş; numara sayacı (01/03) grafik katmanında.
- **Altyazı:** madde metni üst-orta bandda (y 380–700), 68 px; görüntü alt yarıda kart içinde.
- **B-roll:** her maddeye bir destek görüntü (kart, köşe yuvarlak).
- **Zoom/geçiş:** madde değişiminde kart yukarı kayar (0.3 sn); zoom yok.
- **Müzik/SFX:** müzik 0.7; madde başında "tık" 0.4.
- **Kapanış:** "Kaydet, paylaş" + logo, 2.5 sn.

## Şablon 3 — `konusmali` (danışman kameraya konuşuyor)
- **Giriş:** ilk cümle 1 sn içinde; yüz üst üçte birde (konu=ust).
- **Kesme:** cümle sonlarında atlamalı kesim (jump cut) + %8 itme (punch-in) her 2. kesimde.
- **Altyazı:** kelime kelime (2–4 kelime), alt-orta bandda y 1150–1380 (yüzün altı, UI'nin üstü), anahtar kelime altın.
- **B-roll:** bahsedilen mekân görüntüsü tam ekran 1.5–2.5 sn, konuşma sesi sürer (L-cut).
- **Müzik/SFX:** müzik 0.15 (konuşma altında), vurguda hafif "pop" 0.3.
- **Kapanış:** danışman adı + telefon alt kart, 2 sn.
- *Ham konuşma kaydı gelince transkript (whisper) ile zamanlanır.*

## Şablon 4 — `hikaye` (hikâye anlatımı: "Bu evi neden sevdik")
- **Giriş:** 0–2.5 sn yavaş açılış, siyahtan, tek cümle (italik, ortada).
- **Kesme:** 6–8 vuruş uzun planlar; tempo dalgası yavaş-yavaş-hızlı-yavaş.
- **Altyazı:** anlatı cümlesi, sinema altyazısı gibi ince, 56 px, y 1300–1420; kart yok, gölge var.
- **B-roll:** detaylar (ışık, doku, manzara) anlatıyla eşleşir.
- **Zoom/geçiş:** çözülme (0.6 sn), siyaha dip bir kez; zoom çok yavaş (1.00→1.04).
- **Müzik/SFX:** müzik 0.85, SFX yok ya da ortam sesi.
- **Kapanış:** siyah zemin, logo + tek satır çağrı.

## Şablon 5 — `viral` (viral kısa: "Bu dairenin fiyatını tahmin et")
- **Giriş:** 0–1 sn sert kanca: soru/iddia dev yazı, flaş + vuruş.
- **Kesme:** 2 vuruş (0.9 sn) — hızlı, ama her plan özellik yazısıyla okunur kalır.
- **Altyazı:** büyük, kalın, 72 px, kelime kelime vurgu; ortada (y 760–1100).
- **B-roll:** hızlı detay montajı (3 × 1 vuruş) bir kez.
- **Zoom/geçiş:** punch-in, whip (yön değişimi), tek beyaz flaş; hız rampası bir kez.
- **Müzik/SFX:** müzik 0.9, whoosh 0.5, vuruş 0.8.
- **Kapanış:** cevap/fiyat açıklaması + "yorumlara yaz" + logo.


## Şablon 9 — plan (mimari) — 9.3/10, yenilik 9.7/10
Proje: `kurgu/projeler/plan/`; medya: `kurgu/plan_hazirla.py`.
Teknikler #8 kat planından odaya maskeli geçiş, #14 yazılımsal odak kaydırma, #16 temsili gündüz/gece ışık etüdü.
26 saniye, 1080×1920, 30 fps. Lacivert/altın pafta; iki saniye çizilen plan, oda vurguları, salon → oda → banyo → balkon → gece kapanışı.
Dört tur genel/yenilik: 7.6/9.5 → 8.9/9.6 → 8.1/9.3 → 9.3/9.7. Son check: 0 hata, 7 uyarı.
Teslim: `cikti/plan-ornek.mp4`, `cikti/plan-ornek-telefon.mp4`. Plan, 3+1, 145 m² MOCK; telefon yer tutucu.
Temsili ibareleri korunur. Ayrıntı: `cikti/plan-ornek-RAPOR.md`.

## Şablon 10 — Eşik — **tur 2 seçildi: 9.1/10, yenilik 9.8/10** (kullanıcı kararı 2026-11-09)
Proje: `kurgu/projeler/esik/`; hazırlık: `kurgu/esik_hazirla.py`.
**Kaynak = tur 2:** `index.html` ← `index-tur2.html.bak` (tur 4 hâli `index-tur4.html.bak`'ta). Çıktı
`cikti/esik-sablon.mp4` (tur 2 ile birebir). Tur 3–4'te Codex düzelttikçe puan düştü (8.8, 8.5) — ders: hedef
tutulduğunda gereksiz tur açma; her turun kaynağını yedekle ki en iyisine dönülebilsin.
Tek fikir: “Ekranda bak. Yerinde hisset.” Petrol renkli fotoğraf inceleme seçkisi.
Yeni teknikler #12 temsili bulut sinemagrafı, #13 aynı odada ham/renk kaydırıcısı, #15 perspektifli 3D oda halkası.
22 saniye: 0–4 manzara, 4–10 renk karşılaştırması, 10–18 iki oda açısı ve manzara, 18–22 marka kapanışı.
Dört tur genel/yenilik: 6.8/9.0 → 9.1/9.8 → 8.8/9.0 → 8.5/9.0.
Son check 0 hata; yalnız 8 nested_structure uyarısı. Yazı güvenli alanı 12 örnekte geçti.
Teslim: `cikti/esik-ornek.mp4`, `cikti/esik-ornek-telefon.mp4` (720p CRF26; 30 MB altında).
Bulut hareketi temsili, 3D halka gerçek plan değildir, telefon MOCK. Fiyat/alan/oda sayısı uydurulmaz.
Rapor: `cikti/esik-ornek-RAPOR.md`.


## Şablon 11 — Olasılık
Proje: `kurgu/projeler/yz/`; hazırlık `kurgu/yz_hazirla.py`, kompozisyon `kurgu/yz_kompozisyon.py`.
24 saniye, 1080×1920, 30 fps. İki yeni sanal oda yerleşik image_gen ile üretildi; mevcut salon kullanıldı.
Salon: ışık halkası/iris; yatak odası: kamera eşleşmeli çözülme; çalışma odası: bitki–masa–sandalye merkezli üç SVG maskesinin birleşmesi. Eşik'in kaydırıcısı tekrarlanmaz.
19,651 sn Türkçe Gemini TTS (Charon); 64 px kısa söz grubu altyazıları; müzik 0,18.
Döşeli her sahnede 42 px temsilîlik etiketi, kapanışta AI ses ve döşeme bildirimi. Borular ve eksik tesisat korunur.
Tur puanları (genel/yenilik/AI dürüstlüğü): 1=6/6/7, 2=8/9/10, 3=9,3/9,5/10, 4=9/9,5/10. **Tur4 seçildi:** görünümü koruyup zorunlu logo60/çizgi40/yazı50 global katman ayrımını tamamlar. Son iki tur farklı Gemini modelleriyle değerlendirildi; tur3 estetik referansı da korunur. Ayrıntı teslim raporundadır.
Check: 0 hata; yalnız 22 nested_structure uyarısı. Teslim `cikti/yz-ornek.mp4`, `cikti/yz-ornek-telefon.mp4`.
Rapor: `cikti/yz-ornek-RAPOR.md`. Fiyat, m², telefon ve konum verilmediği için kullanılmadı; MOCK alan yok.


## Şablon 12 — hareket
Proje: `kurgu/projeler/hareket/`. 21,333 sn, 1080×1920, 30 fps. Sürekli anlamlı kamera/grafik hareketi; harf dalgası ve maskeli kelime girişi; MotionPath yayı; iki gerçek fotoğrafta elle maskelenmiş üçer katman ve imagegen örtülü kenar dolgusu; SVG kapı kanadı morphu; perspektifli çift yüzlü alan/fiyat kartı. Eski slot/sayaç/oda halkası/kat planı/iris teknikleri tekrarlanmaz.
135 BPM beats analizi; kaynak müzik 1,825 sn'den, 8 vuruşta bir sahne; ffmpeg sentezi swoosh/tık/pop. İlk kare kapak. Yerel font ve GSAP, transform animasyonu, deterministik timeline. Sabitlenmiş temiz balkon klibi video6; tezgahsız mutfak gösteren tur1 reddedildi.
İki tur: tur1 genel7,5 (özet8), yenilik6,5, hareket7; **tur2 genel9, yenilik9,5, hareket9,5, akıcılık9,5 — seçildi** (Gemini2.5Flash). Check0 hata, yalnız7 izinli nested_structure uyarısı. 4fps örneklemede durağan kare çifti yok. Fiyat/alan/telefon MOCK; sanal döşeme yok.
Teslim: `cikti/hareket-ornek.mp4`, `cikti/hareket-ornek-telefon.mp4` (720p CRF26), `cikti/hareket-ornek-RAPOR.md`. Her turun HTML yedeği, render, snapshot ve eleştirisi saklandı.
