# Hız rampası, içinden geçme ve hızlı geçişler — YouTube araştırması (2026-11-09)

Gemini 5 videoyu linkten izleyip saniye saniye çözdü (`izlet_youtube.py`; ham analizler `arastirma/youtube/`):
- vitrin1 — "INSANE REAL ESTATE VIDEO TOUR | SPEED RAMP TRANSITIONS" https://www.youtube.com/watch?v=aO_kPW39um8
- vitrin2 — "SPEED RAMP Real Estate Video 2025" https://www.youtube.com/watch?v=fwPH-1xLquo
- vitrin3 — "Cinematic Real Estate Speed Ramping | Modern Home Tour" https://www.youtube.com/watch?v=cQffBoEVGX8
- eğitim — "Speed Ramp Zoom Transitions for Real Estate Videos" https://www.youtube.com/watch?v=VyGkilcMq5Q
- eğitim — "EPIC & EASY Speed Ramp Transitions for Real Estate Video! | BTS" https://www.youtube.com/watch?v=b_Fb3IUgrl0

## Kullanıcı geri bildirimi (2026-11-09)
1. Yazılar görüntüyü çok kapatıyor → bu videolarda yazı **minimal**: alt bant ya da ortada kısa, mekânı gölgelemiyor.
2. **Yatay (16:9)** çekim/çıktı isteniyor.
3. "Hareket" = **ani hızlanmalar, içinden geçmeler, görüntüler arası hızlı ve şık geçişler** (motion grafik değil).

## Ortak formül (5 videonun hepsinde)
**Hız rampası (her geçişte):** normal %100 (≈1–2.5 sn, çoğu 60 fps'ten %40–50 yavaşlatılmış) → **4–6 karede** ivmelenme
→ **2–12 kare tepe hız %500–%2000** (bazen %3200) → 4–6 karede yavaşlama → %100. Toplam geçiş **0.4–0.8 sn**.
Eğri: sert **S-eğrisi** (exponential in/out). Tepe hız **müziğin vuruşuna** (bas/trampet), tam o anda **whoosh**
(≈ −9 dB), kesim noktasında 10–15 kare Gaussian blur (σ 15–25) / yönlü hareket bulanıklığı (30–50 px).

**Giden klip hızlanarak biter, gelen klip AYNI YÖNDE hızla başlar ve yavaşlar** — iki klibin hareket yönü eşleşir
(ileri→ileri, sağa→sağa; ya da aşağı→yukarı "yansıma"). Geçişi gizleyen budur.

## Geçiş türleri
| Tür | Nasıl | Kaynak örnek |
|---|---|---|
| **Push-in / speed zoom** | Kamera odadaki merkez noktaya (pencere, kapı, şömine) düz hatta hızla ilerler; tepe hızda kesilir, sonraki mekânda aynı yönde ilerlemeye devam. Bindirmede ölçek 1.5→1.0 + blur | eğitim-rampa 00:10–00:23 (dış→salon→balkon→mutfak→drone) |
| **İçinden geçme (nesne maskesi)** | Kamera kapı kasası/duvar/kolon/tezgaha yanaşır, nesne kadrajı **tamamen kapattığı karede** kesilir; yeni sahne aynı nesnenin "arkasından" aynı yönde açılır. Gerekirse yumuşak kenarlı (15–20 px) maske | vitrin1 00:31, 00:50; vitrin3 00:21, 00:28, 00:35 |
| **Zemin/duvar ile maskeleme** | Hızla aşağı (zemine) pan → zemin ekranı doldururken kes → yeni odada zeminden yukarı pan ile aç | vitrin3 00:23, 00:32 |
| **Whip pan** | Sert yatay/dikey çevirme, yoğun yönlü blur; tam bulanık karede kes; gelen klip aynı yönde whip ile başlar | vitrin1 00:11, vitrin3 00:13 |
| **Pencereden geçiş** | Pencereye hızla yaklaş → "içine girer gibi" dış/drone çekimine | eğitim-rampa 00:20 |
| **Ön plan maskesi** | Yaprak/bitki gibi bulanık ön plan kadrajdan geçerken bir sonraki çekime | vitrin1 00:24 |
| **Zincirleme rampa** | Merdiven→mutfak→veranda arka arkaya kesintisiz hız rampası | vitrin1 00:44 |

## Çekim şartları (geçişlerin %80'i çekimde yapılıyor)
- **Gimbal** + "ninja walk" (sarsıntısız düz yürüyüş). Elde titrek çekimle bu geçişler olmaz.
- **4K 60 fps** (normal kısımlar %40–50 yavaşlatılır; hızlı kısım için bol kare lazım).
- **Ultra geniş açı** (12–16 mm; telefonda 0.5x lens). Kurguda %150'ye kadar kırpılabilmeli.
- Her çekim **geçiş için planlanır**: odak noktası kadrajın tam ortasında; hareket mesafesi normalin ~3 katı uzun;
  geçiş noktalarında kapı kasası, kolon, bitki **bilerek** kameraya yanaştırılır; bir sonraki çekim aynı yön ve hızla başlar.
- Klip başı ve sonunda 1–2 sn fazladan hareket (rampa için malzeme).

## Bizim kaynak sorunumuz
Elimizdeki `gerçek_veri_2` klipleri **dikey 464×832** (WhatsApp sıkıştırmalı), 2–4.5 sn, elde, kısa hareketli.
- **Yatay 16:9 çıktı** bu kliplerden ancak 464×261 kırpılarak (çok düşük çözünürlük) ya da dikey klip ortada + bulanık
  yan dolgu ile yapılabilir → yayın kalitesi olmaz.
- Hız rampası ve içinden geçme için gereken uzun, düz, aynı yönlü, nesneye yanaşan çekimler yok.
→ Yatay + bu tarz geçişler için **yeni çekim gerekli** (aşağıdaki çekim listesi). Mevcut kliplerle ancak sınırlı bir
deneme (kısa rampalar + blur + whoosh, maskeli zoom-through) yapılabilir.

## Deney sonucu (2026-11-09): çekim > kurgu
Aynı betik (`kurgu/yatay_rampa.py`), aynı formül:
- Bizim dikey, kısa, elde klipler (yön uyumsuz) → `cikti/yatay-rampa.mp4` → **Gemini 4.9/10** ("zoom-blur slayt hissi").
- Pexels / Kindel Media ham yatay gimbal klipleri, Gemini'nin çıkardığı hareket yönüne (`kurgu/klip_analiz.py` →
  `varliklar/pexels-kindel/analiz.json`) göre hep İLERİ sırayla, kapı kasalı çıkışlar rampa sonuna denk →
  `cikti/yatay-pexels.mp4` → **Gemini 9.1/10, akış/hız rampası 9.4** ("profesyonel standart yakalanmış").
Ayar: hızlı 6x, rampa 0.2 sn, gövde 0.8x, yakınlaşma 1→1.35 / 1.3→1, σ 14–16 bulanıklık, 135 BPM'de 4 vuruşluk planlar.
Kalan öneriler: oda sırası fiziksel tur mantığında (dış→giriş→salon→mutfak→yatak→banyo), bir geçişte hafif dönme/sarsıntı
çeşitliliği, whoosh +1.5 dB, kapanış zeminini %30–40 karart.

## Yeniden üretim parametreleri (HyperFrames + ffmpeg)
- Rampa: ffmpeg `trim` + `setpts=(PTS-STARTPTS)/hız` parçaları (hızlı parça 0.05–0.15), giden klibin sonu ve gelen klibin başı;
  hızlı parçaya `gblur=sigma=20` ya da yönlü bulanıklık (`avgblur=sizeX=40:sizeY=1` yatay whip için).
- Bindirme (GSAP): giden `scale 1→2.2, blur 0→15px, 0.3 sn power4.in` · gelen `scale 1.5→1, blur 15→0, 0.3 sn power4.out`.
- Ses: whoosh tepe noktaya hizalı, ≈ −9 dB (0.35 lineer); müzik vuruşu `npx hyperframes beats`.
- Yazı: alt bant/kısa başlık, kadrajın ≤ %15'i; geçiş anında yazı yok.
