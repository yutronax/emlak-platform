# Codex görevi: Şablon 9 "plan" (mimari) — baştan sona sen yap

Kullanıcı (emlak firması İNZA Gayrimenkul & Yatırım) bu şablonun TAMAMINI senin yapmanı istedi: tasarım, medya
hazırlığı, kod, kontrol, render, eleştiri, düzeltme turları ve rapor. Kimseye soru sorma; belirsizlikte en iyi
kararı ver ve raporda yaz. Çalışma klasörü: `video-calisma/` (bu dosyanın iki üstü).

## Önce oku (zorunlu)
- `kurgu/SABLONLAR.md` — şablon sistemi, güvenli alan, katman sırası, kalite kapısı, önceki şablonların dersleri.
- `kurgu/TEKNIK-HAVUZU.md` — ödüllü işlerden teknik havuzu. Bu şablon #8 (kat planı çizimi → oda), #16 (gündüzden
  geceye), #14 (odak kaydırma / rack focus) tekniklerini kullanacak. ✓ işaretli teknikleri TEKRAR ETME (kullanıcı
  "sürekli aynı efektler" diye şikâyet etti); kart altyazı, ışık sızması, whip/warp/iris, split-flap, polaroid, POV,
  anket yok.
- Örnek kompozisyonlar (yapıyı ve HyperFrames kurallarını görmek için): `kurgu/projeler/galeri/index.html`,
  `kurgu/projeler/defter/index.html`, medya hazırlığı örneği `kurgu/galeri_hazirla.py`, `kurgu/defter_hazirla.py`.
- `kurgu/projeler/galeri/CLAUDE.md` — HyperFrames kuralları (data-start/duration, class="clip", tek paused timeline,
  window.__timelines["main"], deterministik: Math.random/Date yok).

## Tasarım hedefi: "plan"
Mimari/teknik çizim estetiği: lacivert ya da kâğıt-beyazı blueprint zemin, ince çizgiler, ölçü okları, mimari
etiket tipografisi. Akış önerisi (değiştirebilirsin, gerekçesini raporla):
1. Kanca (ilk kare dolu, kapak): dairenin basitleştirilmiş 3+1 kat planı SVG çizgileri çizilerek belirir
   (stroke-dashoffset), başlık mimari etiket gibi.
2. Plan üzerinde bir oda vurgulanır → o odanın gerçek videosuna/fotoğrafına geçiş (plandaki oda dikdörtgeninden
   açılan maske / zoom). Salon, oda, banyo, balkon için tekrarla; her geçiş planla bağlantılı olsun.
3. Ölçüler/çizgiler sayaçla (m², oda ölçüleri) — ölçüler UYDURMA olamaz: gerçek ölçü yok, o yüzden ölçü yerine
   oda adları + MOCK işaretli toplam m² kullan.
4. Rack focus (önde detay net → arka plan net) en az bir yerde; gündüz→gece geçişi kapanışta (aynı karede renk/ışık
   değişimi, pencerelerde sıcak ışık).
5. Kapanış: logo + "YERİNDE GÖRÜN" + telefon (MOCK).
Kat planı gerçek değil: "temsili plan" ibaresini küçük ama okunur yaz (dürüstlük; kullanıcı yanıltıcı içerik istemez).

## Ortam ve araçlar
- Medya: `capcut/medya5/video0..11.mp4` (1080x1920 dikey telefon klipleri, gerçek daire), `capcut/medya2/*.jpg`
  (salon, oda1, oda2, banyo, balkon, manzara, koridor, mutfak1). Tezgahsız mutfak / inşaat artığı / yerde hortum
  görünen kareleri KULLANMA. Klipleri `kurgu/kur.py` içindeki `klip_hazirla(p, hedef, sure)` ile hazırla
  (renk düzeltme, `sabitle=True` titreme giderir, `kirp_ust` tavan kablosunu kırpar). Medya hazırlığını
  `kurgu/plan_hazirla.py` olarak yaz, çıktılar `kurgu/projeler/plan/assets/`.
- Marka: `marka/inza-logo-saydam.png` (saydam logo), font `varliklar/font/BebasNeue-Regular.ttf`; renkler altın
  #F2B526, lacivert #16213E. Müzik `muzik/luxury-real-estate.mp3` (data-media-start="4"), efektler
  `hyperframes/ilan/assets/whoosh.wav`, `impact.wav`; gerekirse yeni sesleri ffmpeg ile sentezle (lisanssız).
- Proje iskeleti: `hyperframes/ilan/` içindeki package.json, hyperframes.json, AGENTS.md, CLAUDE.md'yi
  `kurgu/projeler/plan/` içine kopyala, meta.json yaz.
- Node (PATH'e ekle): `%LOCALAPPDATA%\Microsoft\WinGet\Packages\OpenJS.NodeJS.LTS_Microsoft.Winget.Source_8wekyb3d8bbwe\node-v24.20.0-win-x64`
  Tarayıcı: `HYPERFRAMES_BROWSER_PATH=C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe`
  Komutlar (proje klasöründe): `npx --yes hyperframes@0.9.11 check`, `... snapshot --at 1,3,5`,
  `... render -o ..\..\..\cikti\plan-ornek.mp4`. Python: `.venv-capcut\Scripts\python.exe -X utf8`.
- PowerShell tuzağı: satır içi `python -c` ile çok satırlı/tırnaklı kod yazma (PowerShell bozar); betik dosyası yaz.
  Dosyaları PowerShell `Set-Content` ile yeniden yazma (Türkçe karakter bozuluyor); Python ile UTF-8 yaz.

## Kurallar (ihlal = başarısız)
- 1080x1920, 30 fps. Yazı güvenli alanı x 72–930, y 220–1440 (altyazı alt kenarı ≤ 1440; sağda Reels ikonları).
- Katman sırası z-index ile açık: medya 10 · ton 20 · grafik/plan 30–40 · yazı 50 · marka 60 · efekt 70.
- İlk kare kapak: başlık 0. saniyede görünür (siyahtan açılış yok).
- Her yazı ekranda ≥ 0.5 s + 0.3 s × kelime; kapanış satırları ≥ 2 s.
- Animasyonu transform/opacity/clip-path/filter ile yap; left/top/width/height animasyonu YASAK (lint hatası, titrer).
- Ölçü, fiyat, telefon, m² UYDURMA: MOCK yer tutucu kullan (ör. "X.XXX.XXX TL", "0 (5XX) XXX XX XX", "145 m² (MOCK)"
  değil — ekranda "145 m²" yazıp raporda MOCK olduğunu belirt).
- Başka projelere (galeri, defter, tahmin, kur.py'nin mevcut davranışı) dokunma; yalnızca kendi dosyalarını oluştur.
- `%USERPROFILE%\.gemini-anahtar` içeriğini asla yazdırma.

## Kalite döngüsü (en az 2 tur)
1. `check` → 0 hata. Uyarılardan `nested_structure_needs_subcomposition` hariç hepsini düzelt (okuma süresi,
   kontrast, çakışan tween, first_frame_empty...).
2. `snapshot` ile her sahnenin ortasını ve geçişleri al, contact-sheet'e BAK (görüntüyü aç), çakışma/okunurluk düzelt.
3. Render → `.venv-capcut\Scripts\python.exe -X utf8 izlet.py cikti\plan-ornek.mp4 "<bağlam>"` (Gemini videoyu
   sesiyle izler, `cikti/plan-ornek-elestiri.md` yazar). Haklı önerileri uygula, yanlışlarını raporda belirt.
4. Hedef: Gemini genel ≥ 9.0 ve yenilik ≥ 9.0. Tutmazsa tekrar tur (en çok 4 tur).

## Teslim
- `cikti/plan-ornek.mp4` (son render) ve `cikti/plan-ornek-telefon.mp4` (ffmpeg 720p crf 26, < 30 MB).
- `cikti/plan-ornek-RAPOR.md`: kullanılan teknikler (havuz numaralarıyla), turlar ve puanlar, kontrol listesi
  (altyazı okunurluğu, yanlış kesim, ritim, önemli alanın kapanması, ses dengesi, görsel dil), kalan riskler, MOCK alanlar.
- `kurgu/SABLONLAR.md`'ye "Şablon 9 — plan" bölümü ekle (diğer bölümlere dokunma), `kurgu/TEKNIK-HAVUZU.md`'de
  kullandığın tekniklerin durumunu "✓ plan" yap.
- Son mesajında: dosya yolları, son puanlar, kaç tur yaptığın, kalan riskler (kısa, Türkçe).
