# Teknik havuzu — ödüllü işlerden çıkarılan kurgu teknikleri (2026-11-07 araştırması)

Amaç: her yeni şablonda **kullanılmamış** teknik seçmek (kullanıcı: "sürekli aynı efektler"). Her teknik:
kaynak (hangi ödüllü iş / jüri), neden kazandırdı, bizde nasıl uygulanır (HyperFrames + ffmpeg), durum.

## 1. Jürilerin ödüllendirdiği 6 ilke (2024–2025)
| İlke | Kaynak | Ne demek | Bize çevirisi |
|---|---|---|---|
| **Gerçeklik / belgesel** | Shorty 18 Emlak birincisi REMAX "Get Golden Home": NFL oyuncusunun büyükannesine ev alma sözü gerçek zamanlı belgesel olarak çekildi; "yeniden kurgulanmış duygusal hikâye değil" → 618M gösterim | Sahnelenmiş tanıtım yerine gerçek bir süreç ve gerçek insan | Anahtar teslimi, ilk ziyaret, ev sahibinin cümlesi; "gerçek an" bölümü |
| **Tek fikir + derin zanaat** | Cannes Lions 2025 Social & Creator GP (Vaseline Verified), jüri: "tek yaratıcı fikir + inkâr edilemez derin zanaat" | Videonun tek bir fikri olmalı, detaylar kusursuz | Her ilana tek cümlelik fikir: "Pencereden şehir" → bütün kurgu ona hizmet eder |
| **Platform-yerli** | Cannes Lions jürisi: "sosyal bileşenler olmadan başka kategoride çalışır mıydı? evet ise üst sıraya çıkmaz" | Reels'in kendi dilinden (yorum, tepki, soru, POV) türeyen format | Yorum-cevap videosu, "tahmin et" anketi, POV yürüyüş |
| **Trendi çevir, kopyalama** | Cannes Lions: "trendi tekrarlamak masa bahsi; yükselenler onunla oynadı" | Bilinen formata bir dönüş | "Fiyatı tahmin et" → cevap sayaçla gelir; "evin sesi" ASMR'ı |
| **Tartışmasız insan / el yapımı** | D&AD 2025 "Unmistakably Human": "makinenin düşünemeyeceği; el yapımına isyankâr dönüş", "el yapımı unsurlar yapay zekâ aynılığının panzehiri" | Kusurlu, dokulu, el çizimi, absürt mizah | El çizimi işaretleme, kâğıt/bant kolaj, film greni + Super 8 |
| **Dürüstlük (Radical Candour)** | D&AD 2025 trendi: "dürüstlük en ikna edici kanıt" | Kusuru saklama, söyle | "Bitmemiş mutfak → teslimde tezgah takılacak" dürüst not kartı |

Ek: **SERHANT. Signature Content Suite** (Shorty Emlak birincisi): tek çekim gününden 5 video biçimi: uzun tur,
<2 dk editoryal film, dikey vinyetler, **Super 8 film dokusu**, kısa sosyal kesim → 31.5M izlenme. Ders: aynı ilandan
birden çok biçim üret; analog doku dijital ilanlardan ayrıştırır.

## 2. Uygulanabilir teknikler (✓ = kullanıldı, ○ = havuzda)
| # | Teknik | Kaynağı / gerekçe | Uygulama | Durum |
|---|---|---|---|---|
| 1 | Kelime döndürme başlık | Motion tipografi trendi | maskeli slot (galeri) | ✓ galeri |
| 2 | Kart → tam ekran dönüşüm | Kesintisiz akış | transform büyütme | ✓ galeri |
| 3 | WebGL whip / warp / iris | Mekânsal anlamlı geçiş | foto-dokulu shader | ✓ galeri |
| 4 | Sayaç / split-flap | Veriyi oyuna çevir | GSAP onUpdate | ✓ galeri |
| 5 | **Super 8 / analog film dokusu** | SERHANT; D&AD "handmade" | ffmpeg: grain + vinyet + hafif kayma (gate weave) + ışık titremesi + 4:3 çerçeve + kenar ışık sızması | ✓ defter |
| 6 | **El çizimi işaretleme** | D&AD "Unmistakably Human" | SVG stroke-dashoffset: pencereyi daire içine alan elle çizilmiş çizgi, ok, "metrekaresi büyük!" el yazısı | ✓ defter |
| 7 | **Kâğıt/bant kolaj (scrapbook)** | D&AD el yapımı; katalog `freeze-frame-dressing` | donmuş kare + yırtık kâğıt kenar + bant + not | ✓ defter |
| 8 | **Kat planı çizimi → oda** | Emlak'a özgü, veriyi görselleştir | SVG plan çizgileri çizilir, oda vurgulanır, o odanın videosuna zoom | ✓ plan (4 tur; genel 9.3, yenilik 9.7) |
| 9 | **POV yürüyüş + iç ses** | Platform-yerli (POV formatı) | birinci şahıs yürüyüş, "POV: yeni evine ilk adım" üst yazı, ayak sesi + kapı sesi SFX | ✓ tahmin |
| 10 | **"Fiyatı tahmin et"** | Trendi çevir; etkileşim | 3 şık kartı → geri sayım → sayaçla cevap → "yorumlara yaz" | ✓ tahmin |
| 11 | **Evin sesi (ASMR)** | Ses tasarımı ayrı ödül kategorisi (Ciclope Sound) | müziksiz/az müzik: kapı kolu, perde, su, kuş sesi; her planın kendi sesi | ✓ tahmin |
| 12 | **Sinemagraf** | Katalog `cinemagraph` | donmuş balkon karesinde yalnız bulutlar hareketli (maske) | ✓ Eşik (Şablon 10; 8.5/9.0) |
| 13 | **Önce/sonra kaydırıcı** | Katalog `before-after-wipe` | ham ↔ renk düzeltilmiş ya da boş ↔ sanal döşenmiş oda | ✓ Eşik (Şablon 10; 8.5/9.0) |
| 14 | **Odak kaydırma (rack focus)** | Katalog `rack-focus` | önde detay (kapı kolu) netken arkaya, odaya geçiş | ✓ plan (4 tur; genel 9.3, yenilik 9.7) |
| 15 | **3D oda galerisi** | Katalog `carousel-vision` | odalar 3D halkada döner, seçilen öne gelir | ✓ Eşik (Şablon 10; 8.5/9.0) |
| 16 | **Gündüzden geceye** | Joel Van Beek (eğitim notları) | aynı karede renk/ışık geçişi, pencerede şehir ışıkları | ✓ plan (4 tur; genel 9.3, yenilik 9.7) |
| 17 | **Hız rampası + dondurma** | Katalog `beat-freeze-cut` | vuruşta kare donar, flaş, sert kesim | ✓ tahmin |
| 18 | **Dürüst not kartı** | D&AD Radical Candour | "Mutfak tezgahı teslimde takılacak" el yazısı not; güven | ✓ defter |
| 19 | **Gerçek an (belgesel)** | REMAX Golden Home | anahtar teslimi / müşteri tepkisi kısa röportaj + altyazı | ○ (çekim gerekir) |
| 20 | **Çoklu biçim paketi** | SERHANT | aynı ilandan: 20 sn reel + 45 sn tur + 3 vinyet + kapak görseli | ○ |

## 3. Sıradaki şablon önerileri (her biri havuzdan farklı teknik)
- **Şablon 7 `defter` (el yapımı):** krem kâğıt, kâğıt/bant kolaj, el çizimi işaretleme, el yazısı notlar, dürüst not kartı,
  Super 8 dokulu klipler. (#5 #6 #7 #18) — D&AD "Unmistakably Human".
- **Şablon 9 `plan` (mimari):** kat planı çizilerek açılır, her oda plandan videosuna zoom, ölçüler sayaçla, gündüz→gece kapanış.
  (#8 #16 #14) — veriyi görselleştirme.
- **Şablon 8 `tahmin` (platform-yerli):** "Bu dairenin fiyatını tahmin et" kanca, POV yürüyüş, ASMR sesler,
  şıklı anket kartı, sayaçla cevap, "yorumlara yaz". (#9 #10 #11 #17) — Cannes "platform-yerli + trendi çevir".

## Kaynaklar
- Shorty Awards — REMAX "Get Golden Home" (Emlak birincisi): https://shortyawards.com/18th/get-golden-home
- Shorty Awards — SERHANT. Signature Content Suite (Emlak birincisi): https://shortyawards.com/15th/serhant-signature-content-suite
- Contagious — Cannes Lions 2025 Social & Creator: https://www.contagious.com/news-and-views/cannes-lions-2025-social-and-creator-winners
- D&AD 2025 Trend Report: https://media.dandad.org/documents/d-ad-2025-trend-report-250929.pdf
- Motionographer — Motion Awards 2025 winners: https://motionographer.com/2025/12/08/the-motion-awards-2025-winners/
- Cut+Run — CICLOPE 2025 winners: https://cutandrun.com/22570/ciclope-2025-winners/


## 4. Şablon 11 — Olasılık ile eklenen teknikler
| # | Teknik | Uygulama / kaynak | Durum |
|---|---|---|---|
| 21 | Sanal döşemenin oda içinden açılması | Katalog `transitions-radial` incelendi; aynı gerçek fotoğrafta circle clip-path + eşleşmiş kamera transformu, tek halka | ✓ Olasılık |
| 22 | Mobilya merkezli çok odaklı belirme | SVG maskesinde bitki, masa ve sandalye konumlarından büyüyen üç daire birleşir; yapı sabit kalır | ✓ Olasılık |
| 23 | Dürüst AI ses + sanal oda anlatısı | Gemini TTS; ffmpeg sessizlik ölçümü; 64 px kısa söz grubu altyazıları; her döşeli sahnede etiket ve 6 sn üretim bildirimi | ✓ Olasılık |

Ders: Etiketi yatağın/masanın üzerinden üst banda al. Metni küçültmek yerine kısa gruplara böl.
Her görsel üretiminden sonra gerçek kaynakla yan yana karşılaştırmayı aç; boru, kablo ve pencere bantlarını silme.
LLM eleştirisini ölçümle birlikte değerlendir: yaklaşık zamanlar, mevcut efektler ve sabit kapanış süresi yanlış yorumlanabilir.


## 5. Şablon 12 — hareket ile eklenen teknikler
| # | Teknik | Uygulama / kaynak | Durum |
|---|---|---|---|
| 24 | Gerçek fotoğrafta üç düzlemli 2.5D | Elle poligon alfa + imagegen örtülü arka plaka; ön/orta kaynak pikselleri, ayrı hızda dolly/yörünge; `camera-rig-depth-stack` uyarlaması | ✓ hareket |
| 25 | Harf dalgası ve eksen değiştiren tipografi | Elastic karakter yayı + rotationX/scaleY; sonraki kelimede maske içi expo/back hareketi, slot yok | ✓ hareket |
| 26 | Yay üzerinde oto yönelen vurgu | SVG Bézier izi ve MotionPathPlugin ile çizgi üzerindeki işaret; `arc-motion-path` dikey uyarlaması | ✓ hareket |
| 27 | Açılan kapı kanadı path morphu | Mimari açıklık çizilir, SVG d koordinatlarıyla kanat açılır; kat planı değildir | ✓ hareket |
| 28 | Perspektifli çift yüzlü bilgi dönüşü | `transitions-3d` prensibiyle rotationY ve backface-visibility; oda halkası yerine tek bilgi kartı | ✓ hareket |

Ders: Kontakt sayfasında görüntü sırasından video adı tahmin etme; her küçük görseli gerçek dosya adıyla üret. LLM puanlarını kaynak süreleriyle karşılaştır: 3,55sn görünen bölüm etiketi 0,6sn diye yorumlanabiliyor. Check0 hata + video ölçümü + gözle temas sayfası incelemesi birlikte gerekir.
