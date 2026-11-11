from pathlib import Path
import re,shutil,subprocess
from PIL import Image,ImageFilter,ImageDraw,ImageEnhance
p=Path(__file__).parent/'projeler/plan'; a=p/'assets'; root=Path(__file__).parent.parent; f=p/'index.html'
shutil.copyfile(root/'cikti/plan-ornek-elestiri.md',root/'cikti/plan-tur2-elestiri.md')
shutil.copyfile(root/'cikti/plan-ornek.mp4',root/'cikti/plan-tur2.mp4')
shutil.copyfile(f,p/'index-tur2.html.bak')
s=f.read_text(encoding='utf-8')
for name in ['salon','oda']:
 subprocess.run(['ffmpeg','-v','error','-y','-i',str(a/(name+'.mp4')),'-vf','eq=brightness=0.018:contrast=1.035:saturation=1.06,colorbalance=rm=0.025:bm=-0.018','-an','-c:v','libx264','-crf','17','-preset','fast','-g','30',str(a/(name+'-sicak.mp4'))],check=True)
 s=s.replace(f'assets/{name}.mp4',f'assets/{name}-sicak.mp4')
im=Image.open(a/'banyo.jpg').crop((600,800,1050,1600)).resize((1080,1920),Image.Resampling.LANCZOS)
im=ImageEnhance.Brightness(im).enhance(1.07); im=ImageEnhance.Contrast(im).enhance(1.04)
im.save(a/'banyo-detay-son.jpg')
blur=im.filter(ImageFilter.GaussianBlur(13)); mask=Image.new('L',im.size,0)
ImageDraw.Draw(mask).rectangle((25,0,180,1920),fill=255); mask=mask.filter(ImageFilter.GaussianBlur(28))
front=Image.composite(im,blur,mask); back=Image.composite(blur,im,mask)
proc=subprocess.Popen(['ffmpeg','-v','error','-y','-f','rawvideo','-pix_fmt','rgb24','-s','1080x1920','-r','30','-i','-','-an','-c:v','libx264','-crf','17','-preset','fast','-g','30',str(a/'banyo-focus-son.mp4')],stdin=subprocess.PIPE)
for n in range(144):
 t=max(0,min(1,(n/30-1.5)/1.3));t=t*t*(3-2*t);proc.stdin.write(Image.blend(front,back,t).tobytes())
proc.stdin.close()
if proc.wait():raise RuntimeError('Banyo hazırlığı başarısız')
s=s.replace('assets/banyo-focus.mp4','assets/banyo-focus-son.mp4')
s=re.sub(r'data-start="([0-9.]+)"',lambda m:f'data-start="{float(m[1])-1:g}"' if float(m[1])>=3 else m[0],s)
s=s.replace('data-duration="3"','data-duration="2"').replace('data-duration="8"','data-duration="5"').replace('data-duration="30"','data-duration="26"')
for old,new in [('t:3,','t:2,'),('t:7.8,','t:6.8,'),('t:12.6,','t:11.6,'),('t:17.4,','t:16.4,')]:s=s.replace(old,new)
for old,new in [('},22);','},21);'),('},23.2);','},22);'),('},22.4);','},21.4);'),('},22.7);','},21.7);'),('},23);','},22);')]:s=s.replace(old,new)
s=s.replace('duration:2.3,ease:', 'duration:1.6,ease:',1)
s=s.replace("opacity:1,duration:2.6", "opacity:1,duration:2.1")
s=s.replace('M130 650H900V1250H130Z M500 650V1250 M130 930H500 M500 850H900 M500 1060H900 M690 850V1060','M130 650H900V1250H130Z M500 650V1250 M130 930H500 M500 850H900 M500 1060H900 M690 850V1060 M130 650V560H500V650')
s=s.replace('<text class="plan-label" x="215" y="800">','<text class="plan-label" x="220" y="620">BALKON</text><text class="plan-label" x="215" y="800">')
s=s.replace("slug:'balkon',t:16.4,rect:[130,650,370,280]","slug:'balkon',t:16.4,rect:[130,560,370,90]")
s=re.sub(r'(<rect class="selected" x="130" y=")650(" width="370" height=")280("/></svg>\s*<div[^>]*id="visual3")',r'\g<1>560\g<2>90\3',s)
f.write_text(s,encoding='utf-8')
