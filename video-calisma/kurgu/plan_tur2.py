from pathlib import Path
import re,shutil,subprocess
from PIL import Image,ImageFilter,ImageDraw
p=Path(__file__).parent/'projeler/plan'; a=p/'assets'; f=p/'index.html'
root=Path(__file__).parent.parent
shutil.copyfile(root/'cikti/plan-ornek-elestiri.md',root/'cikti/plan-tur1-elestiri.md')
shutil.copyfile(f,p/'index-tur1.html.bak')
s=f.read_text(encoding='utf-8')
# Kapı kolu ve duş rayı; yazı/ambalaj kadraj dışında. İki düzlemli odak
# gerçek optik çekim olarak sunulmaz; dışarıda hesaplanıp yerel video olur.
im=Image.open(a/'banyo.jpg').crop((600,600,1050,1400)).resize((1080,1920),Image.Resampling.LANCZOS)
im.save(a/'banyo-detay.jpg')
blur=im.filter(ImageFilter.GaussianBlur(13))
mask=Image.new('L',im.size,0); ImageDraw.Draw(mask).rectangle((25,0,180,1920),fill=255)
mask=mask.filter(ImageFilter.GaussianBlur(28))
front=Image.composite(im,blur,mask); back=Image.composite(blur,im,mask)
proc=subprocess.Popen(['ffmpeg','-v','error','-y','-f','rawvideo','-pix_fmt','rgb24','-s','1080x1920','-r','30','-i','-','-an','-c:v','libx264','-crf','17','-preset','fast','-g','30',str(a/'banyo-focus.mp4')],stdin=subprocess.PIPE)
for n in range(144):
 t=max(0,min(1,(n/30-1.5)/1.3)); t=t*t*(3-2*t)
 proc.stdin.write(Image.blend(front,back,t).tobytes())
proc.stdin.close()
if proc.wait(): raise RuntimeError('Banyo video hazırlığı başarısız')
s=re.sub(r'<div[^>]*id="visual2".*?</div></div></div>', '<video id="visual2" class="clip media" style="z-index:40" src="assets/banyo-focus.mp4" muted playsinline data-start="14.6" data-duration="4.8" data-media-start="0" data-track-index="26"></video><div id="tone2" class="clip tone" style="z-index:41" data-start="14.6" data-duration="4.8" data-track-index="27"></div>',s,count=1,flags=re.S)
s=re.sub(r"tl.fromTo\('#focus-(?:back|front)'.*?;",'',s)
# 3sn kapak; kazanç gece etüdüne ayrılır. Metin baştan görünür.
s=re.sub(r'data-start="([0-9.]+)"',lambda m:f'data-start="{float(m[1])-2:g}"' if float(m[1])>=5 else m[0],s)
s=s.replace('data-duration="5"','data-duration="3"').replace('data-duration="6"','data-duration="8"')
for old,new in [('t:5,','t:3,'),('t:9.8,','t:7.8,'),('t:14.6,','t:12.6,'),('t:19.4,','t:17.4,')]: s=s.replace(old,new)
for old,new in [('},24);','},22);'),('},25.2);','},23.2);'),('},24.4);','},22.4);'),('},24.7);','},22.7);'),('},25);','},23);')]:s=s.replace(old,new)
s=s.replace('duration:2.6,ease:', 'duration:2.3,ease:',1)
s=s.replace('<path class="walls" data-hold="true"','<path style="opacity:.15" class="walls" data-hold="true"')
s=s.replace('data-volume="0.22"','data-volume="0.36"')
# Yeni vuruş değil, çizim hareketine kısa teknik kalem sesi.
subprocess.run(['ffmpeg','-v','error','-y','-f','lavfi','-i','anoisesrc=color=pink:duration=0.35:amplitude=0.2','-af','highpass=f=1900,lowpass=f=5000,afade=t=out:st=0.05:d=0.3',str(a/'kalem.wav')],check=True)
s=s.replace('</div>\n<script>','<audio id="pencil" src="assets/kalem.wav" data-start="0.2" data-duration="0.35" data-volume="0.4" data-track-index="40"></audio></div>\n<script>')
f.write_text(s,encoding='utf-8')
