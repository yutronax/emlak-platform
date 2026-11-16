from pathlib import Path
import json,shutil,subprocess,sys,hashlib
from PIL import Image,ImageChops
R=Path(__file__).resolve().parents[1];P=R/'kurgu/projeler/yz';n=int(sys.argv[1])
shutil.copy(P/f'index-tur{n}.html.bak',P/'index.html')
shutil.copy(R/f'cikti/yz-tur{n}.mp4',R/'cikti/yz-ornek.mp4')
subprocess.run(['ffmpeg','-v','error','-y','-i',str(R/'cikti/yz-ornek.mp4'),'-vf','scale=720:1280','-c:v','libx264','-preset','fast','-crf','26','-c:a','aac','-b:a','128k','-movflags','+faststart',str(R/'cikti/yz-ornek-telefon.mp4')],check=True)
checks=[]
for f in sorted((P/'snapshot-tur3').glob('frame-*.png')):
    g=P/'snapshot-tur4'/f.name
    if g.exists():checks.append({'frame':f.name,'equal':ImageChops.difference(Image.open(f).convert('RGB'),Image.open(g).convert('RGB')).getbbox() is None})
(P/'tur3-tur4-kare-karsilastirma.json').write_text(json.dumps(checks,ensure_ascii=False,indent=2),encoding='utf-8')
print('tur3/tur4 aynı kare:',sum(x['equal'] for x in checks),'/',len(checks))
metadata={}
for name in ['yz-ornek.mp4','yz-ornek-telefon.mp4']:
    f=R/'cikti'/name
    r=subprocess.run(['ffprobe','-v','error','-show_entries','stream=codec_type,width,height,r_frame_rate','-show_entries','format=duration,size','-of','json',str(f)],capture_output=True,encoding='utf-8',check=True)
    metadata[name]={'sha256':hashlib.sha256(f.read_bytes()).hexdigest(),'probe':json.loads(r.stdout)}
(P/'teslim-kontrol.json').write_text(json.dumps(metadata,ensure_ascii=False,indent=2),encoding='utf-8')
# UTF-8 append only: preserve all previous template entries.
section='''

## Şablon 11 — Olasılık
Proje: `kurgu/projeler/yz/`; hazırlık `kurgu/yz_hazirla.py`, kompozisyon `kurgu/yz_kompozisyon.py`.
24 saniye, 1080×1920, 30 fps. İki yeni sanal oda yerleşik image_gen ile üretildi; mevcut salon kullanıldı.
Salon: ışık halkası/iris; yatak odası: kamera eşleşmeli çözülme; çalışma odası: bitki–masa–sandalye merkezli üç SVG maskesinin birleşmesi. Eşik'in kaydırıcısı tekrarlanmaz.
19,651 sn Türkçe Gemini TTS (Charon); 64 px kısa söz grubu altyazıları; müzik 0,18.
Döşeli her sahnede 42 px temsilîlik etiketi, kapanışta AI ses ve döşeme bildirimi. Borular ve eksik tesisat korunur.
Tur puanları (genel/yenilik/AI dürüstlüğü): 1=6/6/7, 2=8/9/10, 3=9,3/9,5/10. Son teknik tur 4 yalnız z-index uygunluğunu tamamlar; ayrıntı ve seçilen tur teslim raporundadır.
Check: 0 hata; yalnız 22 nested_structure uyarısı. Teslim `cikti/yz-ornek.mp4`, `cikti/yz-ornek-telefon.mp4`.
Rapor: `cikti/yz-ornek-RAPOR.md`. Fiyat, m², telefon ve konum verilmediği için kullanılmadı; MOCK alan yok.
'''
f=R/'kurgu/SABLONLAR.md';s=f.read_text(encoding='utf-8')
if '## Şablon 11 — Olasılık' not in s:f.write_text(s+section,encoding='utf-8')
section='''

## 4. Şablon 11 — Olasılık ile eklenen teknikler
| # | Teknik | Uygulama / kaynak | Durum |
|---|---|---|---|
| 21 | Sanal döşemenin oda içinden açılması | Katalog `transitions-radial` incelendi; aynı gerçek fotoğrafta circle clip-path + eşleşmiş kamera transformu, tek halka | ✓ Olasılık |
| 22 | Mobilya merkezli çok odaklı belirme | SVG maskesinde bitki, masa ve sandalye konumlarından büyüyen üç daire birleşir; yapı sabit kalır | ✓ Olasılık |
| 23 | Dürüst AI ses + sanal oda anlatısı | Gemini TTS; ffmpeg sessizlik ölçümü; 64 px kısa söz grubu altyazıları; her döşeli sahnede etiket ve 6 sn üretim bildirimi | ✓ Olasılık |

Ders: Etiketi yatağın/masanın üzerinden üst banda al. Metni küçültmek yerine kısa gruplara böl.
Her görsel üretiminden sonra gerçek kaynakla yan yana karşılaştırmayı aç; boru, kablo ve pencere bantlarını silme.
LLM eleştirisini ölçümle birlikte değerlendir: yaklaşık zamanlar, mevcut efektler ve sabit kapanış süresi yanlış yorumlanabilir.
'''
f=R/'kurgu/TEKNIK-HAVUZU.md';s=f.read_text(encoding='utf-8')
if '## 4. Şablon 11 — Olasılık' not in s:f.write_text(s+section,encoding='utf-8')
print('Teslim ve ortak belgeler hazır; seçilen tur',n)
