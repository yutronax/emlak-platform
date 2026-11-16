"""Teslim videolarının teknik ölçümü ve gerçek render karelerinin özeti."""
from pathlib import Path
import subprocess,json
from PIL import Image,ImageDraw
root=Path(__file__).parent.parent;out=root/'cikti'
sheet=Image.new('RGB',(1080,1340),'#16213e');d=ImageDraw.Draw(sheet)
for i,t in enumerate([0,5,9,14,19,24]):
 frame=out/f'plan-teslim-{t:02}.jpg'
 subprocess.run(['ffmpeg','-v','error','-y','-ss',str(t),'-i',str(out/'plan-ornek.mp4'),'-frames:v','1','-vf','scale=360:640',str(frame)],check=True)
 x=(i%3)*360;y=(i//3)*670
 sheet.paste(Image.open(frame),(x,y+30));d.text((x+12,y+8),f'{t:02d} sn',fill='white')
sheet.save(out/'plan-ornek-kareler.jpg',quality=92)
result={}
for name in ['plan-ornek.mp4','plan-ornek-telefon.mp4']:
 result[name]=json.loads(subprocess.check_output(['ffprobe','-v','error','-show_entries','stream=codec_name,width,height,r_frame_rate,duration','-show_entries','format=duration,size','-of','json',str(out/name)]))
result['telefon_30mb_alti']=(out/'plan-ornek-telefon.mp4').stat().st_size<30000000
(out/'plan-teknik-dogrulama.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(result,ensure_ascii=False))
