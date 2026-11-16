"""Plan şablonu: kaynak kontrolü, sabitlenmiş medya ve yerel varlıklar."""
import sys, shutil, json, subprocess
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
from kur import KOK, klip_hazirla
from PIL import Image, ImageOps, ImageDraw
ROOT = Path(KOK)
P = ROOT / 'kurgu/projeler/plan'
A = P / 'assets'
A.mkdir(parents=True, exist_ok=True)
def sheet(files, target):
    out = Image.new('RGB', (1000, ((len(files)+3)//4)*370), '#16213e')
    d = ImageDraw.Draw(out)
    for i,f in enumerate(files):
        im=Image.open(f); im.thumbnail((240,330))
        x=(i%4)*250; y=(i//4)*370
        out.paste(im,(x,y)); d.text((x,y+335),Path(f).name,fill='white')
    out.save(target)
if __name__ == '__main__':
    if '--inspect' in sys.argv:
        files=[]
        for f in sorted((ROOT/'capcut/medya5').glob('*.mp4')):
            target=A/(f.stem+'-kaynak.jpg')
            subprocess.run(['ffmpeg','-v','error','-y','-ss','1','-i',str(f),'-frames:v','1',str(target)],check=True)
            files.append(target)
        files+=list((ROOT/'capcut/medya2').glob('*.jpg'))
        sheet(files,A/'kaynaklar.jpg')
    else:
        for name,src in [('salon','video1'),('oda','video3')]:
            raw=A/(name+'-hazir.mp4')
            klip_hazirla(dict(src=f'capcut/medya5/{src}.mp4',bas=0.4,hiz=0.65,kirp_ust=0.10,sabitle=True),str(raw),4.8)
            # Salon kaynağının sağında tezgâhsız mutfak var. Dar pencere kadrajı;
            # nihai hareketin tamamı snapshot/video ile ayrıca doğrulanmalıdır.
            crop='crop=450:800:260:650,scale=1080:1920' if name=='salon' else 'crop=900:1600:90:280,scale=1080:1920'
            subprocess.run(['ffmpeg','-v','error','-y','-i',str(raw),'-vf',crop,'-an','-c:v','libx264','-crf','16','-preset','fast',str(A/(name+'.mp4'))],check=True)
        for name in ['banyo','balkon','manzara']:
            shutil.copy(ROOT/f'capcut/medya2/{name}.jpg',A/(name+'.jpg'))
        for src,dest in [('marka/inza-logo-saydam.png','logo.png'),('varliklar/font/BebasNeue-Regular.ttf','BebasNeue.ttf'),('muzik/luxury-real-estate.mp3','muzik.mp3'),('hyperframes/ilan/assets/whoosh.wav','whoosh.wav')]:
            shutil.copy(ROOT/src,A/dest)
        shutil.copy('C:/Windows/Fonts/consola.ttf',A/'Teknik.ttf')
        for name in ['package.json','hyperframes.json','AGENTS.md','CLAUDE.md']:
            shutil.copy(ROOT/'hyperframes/ilan'/name,P/name)
        (P/'meta.json').write_text(json.dumps(dict(id='plan',name='İNZA — Plan',width=1080,height=1920,fps=30),ensure_ascii=False),encoding='utf-8')
