from pathlib import Path
import subprocess
from PIL import Image,ImageDraw
P=Path('kurgu/projeler/hareket');D=P/'source-video-check';D.mkdir(exist_ok=True)
files=list(Path('capcut/medya5').glob('video*.mp4'))
sheet=Image.new('RGB',(1000,3*350),'#16213e');draw=ImageDraw.Draw(sheet)
for i,f in enumerate(files):
 out=D/(f.stem+'.jpg');subprocess.run(['ffmpeg','-v','error','-y','-ss','1','-i',str(f),'-frames:v','1','-vf','scale=200:-1',str(out)],check=True)
 im=Image.open(out);im.thumbnail((245,310));x=i%4*250;y=i//4*350;sheet.paste(im,(x,y));draw.text((x+10,y+315),f.name,fill='white')
sheet.save(D/'contact.jpg')
