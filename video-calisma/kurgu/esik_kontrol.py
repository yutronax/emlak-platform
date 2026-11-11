"""Teslim videosu: ffprobe, ses ölçümü ve doğrudan renderdan kontak sayfası."""
from pathlib import Path
import subprocess,json,sys
from PIL import Image,ImageDraw,ImageOps
R=Path(__file__).resolve().parents[1];D=R/'cikti';tag=sys.argv[1] if len(sys.argv)>1 else 'son';video=D/'esik-ornek.mp4'
def probe(p):
    r=subprocess.run(['ffprobe','-v','error','-show_entries','format=duration,size:stream=codec_name,width,height,r_frame_rate','-of','json',str(p)],capture_output=True,check=True);return json.loads(r.stdout)
data={'ana':probe(video)}
phone=D/'esik-ornek-telefon.mp4'
if phone.exists():data['telefon']=probe(phone)
(D/f'esik-{tag}-teknik.json').write_text(json.dumps(data,ensure_ascii=False,indent=2),encoding='utf-8')
frames=[]
times=[0,.7,3.9,4.1,6,9.9,10.1,12.6,14,15.5,17.9,18.1,20,21.8]
for i,t in enumerate(times):
    p=D/f'esik-{tag}-kare{i:02}.jpg'
    subprocess.run(['ffmpeg','-v','error','-y','-ss',str(t),'-i',str(video),'-frames:v','1','-vf','scale=270:480',str(p)],check=True)
    frames.append((p,t))
out=Image.new('RGB',(1080,4*520),'#16213e');d=ImageDraw.Draw(out)
for i,(p,t) in enumerate(frames):
    x=i%4*270;y=i//4*520;out.paste(Image.open(p),(x,y));d.text((x+8,y+485),str(t)+' s',fill='white')
out.save(D/f'esik-{tag}-kareler.jpg')
r=subprocess.run(['ffmpeg','-hide_banner','-i',str(video),'-af','volumedetect','-vn','-f','null','-'],capture_output=True)
(D/f'esik-{tag}-ses.log').write_bytes(r.stderr)
print(json.dumps(data,ensure_ascii=False,indent=2));print(r.stderr.decode(errors='replace')[-500:])
