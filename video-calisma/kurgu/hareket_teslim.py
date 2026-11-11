from pathlib import Path
import json,hashlib
R=Path(__file__).resolve().parent.parent;P=R/'kurgu/projeler/hareket';C=R/'cikti'
cfg=json.loads((P/'hyperframes.json').read_text(encoding='utf-8'))
cfg['registryItems']=[dict(name=n,type=t,target=f'catalog-reference/{n}.txt') for n,t in [('arc-motion-path','hyperframes:component'),('camera-rig-depth-stack','hyperframes:component'),('transitions-3d','hyperframes:block')]]
(P/'hyperframes.json').write_text(json.dumps(cfg,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
hashes={name:hashlib.sha256((C/name).read_bytes()).hexdigest() for name in ['hareket-tur2.mp4','hareket-ornek.mp4']}
assert len(set(hashes.values()))==1
report='''# Şablon 12 — Hareket / teslim raporu

**Seçilen tur: 2.** Genel 9,0; yenilik 9,5; hareket/animasyon 9,5; akıcılık 9,5 (Gemini 2.5 Flash). İki kalite turu tamamlandı; hedefe ulaşılınca ek tur açılmadı.

## Teslim dosyaları

- `hareket-ornek.mp4`: 1080×1920, H.264 + AAC, 30 fps, 21,333333 sn, 7.367.690 bayt. Seçilen tur 2 dosyasının SHA-256 eşleşmeli birebir kopyası.
- `hareket-ornek-telefon.mp4`: 720×1280, 30 fps, H.264 CRF26, preset fast, GOP30, AAC128k, faststart; aynı süre, 2.231.390 bayt.
- Düzenlenebilir proje: `kurgu/projeler/hareket/index.html`; kaynaklar assets içinde yerel. `index-tur1.html.bak`, `index-tur2.html.bak` ve her iki render saklandı.
- Önizleme: http://127.0.0.1:3002/#project/hareket (yerel servis açık olduğu sürece). HyperFrames masaüstü uygulamasıyla da düzenlenebilir: https://hyperframes.studio/studio/download?os=windows&src=cli

## Hareket teknikleri ve yaratıcı kararlar

1. İlk karede görünen başlık/gerçek fotoğraf kapak olur. BAKIŞIN karakterleri ayrı elastic yaylanır; DEĞİŞSİN harfleri farklı vuruşta scaleY/rotationX overshoot yapar. Bu, eski galeri şablonunun slot kelime döndürmesi değildir.
2. SVG kübik Bézier yayı üzerinde MotionPathPlugin ile oto yönelen altın vurgu, aynı anda çizilen yol. Kamera ve çizgi hareketi birbirini devralır.
3. İki gerçek fotoğrafta üçer derinlik katmanı: balkonun yakın mimarisi / şehir / gökyüzü ve manzaranın yakın bina-bitki / uzak şehir / gökyüzü. Ortak dolly-yörüngeye ek olarak ayrı hızlarda ±3/7/15 px kayma ve ±3/5/9 px yükselme. Yön ikinci fotoğrafta terslenir.
4. ŞEHRE ve YER AÇ kelimeleri maske arkasından farklı eksenlerde ve farklı easing ile çıkar; başlık okunurken hareket arka plana geçer.
5. SVG mimari açıklık stroke-dashoffset ile çizilir; sağ kapı kanadı path koordinatlarının interpolasyonuyla açılır. Tek kapı çerçevesi sahneden taşarak hareketi devreder; kat planı çiziminden odaya zoom tekrarlanmaz.
6. MOCK alan/fiyat kartının iki yüzü perspective + rotationY ile çevrilir. Ön yüz okunurken hafif perspektifle oturur, arka yüz expo eğrisiyle devralır. 3D oda galerisi/halkası kullanılmadı.
7. Kapanışta metinler okunur kalırken gerçek fotoğraf, perspektifli altın çerçeve ve mimari diyagonal şerit farklı hızlarda ilerler. Salt sabit kapanış yok.
8. `sine.inOut`, `expo`, `back.out`, `elastic.out` kullanıldı; left/top/width/height animasyonu, Math.random, Date, timer veya sonsuz tekrar yok.

Katalog bütünü `kurgu/hareket-katalog.json` dosyasına alındı. `arc-motion-path`, `camera-rig-depth-stack`, `transitions-3d` indirildi ve kaynakları `catalog-reference/*.txt` içinde korundu; fikirler dikey fotoğraf kullanımına uyarlandı. Kullanılmayan yatay demo sahneleri render'a bağlanmadı. Önceki şablonların slot/sayaç/WebGL iris/warp/analog/kâğıt/kat planı/rack focus/gündüz-gece/sanal döşeme/oda halkası teknikleri kullanılmadı.

## Katman ayırma ve doldurma

Ön/orta maskeler Pillow ile fotoğraf üzerindeki mimari sınırları izleyen elle tanımlı poligonlardan çıkarıldı. RGBA ön/orta dosyaları kaynak piksellerini taşır. Yerleşik imagegen edit aracıyla iki örtülü arka plaka üretildi; **görünen mimariyi yeniden çizmek yerine orijinal bina/balkon katmanları bu plakaların üstüne geri kondu**. Kaynak gökyüzü de maskeyle tabana geri yapıştırıldı. Üretim sadece katmanlar arasından açılabilecek dar kenarlara hizmet eder. İlk balkon denemesi istenen dolgu alanını yeterince açmadığı için seçilmedi. Nihai iki dosya `assets/balkon-fill.png`, `assets/manzara-fill.png`; tam komutlar ve kaynak dökümü `MEDYA.md` içinde.

Mimari orijinal katmanlarda korunur; küçük 2.5D kamera hareketi temsili derinliktir. Manuel maskeler hassas 3D rekonstrüksiyon değildir. Büyük kamera hareketleri için uygun değiller; kenar farkları bu nedenle dar tutuldu. AI sanal döşeme kullanılmadı.

## Müzik ve efektler

Zorunlu `npx --yes hyperframes@0.9.11 beats muzik/luxury-real-estate.mp3 --json` çalıştırıldı: 135 BPM, 96 vuruş; çıktı `kurgu/hareket-beats.json`. Müzik ilk ölçülen vuruş olan kaynak 1,825 sn'den başlar. Sahne kesimleri yaklaşık 8 vuruşta bir: 0 / 3,55 / 7,11 / 10,66 / 14,22 / 17,78 sn. Kare/vuruş farkı bir kareden küçüktür. Harf/kelime girişleri yarım/tek vuruş aralıklarıyla eşleşir.

Swoosh ve tık sabit tohumlu ffmpeg lavfi gürültüsünden, pop sönümlü sinüsten sentezlendi; üçüncü taraf SFX kaydı yok. Müzik son 0,733 sn'de söner. Son miks ortalama −17,4 dBFS, tepe −1,5 dBFS; dijital clipping yok. Ses anahtarlara göre ölçüldü ve Gemini'ye sesli video gönderildi; insan kulağıyla dinleme yapılmadı. Müzik kullanıcı dosyasıdır, lisansı bağımsız doğrulanmadı.

## Kalite turları

| Tur | Genel | Yenilik | Hareket/animasyon | Karar |
|---|---:|---:|---:|---|
| 1 | 7,5 (aynı yanıtta genel özet 8) | 6,5 | 7 | Yanlış video5 kaynağı mutfak gösterdiği için teslim dışı. |
| 2 | 9,0 | 9,5 | 9,5 | Doğru video6 balkon klibi; tüm hedefler sağlandı. Seçildi. |

Her tur: `check` → snapshot/temas sayfasını açarak inceleme → render → `izlet.py`. Tur 1 ilk kontrollerinde video oynatma sözleşmesi ve katman örtüşmesi düzeltildi; altın yazı kontrastı artırıldı ve 3D kart başlıktan ayrıldı. Son tur 1 ve tur 2 check sonuçları: **0 hata**, yalnız **7 nested_structure_needs_subcomposition** uyarısı (brifte izinli istisna). Runtime/layout/contrast/craft hatası ve diğer uyarı yok. Raporlar `check-turN.json`, `snapshot-turN/`, `render-turN.log`, `cikti/hareket-turN-elestiri.md` içinde.

İlk varsayılan Gemini değerlendirmesi pro kota 429 ve 3.5 aşırı talep 503 aldı; uzayan çağrı durdurulup iki tur da doğrudan Gemini 2.5 Flash ile değerlendirildi. Değerlendirme puanları öznel olup teknik doğrulamanın yerine geçmez. Tur 2 yorumundaki bölüm etiketlerinin 0,6 sn kaldığı iddiası yanlış: her biri 3,55–3,56 sn kesintisiz görünür. MOCK yazısı tek alt satırdır; yorumdaki çift kutu iddiası da kaynakla örtüşmez. Fotoğraflar drone çekimi değildir; eleştirideki drone ifadesi kamera hissini yanlış adlandırır.

## Kontrol listesi ve sınırlar

- [x] 1080×1920 / 30 fps / 21,333 sn; telefon kopyası 720×1280 CRF26.
- [x] İlk kare dolu kapak; render'dan çözülen `kapak.png` ve `render-kontrol.png` açıldı.
- [x] Metinler x72–930, y220–1440 güvenli sınırında; kaynak ve snapshot kontrolü. Okuma süresi kısa sloganlar için yeterli; CTA yaklaşık 3,55 sn. Check line_unread yok.
- [x] İki fotoğraf üçer katman; gizli kenarlara araçla dolgu, kaynak ön/orta pikselleri korunmuş.
- [x] Harf/kelime hareketleri, çizgi morphu, motion path, perspektifli 3D yüz çevirme.
- [x] Zaman çizelgesi boyunca kamera/grafik/video hareketi. 4 fps piksel farkı örneklemesinde tur 2 için **84 aralığın hiçbirinde aynı kalan kare çifti yok**, en küçük ortalama gri farkı 0,273/255. Bu ölçüm hareketin anlamını veya estetik kalitesini tek başına kanıtlamaz; timeline ve görsel incelemeyle birlikte değerlendirildi.
- [x] Nihai videoda tezgahsız mutfak/hortum/iç mekân inşaat artığı yok; tur 1 yanlış kaynak saklanmış, teslim edilmemiştir.
- [x] Fiyat 6.750.000 TL, alan 145 m², telefon 0 (555) 000 00 00 **MOCK**; gerçek ilan iddiası yok, ekranda belirtilir.
- [x] z-index katmanları; yerel font/GSAP; deterministik animasyon. Başka proje dosyası değiştirilmedi.
- [x] Her turun kaynak yedeği/render'ı ve eleştirisi korunmuş; şablon/teknik havuzu güncellendi.

En zayıf yan: dış çekimlerin benzerliği ve koyu kurumsal ton görüntünün ayrıntılarını geri plana atıyor. Kapanışın hareketli ince çerçevesi son anda MOCK dipnotuna yaklaşır; metin okunur kalır. Bunlar teslimi engelleyen check bulgusu değildir; puan hedefine ulaşınca brifteki gereksiz tur açmama kuralıyla mevcut sürüm korundu. PNG boyutu nedeniyle CLI iki katmanı HTML içine gömmediğini bildirdi; dosyalar assets içinde yerel olarak mevcut, render başarılı. Projeyi taşırken assets klasörünü birlikte taşıyın.

## Yeniden çalıştırma

Node için bu ortamda `NODE_OPTIONS=--preserve-symlinks --preserve-symlinks-main` gerekli. İlk çalıştırmanın WinGet lstat EPERM hatası böyle çözüldü. Önizleme günlük yolu izinli proje altına yönlendirildi; HTTP200 doğrulandı. Ana kaynak index.html ve assets ile doğrudan check/render yapılır; eski tur hazırlık betikleri arşivlenmiş gelişim adımlarıdır, final index yerine sırayla çalıştırılmaları gerekmez.
'''
(C/'hareket-ornek-RAPOR.md').write_text(report,encoding='utf-8')
(P/'REVIEW.md').write_text('''# Görsel değerlendirme

Tur 2 seçildi. Snapshot temas sayfalarının tamamı ve render'dan çözülen ilk/orta kareler açıldı. Metin/arka plan kontrastı, katman sırası ve kaynak güvenliği düzeltildi. Ölçülenler: boyut, fps, süre, ses tepe/ortalama, 4 fps piksel farkı, check bulguları ve dosya hash eşleşmesi. Görsel olarak bakılanlar: kaynak fotoğraflar, tüm sahneler, kapı morphu, kartın iki yüzü, CTA. İnsan kulağıyla ses dinlenmedi; video dış değerlendirmeye sesli gönderildi.

Genel9/yenilik9.5/hareket9.5. Etiket süreleriyle ilgili dış yorum kaynakla uyuşmadığı için uygulanmadı. En zayıf yan benzer dış görseller ve koyu ton; kapanış çerçevesinin dipnota yaklaşması. Korunan uyarı: 7 nested_structure (brifte istisna). Ayrıntılar cikti/hareket-ornek-RAPOR.md içinde.
''',encoding='utf-8')
entries={R/'kurgu/SABLONLAR.md':'''\n\n## Şablon 12 — hareket
Proje: `kurgu/projeler/hareket/`. 21,333 sn, 1080×1920, 30 fps. Sürekli anlamlı kamera/grafik hareketi; harf dalgası ve maskeli kelime girişi; MotionPath yayı; iki gerçek fotoğrafta elle maskelenmiş üçer katman ve imagegen örtülü kenar dolgusu; SVG kapı kanadı morphu; perspektifli çift yüzlü alan/fiyat kartı. Eski slot/sayaç/oda halkası/kat planı/iris teknikleri tekrarlanmaz.
135 BPM beats analizi; kaynak müzik 1,825 sn'den, 8 vuruşta bir sahne; ffmpeg sentezi swoosh/tık/pop. İlk kare kapak. Yerel font ve GSAP, transform animasyonu, deterministik timeline. Sabitlenmiş temiz balkon klibi video6; tezgahsız mutfak gösteren tur1 reddedildi.
İki tur: tur1 genel7,5 (özet8), yenilik6,5, hareket7; **tur2 genel9, yenilik9,5, hareket9,5, akıcılık9,5 — seçildi** (Gemini2.5Flash). Check0 hata, yalnız7 izinli nested_structure uyarısı. 4fps örneklemede durağan kare çifti yok. Fiyat/alan/telefon MOCK; sanal döşeme yok.
Teslim: `cikti/hareket-ornek.mp4`, `cikti/hareket-ornek-telefon.mp4` (720p CRF26), `cikti/hareket-ornek-RAPOR.md`. Her turun HTML yedeği, render, snapshot ve eleştirisi saklandı.
''',R/'kurgu/TEKNIK-HAVUZU.md':'''\n\n## 5. Şablon 12 — hareket ile eklenen teknikler
| # | Teknik | Uygulama / kaynak | Durum |
|---|---|---|---|
| 24 | Gerçek fotoğrafta üç düzlemli 2.5D | Elle poligon alfa + imagegen örtülü arka plaka; ön/orta kaynak pikselleri, ayrı hızda dolly/yörünge; `camera-rig-depth-stack` uyarlaması | ✓ hareket |
| 25 | Harf dalgası ve eksen değiştiren tipografi | Elastic karakter yayı + rotationX/scaleY; sonraki kelimede maske içi expo/back hareketi, slot yok | ✓ hareket |
| 26 | Yay üzerinde oto yönelen vurgu | SVG Bézier izi ve MotionPathPlugin ile çizgi üzerindeki işaret; `arc-motion-path` dikey uyarlaması | ✓ hareket |
| 27 | Açılan kapı kanadı path morphu | Mimari açıklık çizilir, SVG d koordinatlarıyla kanat açılır; kat planı değildir | ✓ hareket |
| 28 | Perspektifli çift yüzlü bilgi dönüşü | `transitions-3d` prensibiyle rotationY ve backface-visibility; oda halkası yerine tek bilgi kartı | ✓ hareket |

Ders: Kontakt sayfasında görüntü sırasından video adı tahmin etme; her küçük görseli gerçek dosya adıyla üret. LLM puanlarını kaynak süreleriyle karşılaştır: 3,55sn görünen bölüm etiketi 0,6sn diye yorumlanabiliyor. Check0 hata + video ölçümü + gözle temas sayfası incelemesi birlikte gerekir.
'''}
for path,entry in entries.items():
 content=path.read_text(encoding='utf-8')
 if ('## Şablon 12 — hareket' if path.name=='SABLONLAR.md' else '## 5. Şablon 12 — hareket') not in content:
  path.write_text(content+entry,encoding='utf-8')
(P/'teslim-dogrulama.json').write_text(json.dumps({'selectedRound':2,'hashes':hashes,'matched':True},indent=2),encoding='utf-8')
print('Teslim raporu, şablon kaydı ve teknik havuzu güncellendi. Hash eşleşiyor.')
