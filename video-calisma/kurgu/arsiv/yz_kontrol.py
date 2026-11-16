from pathlib import Path
import subprocess,sys,json
from PIL import Image,ImageOps,ImageDraw
R=Path(__file__).resolve().parents[1];P=R/'kurgu/projeler/yz'
CLI='C:/Users/kuyus/AppData/Local/npm-cache/_npx/8a5870cc59afb7ee/node_modules/hyperframes/dist/cli.js'
if sys.argv[1]=='check':
    n=sys.argv[2]
    p=subprocess.run(['node',CLI,'check',str(P),'--json'],capture_output=True,encoding='utf-8',errors='replace')
    (P/f'check-tur{n}.json').write_text(p.stdout,encoding='utf-8')
    d=json.loads(p.stdout)
    print('OK',d['ok'])
    for k in ['lint','runtime','layout','contrast','craft','audio']:
        x=d[k]; print(k,x.get('errorCount'),x.get('warningCount'))
        for f in x.get('findings',[]):
            if not f['code'].startswith('nested_structure'):print(f['code'],f.get('message'))
elif sys.argv[1]=='decoded':
    n=sys.argv[2];out=P/f'decoded-tur{n}';out.mkdir(exist_ok=True)
    for i,t in enumerate([0,.8,3,6.8,9,12.8,15,18.5,22]):
        subprocess.run(['ffmpeg','-v','error','-y','-ss',str(t),'-i',str(R/f'cikti/yz-tur{n}.mp4'),'-frames:v','1',str(out/f'{i}.jpg')],check=True)
    sheet=Image.new('RGB',(1080,1980),'#16213e');d=ImageDraw.Draw(sheet)
    for i,f in enumerate(sorted(out.glob('[0-9].jpg'))):
        im=ImageOps.contain(Image.open(f),(350,630));x=i%3*360;y=i//3*660;sheet.paste(im,(x,y+20));d.text((x+5,y+3),str([0,.8,3,6.8,9,12.8,15,18.5,22][i])+' s',fill='white')
    sheet.save(out/'contact-sheet.jpg')
elif sys.argv[1]=='convert':
    p=P/'check-tur1.json';p.write_text(p.read_text(encoding='utf-16'),encoding='utf-8')
elif sys.argv[1]=='silence':
    p=subprocess.run(['ffmpeg','-hide_banner','-i',str(P/'assets/anlati.wav'),'-af','silencedetect=noise=-32dB:d=0.25','-f','null','-'],capture_output=True,encoding='utf-8',errors='replace')
    (P/'ses-sessizlik.txt').write_text(p.stderr,encoding='utf-8')
elif sys.argv[1]=='review':
    n=sys.argv[2];folder=P/f'review-tur{n}';files=sorted(folder.glob('review-seam-*.jpg'))
    for k in range(0,len(files),7):
        ims=[ImageOps.contain(Image.open(f),(1400,450)) for f in files[k:k+7]]
        out=Image.new('RGB',(1400,sum(i.height+20 for i in ims)),'#16213e');y=0
        for im in ims:out.paste(im,(0,y));y+=im.height+20
        out.save(folder/f'seams-toplu-{k//7+1}.jpg')
elif sys.argv[1]=='audio':
    p=subprocess.run(['node',CLI,'audio',str(R/'cikti/yz-ornek.mp4'),'--json'],capture_output=True,encoding='utf-8',errors='replace')
    (P/'audio-final.json').write_text(p.stdout,encoding='utf-8')
    d=json.loads(p.stdout)['items'][0];print({k:d.get(k) for k in ['duration','sampleRate','channels','warnings','loudness']})
