"""Eşik: yalnız bu projeye ait, UTF-8 ve tekrar üretilebilir medya hazırlığı."""
from pathlib import Path
import subprocess, shutil, json, sys
from PIL import Image, ImageOps, ImageDraw
ROOT=Path(__file__).resolve().parents[1]
P=ROOT/'kurgu/projeler/esik'; A=P/'assets'; A.mkdir(parents=True,exist_ok=True)
def ff(*args):
    subprocess.run(['ffmpeg','-v','error','-y',*map(str,args)],check=True)
def sheet(files,target):
    out=Image.new('RGB',(1200,((len(files)+3)//4)*470),'#16213e'); d=ImageDraw.Draw(out)
    for i,p in enumerate(files):
        im=ImageOps.contain(Image.open(p).convert('RGB'),(288,425)); x=i%4*300; y=i//4*470
        out.paste(im,(x,y)); d.text((x+8,y+432),p.stem,fill='white')
    out.save(target)
if '--inspect' in sys.argv:
    files=list((ROOT/'capcut/medya2').glob('*.jpg'))
    for p in sorted((ROOT/'capcut/medya5').glob('*.mp4')):
        t=A/(p.stem+'.jpg'); ff('-ss',1,'-i',p,'-frames:v',1,t); files.append(t)
    sheet(files,A/'kaynaklar.jpg'); sys.exit()
for n in ['package.json','hyperframes.json','AGENTS.md','CLAUDE.md']:
    shutil.copy(ROOT/'hyperframes/ilan'/n,P/n)
for src,dst in [('marka/inza-logo-saydam.png','logo.png'),('varliklar/font/BebasNeue-Regular.ttf','BebasNeue.ttf'),('muzik/luxury-real-estate.mp3','muzik.mp3')]:
    shutil.copy(ROOT/src,A/dst)
shutil.copy('C:/Windows/Fonts/segoeui.ttf',A/'Metin.ttf')
for name in ['oda2','banyo','manzara']:
    src='oda1' if name=='oda2' else name
    im=Image.open(ROOT/f'capcut/medya2/{src}.jpg').convert('RGB')
    w,h=im.size
    if name=='oda2': im=im.crop((0,int(h*.16),int(w*.83),int(h*.94)))
    if name=='banyo': im=im.crop((int(w*.25),int(h*.10),int(w*.95),int(h*.62)))
    if name=='manzara': im=im.crop((0,0,int(w*.45),int(h*.82)))
    im=ImageOps.fit(im,(1080,1920))
    im.save(A/f'{name}.jpg',quality=95)
ff('-i',A/'oda2.jpg','-vf','eq=brightness=0.065:gamma=1.10:contrast=1.06:saturation=1.18,colorbalance=rs=0.07:bs=-0.07:rm=0.045:bm=-0.035','-frames:v',1,A/'oda-renk.jpg')
shutil.copy(A/'oda2.jpg',A/'oda2-use2.jpg')
shutil.copy(A/'manzara.jpg',A/'manzara-use3.jpg')
im=Image.open(A/'manzara.jpg');ImageOps.fit(im.crop((0,0,1080,540)),(1200,650)).save(A/'bulut.jpg',quality=95)
ff('-ss','1','-i',ROOT/'capcut/medya5/video3.mp4','-vf','crop=820:1260:150:400,scale=1080:1920','-frames:v',1,A/'oda-detay.jpg')
# Gerçek hareketli manzara klibi: hazırlıkta seçilen temiz dış çekim.
ff('-ss','0.5','-i',ROOT/'capcut/medya5/video6.mp4','-t','6','-vf','scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,fps=30','-an','-c:v','libx264','-preset','fast','-g','30','-crf','19',A/'dis.mp4')
ff('-i',A/'dis.mp4','-frames:v',1,A/'dis.jpg')
expr='0.25*sin(2*PI*(880*t+180*t*t))*exp(-7*t)+0.12*sin(2*PI*1320*t)*exp(-11*t)+0.08*sin(2*PI*1760*t)*exp(-16*t)'
ff('-f','lavfi','-i',f'aevalsrc={expr}:s=48000:d=0.45','-af','afade=t=in:d=0.008,afade=t=out:st=0.30:d=0.15',A/'cam.wav')
(P/'meta.json').write_text(json.dumps({'id':'esik','name':'İNZA — Eşik','width':1080,'height':1920,'fps':30},ensure_ascii=False),encoding='utf-8')
