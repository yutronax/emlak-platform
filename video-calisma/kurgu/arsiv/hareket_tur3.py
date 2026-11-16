from pathlib import Path
import shutil, subprocess, sys
from PIL import Image, ImageDraw, ImageFilter
R=Path(__file__).resolve().parent.parent
P=R/'kurgu/projeler/hareket'; A=P/'assets'
p=P/'index.html'
if not (P/'index-tur3.html.bak').exists():
 shutil.copy2(p,P/'index-tur3.html.bak')
s=p.read_text(encoding='utf-8')
s=s.replace('6.750.000 TL','X.XXX.XXX TL').replace('0 (555) 000 00 00','0 (5XX) XXX XX XX')
s=s.replace('Fiyat ve alan MOCK.','MOCK · 145 m² temsilidir.')
s=s.replace('background:linear-gradient(180deg,#16213E 0%,#16213Ef5 38%,#16213E22 46%,#16213E00 53%,#16213Eee 76%,#16213E 100%)','background:linear-gradient(180deg,#16213E30 0%,#16213E99 22%,#16213E88 40%,#16213E00 55%,#16213E22 65%,#16213Eaa 79%,#16213E30 100%)')
s=s.replace('style="background:#16213Eeb"','style="background:linear-gradient(90deg,#16213Ebb,#16213E44)"')
s=s.replace('.copy{','.copy{text-shadow:0 3px 12px #000;').replace('.bottom{','.bottom{text-shadow:0 3px 12px #000;')
s=s.replace('src="assets/balkon-original.jpg" alt="Gerçek balkon manzarası"','src="assets/oda-clean.jpg" alt="Gerçek oda görüntüsü"')
s=s.replace('Bir fotoğraftan','Yeni bir odada').replace('fazlasını gör.','ihtimalleri gör.')
s=s.replace('assets/manzara-back.jpg','assets/koridor-back.jpg').replace('assets/manzara-mid.png','assets/koridor-mid.png').replace('assets/manzara-front.png','assets/koridor-front.png')
s=s.replace('02 / MANZARA','02 / HOL').replace('>ŞEHRE<','>İÇERİ<').replace('>YER AÇ.<','>ADIM AT.<').replace('Yeni bir perspektif.','Mekânlar birbirine açılır.')
s=s.replace('src="assets/balkon-clean.mp4"','src="assets/banyo-clean.mp4"')
s=s.replace('03 / KEŞİF','03 / BANYO')
s=s.replace('assets/balkon-end.jpg','assets/salon-clean.jpg')
# Two genuinely different photographs: existing balcony and corridor.
im=Image.open(R/'capcut/medya2/koridor.jpg').convert('RGB').resize((1080,1920))
im.save(A/'koridor-back.jpg',quality=97)
for name,points in [('mid',[(340,500),(760,500),(760,1920),(340,1920)]),('front',[(0,0),(330,0),(330,1920),(0,1920)])]:
 mask=Image.new('L',im.size); ImageDraw.Draw(mask).polygon(points,fill=255)
 layer=im.convert('RGBA');layer.putalpha(mask);layer.save(A/f'koridor-{name}.png')
# Corridor displacements remain within the existing wall surface; no synthetic architecture.
s=s.replace("depth('m',7.11,3.55,-1);","depth('m',7.11,3.55,-1);")
sys.path.insert(0,str(R/'kurgu'))
from kur import klip_hazirla
klip_hazirla({'src':'capcut/medya5/video9.mp4','bas':0,'hiz':0.65,'sabitle':True,'kirp_alt':0.10},str(A/'banyo-clean.mp4'),3.56)
for src,name,vf in [('capcut/medya5/video3.mp4','oda-clean.jpg','crop=iw*0.76:ih*0.78:iw*0.24:ih*0.12,scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920'),('capcut/medya2/salon.jpg','salon-clean.jpg','crop=iw*0.60:ih:iw*0.40:0,scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920')]:
 subprocess.run(['ffmpeg','-v','error','-y','-i',str(R/src),'-frames:v','1','-vf',vf,str(A/name)],check=True)
p.write_text(s,encoding='utf-8')
print('Tur 3: backup and six distinct sources ready')
