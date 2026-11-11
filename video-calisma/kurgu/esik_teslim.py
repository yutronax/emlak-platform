"""Değerlendirme bittikten sonra gerçek puanlarla UTF-8 teslim belgeleri."""
from pathlib import Path
import sys,json,shutil,hashlib,re
R=Path(__file__).resolve().parents[1];D=R/'cikti';P=R/'kurgu/projeler/esik'
genel,yenilik=sys.argv[1:3]
shutil.copy(D/'esik-ornek-elestiri.md',D/'esik-tur4-elestiri.md')
shutil.copy(D/'esik-ornek.mp4',D/'esik-tur4.mp4')
data=json.loads((D/'esik-son-teknik.json').read_text(encoding='utf-8'))
hashes={n:hashlib.sha256((D/n).read_bytes()).hexdigest() for n in ['esik-ornek.mp4','esik-ornek-telefon.mp4']}
(D/'esik-teslim-sha256.json').write_text(json.dumps(hashes,indent=2),encoding='utf-8')
passed=float(genel)>=9 and float(yenilik)>=9
rapor=f'''# Şablon 10 — Eşik / nihai rapor
8 Kasım 2026. Dört kalite turu tamamlandı. Son Gemini (gemini-3.5-flash): **genel {genel}/10, yenilik {yenilik}/10**.
Hedef durumu: **{'İki hedef de karşılandı.' if passed else 'Son turda iki hedef birlikte karşılanmadı; dört tur sınırı korunarak teslim edildi.'}**

## Fikir ve teslim
“Ekranda bak. Yerinde hisset.” Görüntüdeki ışığı, renk müdahalesini ve bakış açılarını inceleyen sakin bir seçki.
Teknikler bir satış vaadini büyütmek yerine izleyicinin neye baktığını açıklıyor. Petrol renkli sergi ortamı,
fotoğraf karşılaştırması ve 3D halka; önceki plan, el yapımı defter, tahmin oyunu ve WebGL geçişlerinden farklıdır.

| Dosya | Doğrulanan çıktı |
|---|---|
| esik-ornek.mp4 | 1080×1920, 30 fps, H.264 + AAC, 22 saniye, {data['ana']['format']['size']} bayt |
| esik-ornek-telefon.mp4 | 720×1280, 30 fps, CRF 26 / medium, AAC 128k, faststart, 22 saniye, {data['telefon']['format']['size']} bayt; 30 MB altında |
| esik-son-kareler.jpg | Doğrudan nihai MP4 içinden 14 kare; açılıp incelendi |
| esik-tur1/2/3/4-elestiri.md | Her turun ayrı eleştirisi; ornek-elestiri son turdur |

Kaynak proje: `kurgu/projeler/esik/index.html`. Medya: `kurgu/esik_hazirla.py`.
SHA-256 değerleri: `cikti/esik-teslim-sha256.json`. Nihai değerlendirmeden sonra görüntü veya ses değiştirilmedi.

## Kullanılmamış tekniklerin uygulanması
| Havuz | Katalog esini | Dikey fotoğraf uyarlaması / alıcıya anlamı |
|---|---|---|
| #12 Sinemagraf | cinemagraph | Gerçek şehir fotoğrafı sabit, yalnız ayrı bulut dokusu maskede hareketli. İlk 0.8 saniye 65 px, kalan 3.2 saniye 45 px. “Temsili bulut hareketi” ekranda. Mekânın dışarıyla ilişkisini açar. |
| #13 Önce/sonra kaydırıcı | before-after-wipe | Aynı odanın aynı kadrajı: solda sıcak renk düzenleme, sağda ham. Ayırıcı GSAP clip-path + transform; tadilat/eşya eklenmediği yazılıdır. Fotoğraf müdahalesini açıklar. |
| #15 3D oda galerisi | carousel-vision ailesi | CSS perspective 1600 px, 120° aralıklı üç fotoğraf, halka dönüşü. İki oda açısı ve dış manzara; gerçek plan iddiası yok. İç/dış bakış ilişkisini kurar. |

Havuz dışı görsel teknik eklenmedi. İlk tur katalog JSON'u `esik-katalog.json` içine kaydedildi.
448 blok varsayımına güvenilmedi; kurulu 0.9.11 kataloğunun gerçek çıktısı incelendi. Katalog kaynaklarının
yer tutucu sahneleri yerine gerçek fotoğraf dokuları ve 1080×1920 yerleşimi yazıldı; birebir blok kopyası iddiası yok.
Kaynak referansları: brifteki yerel `TEKNIK-HAVUZU.md` ve kurulu HyperFrames kataloğu.

## Kalite turları
| Tur | Genel | Yenilik | Sonraki düzeltme |
|---|---|---|---|
| 1 | 6.8 | 9.0 | 7 saniye açılış kısaldı; manzara sol kadrajlandı; renk farkı artırıldı; bitmemiş duş yerine oda açısı alındı. |
| 2 | 9.1 | 9.8 | Hedefler karşılandı; ek görsel kontrolde kart/başlık boşluğu ve yalnız bulut maskesi iyileştirildi. |
| 3 | 8.8 | 9.0 | Düşük kaynak seviyeli tını değiştirildi; üç armonikli cam sesi sentezlendi, ilk saniye hareketi artırıldı. |
| 4 | {genel} | {yenilik} | Nihai; dört tur sınırında bırakıldı. |

Her tur check → snapshot/kontak sayfasını açma → render → izlet.py sırası izlendi.
İlk turdaki kontrol hataları renderdan önce giderildi. Pro modelinde HTTP 429 nedeniyle scriptin otomatik
gemini-3.5-flash yedeği kullanıldı. Puanlar model görüşüdür; turlar arasında aynı görüntüye ilişkin yorumlar da değişebilir.
3. turdaki “slider linear” yorumu uygulanmadı: kaynakta zaten sine.inOut vardır. Etiketlerin zemini de zaten laciverttir.
Eski şablonları tekrarlayacak flaş, whoosh, logo pop ve ışık sızması önerileri alınmadı.

## Kontrol listesi ve kanıt
| Kontrol | Sonuç |
|---|---|
| HyperFrames son check | PASS: 0 hata, 8 uyarı; tamamı brifte istisna verilen nested_structure_needs_subcomposition. Runtime/layout/motion/craft/audio temiz. `esik-check-tur4.log` |
| Kontrast | 22/22 metin kontrolü WCAG AA geçti. |
| Güvenli yazı bölgesi | 12 zaman örneğinin tamamı x72–930, y220–1440 içinde; `esik-guvenli-alan.json`. Metinler hareket etmediğinden bu ek ölçüm çevrimdışı CSS kutularını ölçer; hareket için gerçek HyperFrames kontrolü kullanıldı. |
| İlk kare / süre | Başlık 0. saniyede; hareket ilk saniyede. Bölümler 4/6/8/4 saniye; her metin 0.5+0.3×kelime sınırından uzun. Kapanış 4 saniye. |
| Görsel inceleme | Son tur beats, phone, üç seam sayfası ve nihai MP4 kontak sayfası açıldı. Bağımsız görsel incelemede P0/P1 kalmadı. |
| Katmanlar | Medya10, ton20, galeri30, grafik40, yazı50, logo60. left/top/width/height animasyonu, Math.random/Date yok. |
| Ses | Kaynak müzik başlangıcı 4 saniye, gain .50, 1.5 saniye fade-out. Açılış ve hareketlerde yedi sentez cam tınısı. Son tepe -3.9 dBFS; kırpılma yok. `esik-son-ses.log` |
| Teknik dosya | ffprobe: ana ve telefon kopyası 22 saniye / 30 fps; `esik-son-teknik.json`. |
| Bozuk Türkçe | plan-ornek-RAPOR.md yeniden UTF-8 yazıldı. SABLONLAR içindeki bozuk Şablon 9 düzeltildi, geçersiz taslak durumu kaldırıldı; TEKNIK-HAVUZU plan durumu doğrulanmış teslim olarak güncellendi. |

Ses ana ajan tarafından canlı dinlenmedi; sayısal ölçüm ve Gemini'nin sesli video değerlendirmesi kullanıldı.
Bağımsız alt ajan yalnız görsel sayfaları inceledi; kesintisiz oynatma veya ses dinlediği iddia edilmez.

## MOCK, kaynaklar ve riskler
- Telefon `0 (5XX) XXX XX XX` yer tutucudur; ekranda MOCK yazılıdır. Fiyat, m², oda sayısı, konum uydurulmadı.
- Bulut hareketi gerçek zaman atlamalı çekim değildir; gerçek fotoğrafın gökyüzü dokusuna temsili hareket verildi.
- Renk düzenlemesi tadilat, mobilya veya bitmiş teslim anlamına gelmez. Pencere koruma bantları ve boş odanın mevcut hali korunur.
- 3D halka odaların gerçek mekânsal dizilimi veya ölçülü planı değildir; aynı oda olabilecek iki açı oda sayısı diye sunulmaz.
- Manzara, kaynak fotoğrafın sol kadrajıdır. Elektrik direği kesim dışında kalır; çevredeki kablolar silinmedi ve manzaranın tamamı gösterildiği iddia edilmez. Keskin kırpma fotoğraf çözünürlüğünü sınırlar.
- Tezgâhsız mutfak, yerde hortum, inşaat artığı gösteren iç kadrajlar ve bitmemiş duş görseli nihai filmde kullanılmaz. Yapının bitmiş/taşınmaya hazır olduğu iddia edilmez.
- Müzik kullanıcı klasöründen alındı; ticari yayın lisansı bu görevde doğrulanmadı. Yeni cam sesleri ffmpeg ile sentezlendi; dışarıdan SFX indirilmedi.
- Yalnız yeni Eşik projesi ve brifte istenen ortak belgeler/plan raporu değiştirildi; diğer projelerin uygulaması değiştirilmedi.

## Yeniden üretim
Çalışma kökünde `.venv-capcut/Scripts/python.exe -X utf8 kurgu/esik_hazirla.py` medyayı hazırlar.
`kurgu/esik_uretim.py <log-adı> check`, `snapshot --review --output snapshots/yeniden`,
`render -o ../../../cikti/esik-ornek.mp4` ilgili CLI işlemlerini Eşik projesinde çalıştırır.
Normal komut proje içinde `npx --yes hyperframes@0.9.11 ...` olur. Bu oturumda npx'in WinGet yolunda EPERM verdiği
görüldüğünden aynı kurulu sürüm Node --preserve-symlinks --preserve-symlinks-main ile çağrıldı.
Önizlemenin AppData yazma isteği proje içi .runtime-data yönlendirmesiyle çözüldü. Önizleme açılıp doğrulandı,
iş bitiminde kapatıldı. HyperFrames masaüstü uygulaması: https://hyperframes.studio/studio/download?os=windows&src=cli
'''
(D/'esik-ornek-RAPOR.md').write_text(rapor,encoding='utf-8')
f=R/'kurgu/SABLONLAR.md';s=f.read_text(encoding='utf-8')
if '## Şablon 10' in s:s=s[:s.index('## Şablon 10')]
s+=f'''\n## Şablon 10 — Eşik — {genel}/10, yenilik {yenilik}/10
Proje: `kurgu/projeler/esik/`; hazırlık: `kurgu/esik_hazirla.py`.
Tek fikir: “Ekranda bak. Yerinde hisset.” Petrol renkli fotoğraf inceleme seçkisi.
Yeni teknikler #12 temsili bulut sinemagrafı, #13 aynı odada ham/renk kaydırıcısı, #15 perspektifli 3D oda halkası.
22 saniye: 0–4 manzara, 4–10 renk karşılaştırması, 10–18 iki oda açısı ve manzara, 18–22 marka kapanışı.
Dört tur genel/yenilik: 6.8/9.0 → 9.1/9.8 → 8.8/9.0 → {genel}/{yenilik}.
Son check 0 hata; yalnız 8 nested_structure uyarısı. Yazı güvenli alanı 12 örnekte geçti.
Teslim: `cikti/esik-ornek.mp4`, `cikti/esik-ornek-telefon.mp4` (720p CRF26; 30 MB altında).
Bulut hareketi temsili, 3D halka gerçek plan değildir, telefon MOCK. Fiyat/alan/oda sayısı uydurulmaz.
Rapor: `cikti/esik-ornek-RAPOR.md`.
''';f.write_text(s,encoding='utf-8')
f=R/'kurgu/TEKNIK-HAVUZU.md';s=f.read_text(encoding='utf-8')
lines=s.splitlines()
for i,line in enumerate(lines):
    if any(line.startswith(f'| {n} |') for n in [12,13,15]):lines[i]=line.rsplit('○',1)[0]+f'✓ Eşik (Şablon 10; {genel}/{yenilik}) |' if '○' in line else line
s='\n'.join(lines)+'\n';s=s.replace('**Şablon 8 `plan`','**Şablon 9 `plan`').replace('**Şablon 9 `tahmin`','**Şablon 8 `tahmin`');f.write_text(s,encoding='utf-8')
(P/'REVIEW.md').write_text(f'''# Eşik — son inceleme
Dört tur; son Gemini genel {genel}, yenilik {yenilik}. Teknik şartname SPEC.md, akış STORYBOARD.md.
İncelenen sayfalar snapshots/tur4/review-beats.jpg, review-phone.jpg ve üç review-seam sayfası; nihai MP4 içinden cikti/esik-son-kareler.jpg.
Bağımsız görsel inceleme: önceki karanlık gökyüzü ve yazı/kart çakışmaları giderildi; son turda P0/P1 yok. Yalnız görsel inceleme yapıldı.
HyperFrames 0 hata, yalnız 8 izinli nested_structure uyarısı. Küçük tek proje içinde ortak zaman çizelgesi kolay düzenlendiğinden alt kompozisyonlara bölünmedi.
12 görünür metin örneğinde güvenli alan geçti. Ses ölçüldü ve Gemini'ye sesli izletildi; ana ajan canlı dinlemedi.
En zayıf yön kaynak fotoğrafların kırpma sonrası çözünürlüğü ve sakin dört saniyelik açılış. Daha iyi çekimle gerçek bulut zaman atlaması ve temiz geniş açılar tercih edilir.
Seçilmeyen fikirler: salt manzara meditasyonu, sanal mobilya galerisi. Gerçek olmayan donanım algısı yaratmadan ışığı inceleyen seçki tercih edildi.
Son değerlendirmeden sonra medya/HTML değiştirilmedi. Ayrıntı cikti/esik-ornek-RAPOR.md.
''',encoding='utf-8')
print('UTF-8 rapor, Şablon 10, teknik havuzu, review ve hash kaydı tamamlandı.')
