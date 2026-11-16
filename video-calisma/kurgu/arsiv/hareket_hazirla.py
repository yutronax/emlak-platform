from pathlib import Path
import shutil,subprocess,json,sys,urllib.request
from PIL import Image,ImageDraw,ImageFilter,ImageChops
ROOT=Path(__file__).resolve().parent.parent
P=ROOT/'kurgu/projeler/hareket'; A=P/'assets'; A.mkdir(parents=True,exist_ok=True)
sys.path.insert(0,str(ROOT/'kurgu'))
from kur import klip_hazirla
def run(*args):
 subprocess.run(list(args),check=True,cwd=ROOT)
for src,name in [('marka/inza-logo-saydam.png','logo.png'),('varliklar/font/BebasNeue-Regular.ttf','Bebas.ttf'),('kurgu/projeler/yz/assets/Metin.ttf','Metin.ttf')]:
 shutil.copy2(ROOT/src,A/name)
for url,name in [('https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js','gsap.min.js'),('https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/MotionPathPlugin.min.js','MotionPathPlugin.min.js')]:
 if not (A/name).exists(): urllib.request.urlretrieve(url,A/name)
# Original pixels are preserved in each matte. Generated plates are used only under occluded seams.
for name in ['balkon','manzara']:
 im=Image.open(ROOT/f'capcut/medya2/{name}.jpg').convert('RGB').resize((1080,1920))
 im.save(A/f'{name}-original.jpg',quality=97)
 fg=Image.new('L',im.size,0); d=ImageDraw.Draw(fg)
 if name=='balkon':
  d.polygon([(0,0),(1080,0),(1080,1920),(970,1920),(970,655),(0,275)],fill=255)
  d.polygon([(0,1750),(1080,1155),(1080,1920),(0,1920)],fill=255)
 else:
  d.polygon([(0,1150),(80,1060),(190,1015),(275,1080),(430,1110),(505,1180),(650,1120),(790,1180),(1080,1280),(1080,1920),(0,1920)],fill=255)
  d.polygon([(505,932),(700,880),(1080,875),(1080,1280),(780,1220),(520,1170)],fill=255)
 mid=Image.new('L',im.size,0);dm=ImageDraw.Draw(mid)
 dm.rectangle((0,740,1080,1920),fill=255)
 mid=ImageChops.subtract(mid,fg)
 backmask=ImageChops.invert(ImageChops.lighter(fg,mid))
 for tag,mask in [('front',fg),('mid',mid)]:
  out=im.convert('RGBA');out.putalpha(mask);out.save(A/f'{name}-{tag}.png')
 # Exact source sky is over the generated plate; only a 24px band near matte borders can reveal fill.
 generated=A/f'{name}-fill.png'
 base=Image.open(generated).convert('RGB').resize(im.size) if generated.exists() else im
 expanded=backmask.filter(ImageFilter.MaxFilter(49))
 base.paste(im,(0,0),backmask)
 base.save(A/f'{name}-back.jpg',quality=97)
 fg.save(A/f'{name}-front-mask.png');mid.save(A/f'{name}-mid-mask.png')
if not (A/'balkon-video.mp4').exists():
 klip_hazirla({'src':'capcut/medya5/video5.mp4','bas':1,'sabitle':True,'kirp_alt':0.12},str(A/'balkon-video.mp4'),3.56)
run('ffmpeg','-v','error','-y','-ss','1.825','-i',str(ROOT/'muzik/luxury-real-estate.mp3'),'-t','21.333','-af','afade=t=out:st=20.6:d=0.733,volume=0.7',str(A/'music.wav'))
run('ffmpeg','-v','error','-y','-f','lavfi','-i','anoisesrc=color=pink:seed=73:duration=0.48:sample_rate=48000','-af','highpass=f=700,lowpass=f=7500,afade=t=in:d=0.15,afade=t=out:st=0.18:d=0.30,volume=0.34',str(A/'swoosh.wav'))
run('ffmpeg','-v','error','-y','-f','lavfi','-i',"aevalsrc=sin(2*PI*(980*t-680*t*t))*exp(-30*t):s=48000:d=0.18",'-af','volume=0.32',str(A/'pop.wav'))
run('ffmpeg','-v','error','-y','-f','lavfi','-i','anoisesrc=color=white:seed=18:duration=0.045:sample_rate=48000','-af','highpass=f=2500,afade=t=out:d=0.04,volume=0.18',str(A/'tick.wav'))
print('Assets ready',P)
