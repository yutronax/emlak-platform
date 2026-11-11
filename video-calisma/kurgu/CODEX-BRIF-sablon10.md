# Codex görevi: Şablon 10 — konsepti ve adı senin (baştan sona sen yap)

Kullanıcı (İNZA Gayrimenkul & Yatırım) yeni bir şablonun TAMAMINI senin yapmanı istedi. Kimseye soru sorma;
belirsizlikte en iyi kararı ver, raporda gerekçelendir. Çalışma klasörü: `video-calisma/`.

## 0. Önce düzelt (5 dk)
`cikti/plan-ornek-RAPOR.md` Türkçe karakterleri "?" olarak bozuk (PowerShell ile ANSI yazılmış). Aynı içeriği doğru
Türkçe ile UTF-8 olarak yeniden yaz (içerik için `cikti/plan-tur*-elestiri.md`, `cikti/plan-ornek-elestiri.md`,
`kurgu/SABLONLAR.md` Şablon 9 bölümüne bak). `kurgu/SABLONLAR.md` ve `kurgu/TEKNIK-HAVUZU.md`'de de "?" bozulması
varsa düzelt.

## 1. Önce oku
- `kurgu/SABLONLAR.md`, `kurgu/TEKNIK-HAVUZU.md` (✓ = kullanıldı; TEKRAR ETME — kullanıcı "sürekli aynı efektler"
  dedi). Bu şablon havuzdaki HİÇ kullanılmamış tekniklerden kurulmalı: **#12 sinemagraf**, **#13 önce/sonra
  kaydırıcı**, **#15 3D oda galerisi**; istersen havuz dışı yeni bir tekniği de ekle (kaynağını raporla).
- HyperFrames katalog: `npx --yes hyperframes@0.9.11 catalog --json` (448 blok; ör. `cinemagraph`,
  `before-after-wipe`, `carousel-vision-*`, `rack-focus`, `camera-dolly-zoom`). Katalog blokları yatay 1920×1080 ve
  çoğu yalnız düz renk/yazı çizer — dikeye ve fotoğraf dokusuna UYARLA (galeri şablonu bunu yaptı).
- Örnekler: `kurgu/projeler/galeri/index.html` (WebGL foto geçişi), `kurgu/projeler/defter/index.html`,
  `kurgu/projeler/plan/index.html` (senin önceki işin), medya betikleri `kurgu/*_hazirla.py`, `kurgu/kur.py`.
- HyperFrames kuralları: `kurgu/projeler/galeri/CLAUDE.md`.

## 2. Yaratıcı hedef
Konsepti ve şablon adını sen seç (proje klasörü `kurgu/projeler/<ad>/`, medya betiği `kurgu/<ad>_hazirla.py`,
çıktılar `cikti/<ad>-ornek*.mp4`). Ölçüt: önceki 6 stilden (ilan turu A/C, galeri, defter, tahmin, plan) açıkça farklı
bir görsel dil + emlak için anlamlı (teknik süs olsun diye değil, alıcıya bir şey anlatsın: ör. önce/sonra = ham →
renk düzeltilmiş ya da boş → ışıklı; sinemagraf = yaşayan manzara). Ödüllü işlerin ilkeleri (TEKNIK-HAVUZU §1):
tek fikir + derin zanaat, dürüstlük, insan hissi.

## 3. Ortam (izinler bu sefer baştan verildi)
- PATH'te: `node`, `npx`, `ffmpeg`, `ffprobe`; Python: `.venv-capcut\Scripts\python.exe -X utf8`.
  Ortamda `HYPERFRAMES_BROWSER_PATH` (Edge) ve `GEMINI_API_KEY` tanımlı (anahtarı ASLA yazdırma/dosyaya yazma).
- Medya: `capcut/medya5/video0..11.mp4` (1080×1920), `capcut/medya2/*.jpg`. Tezgahsız mutfak, inşaat artığı,
  yerde hortum görünen kareleri kullanma. Klip hazırlığı: `kurgu/kur.py` → `klip_hazirla(p, hedef, sure)`
  (`sabitle=True`, `kirp_ust`, `kirp_alt`, `parlak`). Marka: `marka/inza-logo-saydam.png`,
  `varliklar/font/BebasNeue-Regular.ttf`, altın #F2B526, lacivert #16213E. Müzik `muzik/luxury-real-estate.mp3`
  (data-media-start="4"); efektler `hyperframes/ilan/assets/*.wav`; yeni sesleri ffmpeg ile sentezle.
- Proje iskeleti: `hyperframes/ilan/` içindeki package.json, hyperframes.json, AGENTS.md, CLAUDE.md'yi kopyala.
- Komutlar (proje klasöründe): `npx --yes hyperframes@0.9.11 check | snapshot --at ... | render -o ...`.

## 4. Önceki işte öğrenilenler (tekrarlama)
- Dosyaları PowerShell `Set-Content`/`Out-File` ile YAZMA (Türkçe karakter bozulur). Python ile `encoding="utf-8"`.
- Satır içi `python -c` ile çok satırlı/tırnaklı kod yazma; betik dosyası yaz.
- Render'da `VIDEO_EXTRACTION_FAILED / ffmpeg_timeout` alırsan: klipleri kısa tut, 30 fps sabit, yeniden kodla
  (`-c:v libx264 -preset fast -g 30`), tekrar dene.
- Kanca: ilk 1 sn hareketli ve dolu olmalı (plan'da 5.5 → 9.2 bununla çıktı).

## 5. Kurallar (ihlal = başarısız)
1080×1920 30 fps · yazı güvenli alanı x 72–930, y 220–1440 · z-index katmanları (medya 10 · ton 20 · grafik 30–40 ·
yazı 50 · marka 60 · efekt 70) · ilk kare kapak (başlık 0. sn'de) · yazı ekranda ≥ 0.5 + 0.3×kelime sn, kapanış ≥ 2 sn ·
left/top/width/height animasyonu yasak (transform/opacity/clip-path/filter) · deterministik (Math.random/Date yok) ·
fiyat/m²/telefon UYDURMA (MOCK yer tutucu; temsili şeyleri ekranda "temsili" diye belirt) · başka projelere dokunma.

## 6. Kalite döngüsü (en az 2, en çok 4 tur)
check (0 hata; `nested_structure` hariç uyarıları düzelt) → snapshot + contact sheet'i AÇIP BAK → render →
`izlet.py cikti/<ad>-ornek.mp4 "<bağlam + yenilik puanla>"` (her turun eleştirisini `cikti/<ad>-turN-elestiri.md`
olarak sakla) → düzelt. Hedef: Gemini genel ≥ 9.0 ve yenilik ≥ 9.0.

## 7. Teslim
`cikti/<ad>-ornek.mp4`, `cikti/<ad>-ornek-telefon.mp4` (720p crf 26, < 30 MB), `cikti/<ad>-ornek-RAPOR.md` (UTF-8;
teknikler + havuz numaraları, turlar/puanlar tablosu, kontrol listesi, MOCK alanlar, riskler), `kurgu/SABLONLAR.md`'ye
"Şablon 10 — <ad>" bölümü, `TEKNIK-HAVUZU.md` durum güncellemesi. Son mesaj: Türkçe, kısa: şablon adı ve fikri,
dosyalar, son puanlar, tur sayısı, riskler.
