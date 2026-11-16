from pathlib import Path
import shutil, subprocess, json, sys
from PIL import Image, ImageOps, ImageDraw
R=Path(__file__).resolve().parents[1]
P=R/'kurgu/projeler/yz'; A=P/'assets'; A.mkdir(parents=True,exist_ok=True)
for n in ['package.json','hyperframes.json','AGENTS.md','CLAUDE.md']:
    if not (P/n).exists(): shutil.copy(R/'hyperframes/ilan'/n,P/n)
for src,dst in [('marka/inza-logo-saydam.png','logo.png'),('varliklar/font/BebasNeue-Regular.ttf','BebasNeue.ttf'),('muzik/luxury-real-estate.mp3','muzik.mp3')]: shutil.copy(R/src,A/dst)
shutil.copy('C:/Windows/Fonts/segoeui.ttf',A/'Metin.ttf')
V=R/'varliklar/yz'; V.mkdir(parents=True,exist_ok=True)
if '--compare' in sys.argv:
    for n in ['oda1','oda2','salon']:
        a=R/f'capcut/medya2/{n}.jpg'; b=V/f'{n}_doseli.png'
        if not b.exists(): continue
        sheet=Image.new('RGB',(1440,730),'#16213e'); d=ImageDraw.Draw(sheet)
        for i,s in enumerate([a,b]):
            im=ImageOps.contain(Image.open(s).convert('RGB'),(710,680)); sheet.paste(im,(i*720+(710-im.width)//2,40))
        d.text((20,10),'ORIGINAL',fill='white');d.text((740,10),'AI VIRTUAL STAGING',fill='white')
        sheet.save(V/f'{n}_karsilastirma.jpg')
    sys.exit()
for n in ['salon','oda1','oda2']:
    for suffix,src in [('bos',R/f'capcut/medya2/{n}.jpg'),('doseli',V/f'{n}_doseli.png')]:
        im=Image.open(src).convert('RGB'); im.save(A/f'{n}-{suffix}.jpg',quality=96)
(P/'meta.json').write_text(json.dumps({'id':'yz','name':'İNZA — Olasılık','width':1080,'height':1920,'fps':30},ensure_ascii=False),encoding='utf-8')
subprocess.run(['ffmpeg','-v','error','-y','-f','lavfi','-i','aevalsrc=0.18*sin(2*PI*(420*t+500*t*t))*exp(-5*t):s=48000:d=0.8','-af','afade=t=in:d=0.03,afade=t=out:st=0.3:d=0.5',str(A/'belirme.wav')],check=True)
