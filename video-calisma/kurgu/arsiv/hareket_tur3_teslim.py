from pathlib import Path
import hashlib,json,shutil,subprocess
R=Path(__file__).resolve().parent.parent; P=R/'kurgu/projeler/hareket'
review=R/'cikti/hareket-tur3-elestiri.md'
if not review.exists(): raise SystemExit('Değerlendirme bekleniyor; teslim değiştirilmedi.')
for src,dst in [('hareket-tur3.mp4','hareket-ornek.mp4'),('hareket-tur3-telefon.mp4','hareket-ornek-telefon.mp4')]: shutil.copy2(R/'cikti'/src,R/'cikti'/dst)
checks=json.loads((P/'check-tur3.json').read_text(encoding='utf-8-sig'))
counts={k:{x:v.get(x,0) for x in ['errorCount','warningCount']} for k,v in checks.items() if isinstance(v,dict) and 'errorCount' in v}
files={f:{'bytes':(R/'cikti'/f).stat().st_size,'sha256':hashlib.sha256((R/'cikti'/f).read_bytes()).hexdigest()} for f in ['hareket-tur3.mp4','hareket-ornek.mp4','hareket-ornek-telefon.mp4']}
(P/'teslim-dogrulama-tur3.json').write_text(json.dumps({'checks':counts,'files':files},ensure_ascii=False,indent=2),encoding='utf-8')
report='''# Şablon 12 — hareket / tur 3 düzeltme raporu

Seçilen sürüm: **tur 3**. Tur 2 kullanıcının görsel incelemesinde reddedildi; önceki otomatik yüksek puan bu kusurları yakalayamadı. Tur 2 raporu `hareket-tur2-RAPOR-arsiv.md` içinde tarihsel kayıt olarak korunur.

## Düzeltilen üç konu

- Fiyat **X.XXX.XXX TL**, telefon **0 (5XX) XXX XX XX**. Ekranda MOCK, alan için **145 m² temsilidir** notu var.
- Altı bölümde altı ayrı kaynak: video3 oda karesi → balkon fotoğrafı → hol fotoğrafı → video9 banyo → manzara fotoğrafı → salon fotoğrafı. İlk 13 saniye dört farklı mekân gösterir.
- Görüntüler 1080×1920 tam ekran; ortadaki dar şerit görünümü kaldırıldı. Lacivert ton yalnız şeffaf gradyandır; yazılar görüntü üstündedir. Metin gölgesi kontrastı destekler. Fiyat kartı kısa süreli, yerel bir yüzeydir.

## Hareket ve katmanlar

Harf bazında elastic/back yaylanma; iki eksenli maskeli kelime girişleri; Bézier yayı üzerinde yönlenen MotionPath vurgusu; SVG çizilme ve kapı kanadı morphu; iki yüzlü perspektifli kart; kapanışta kamera, çerçeve ve diyagonal şeridin farklı hareketleri korunur. Tüm kamera tween'leri süre boyunca çalışır, rastgelelik veya sonsuz tekrar yoktur. Kesimler 135 BPM müziğin yaklaşık sekiz vuruş aralıklarına bağlıdır. Swoosh/tık/pop yerel sentezdir.

Paralaks iki farklı fotoğrafa uygulanır: **balkon ve hol**. Balkonun önceki turdaki özgün ön/orta maskeleri ve örtülü kenar dolgusu korunur. Holde Pillow ile uzak kapı/orta alan/yakın duvar ayrıldı; arka taban özgün fotoğraftır, yeni üretken dolgu yapılmadı. Ortak dolly/yörüngeye ek ±3/7/15 px katman hareketi vardır. Bu sınırlı 2.5D yaklaşımdır; büyük kamera açıları için uygun değildir, kenar tekrarını tamamen çözen 3D rekonstrüksiyon iddiası yoktur.

Salonun solundaki tezgahsız mutfak, oda karesindeki sol tesisat ve tavandaki kablo kırpılarak dışarıda bırakıldı. Video5, önceki incelemede mutfak gösterdiği doğrulandığından hol için kullanılmadı; gerçek koridor fotoğrafı seçildi. Banyo video9 kısa olduğu için 0,65x yavaşlatıldı ve sabitlendi. Sanal döşeme kullanılmadı. Kaynaklar ve kırpmalar `MEDYA.md` içinde.

## Doğrulama ve teslim

`check-tur3.json`: **0 hata**; yalnız brifte izin verilen 7 `nested_structure_needs_subcomposition` uyarısı. Kontrast 39/39 geçti; runtime/layout/craft/audio hata veya başka uyarı yok.

Check → snapshot → contact sheet ve ayrı açılış/hol karesini açma → render → render'dan banyo karesini açma → izlet.py sırası tamamlandı. Görsel incelemede fotoğraflar kenarlara kadar devam ediyor; üst/alt boş lacivert panel yok.

Ana çıktı `hareket-ornek.mp4`, tur 3 render'ıyla SHA-256 eşleşir. 1080×1920, 30 fps, 21,333333 sn. Telefon: `hareket-ornek-telefon.mp4`, 720×1280, CRF26, fast, GOP30, AAC128k, faststart. Boyut/hash kanıtı `teslim-dogrulama-tur3.json` içinde.

Değişiklik öncesi kaynak `index-tur3.html.bak` (tur 2 ile aynı hash); değişiklik sonrası `index-tur3-final.html`. Tur 1–2 render/yedekleri saklandı. Güncel kaynak `index.html` ve yerel assets klasörüdür. Yeniden hazırlama betiği mevcut yedeği üzerine yazmaz.

## Turlar ve değerlendirme

Tur 1: genel 7,5 / yenilik 6,5 / hareket 7; yanlış mutfak görüntüsü nedeniyle reddedildi.
Tur 2: genel 9 / yenilik 9,5 / hareket 9,5; kullanıcı gerçekçi MOCK, tekrar ve boş alan nedeniyle reddetti.
Tur 3: kullanıcının üç düzeltmesi uygulandı. Aşağıda izlet.py'nin değişmeden eklenen değerlendirmesi bulunur. Puanlar öznel değerlendirmedir; teknik geçiş veya kullanıcı onayı yerine geçmez. İlk API çağrısı bütün modellerde 429/503 ile sonuçlandı ve yeniden denendi.

## Sınırlar

Kaynaklar döşenmemiş yapıya aittir; yüzeylerin bitiş durumu fotoğrafın kendisinde görülür. Açılış ve kapanışta yakın kırpma görüntü çözünürlüğünü azaltır. Manuel paralaks maskeleri fiziksel derinlik haritası değildir. Müzik kullanıcı dosyasıdır; lisansı bağımsız doğrulanmadı. Sonraki düzenleme HyperFrames masaüstü uygulamasında yapılabilir: https://hyperframes.studio/studio/download?os=windows&src=cli

## izlet.py çıktısı

'''+review.read_text(encoding='utf-8')
(R/'cikti/hareket-ornek-RAPOR.md').write_text(report,encoding='utf-8')
sab=R/'kurgu/SABLONLAR.md';s=sab.read_text(encoding='utf-8');marker='## Şablon 12 — hareket'
s=s[:s.index(marker)]+'''## Şablon 12 — hareket
Proje: `kurgu/projeler/hareket/`. **Tur 3 seçildi**; tur 2 kullanıcı incelemesinde reddedildi (gerçekçi MOCK, manzara tekrarı, boş alan).
21,333 sn, 1080×1920, 30 fps. Altı bölüm/altı farklı kaynak: oda, balkon, hol, banyo, manzara, salon. Görüntü tam ekran; yazılar şeffaf gradyan ve gölgeyle görüntü üzerinde. Tezgahsız mutfak ve tesisat kadraj dışında tutulur.
Harf dalgası, maskeli kelime girişi, MotionPath yayı, balkon+hol fotoğraflarında üçer paralaks katmanı, SVG kapı morphu, perspektifli çift yüzlü kart. 135 BPM, sentez swoosh/tık/pop; deterministik GSAP kamera.
Fiyat **X.XXX.XXX TL**, telefon **0 (5XX) XXX XX XX**, **145 m² temsilidir**. Sanal döşeme yok. Check: 0 hata, yalnız 7 izinli nested_structure uyarısı. Snapshot/contact sheet ve render karesi açılarak incelendi; izlet.py hareket/yenilik/görüntü çeşitliliği değerlendirmesi raporda.
Teslim: `cikti/hareket-ornek.mp4`, `cikti/hareket-ornek-telefon.mp4` (720p CRF26), `cikti/hareket-ornek-RAPOR.md`. Tur3 öncesi yedek `index-tur3.html.bak`, final kaynak `index-tur3-final.html`; eski turlar korunur.
'''
sab.write_text(s,encoding='utf-8')
(P/'REVIEW.md').write_text('Tur 3: 0 hata; snapshot/contact sheet, açılış ve hol PNG, render banyo PNG açılıp incelendi. Altı kaynak, tam ekran, X yer tutucular. Ayrıntı ve izlet.py eleştirisi: cikti/hareket-ornek-RAPOR.md.\n',encoding='utf-8')
print(json.dumps({'checks':counts,'files':files},ensure_ascii=False,indent=2))
