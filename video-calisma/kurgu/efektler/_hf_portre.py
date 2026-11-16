"""Kurulu HyperFrames parçalarından portre, ProRes 4444 alfa katmanı üretir."""
from pathlib import Path
import argparse,json,re,shutil,sys
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from hf_v2_setup import R,project,cli
from PIL import ImageFont

def main(name):
 p=argparse.ArgumentParser(__doc__);p.add_argument('--alfa',action='store_true');p.add_argument('--metin',default='');p.add_argument('--sure',type=float,required=True);p.add_argument('-o',required=True);p.add_argument('--a');p.add_argument('--b');p.add_argument('--a-bas',type=float,default=0);p.add_argument('--b-bas',type=float,default=0);a=p.parse_args()
 assets=project/'assets';assets.mkdir(exist_ok=True)
 shutil.copy(R/'varliklar/font/BebasNeue-Regular.ttf',assets/'baslik.ttf')
 if name=='whip-pan':
  import subprocess
  for label,path,start in [('a',a.a,a.a_bas),('b',a.b,a.b_bas)]:subprocess.run(['ffmpeg','-v','error','-y','-ss',str(start),'-i',path,'-frames:v','1',str(assets/f'{label}.jpg')],check=True)
  source=(project/'compositions/whip-pan.html').read_text(encoding='utf8');source=source[source.lower().index('<!doctype html>'):]
  source=re.sub(r'<div class="bp-grid">.*?<!-- GL canvas \(left panel only\) -->','<img id="s1" src="assets/a.jpg" style="display:none"><img id="s2" src="assets/b.jpg" style="display:none">',source,flags=re.S)
  source=re.sub(r'<!-- Right panel metadata -->.*?(?=<div\s+id="driver")','',source,flags=re.S)
  source=source.replace('1080','HEIGHT').replace('1920','1080').replace('1200','1080').replace('HEIGHT','1920')
  start=source.index('          var scene = document.getElementById(sceneId);');end=source.index('          var tex = gl.createTexture();',start)
  source=source[:start]+'''          var scene = document.getElementById(sceneId);
          var c=document.createElement("canvas");c.width=1080;c.height=1920;
          c.getContext("2d").drawImage(scene,0,0,1080,1920);
'''+source[end:]
  source=source.replace('if (t >= 1.0 && t < 3.0)',f'if (t >= 0 && t < {a.sure})').replace('easeInOut((t - 1.0) / 2.0)',f'easeInOut(t / {a.sure})').replace('else if (t >= 3.0)',f'else if (t >= {a.sure})').replace('duration: 4,',f'duration: {a.sure},').replace('data-duration="4"',f'data-duration="{a.sure}"')
  source=source.replace('        captureScene("s1");','        Promise.all([document.getElementById("s1").decode(),document.getElementById("s2").decode()]).then(function(){\n        captureScene("s1");').replace('      } // end if (gl)','        });\n      } // end if (gl)')
  source=re.sub(r'\s*@import url\([^;]+;','',source)
 else:
  raw=(project/f'compositions/components/{name}.html').read_text(encoding='utf8');source=raw.split('<template>',1)[1].split('</template>',1)[0]
  source=re.sub(r'data-duration="[\d.]+"',f'data-duration="{a.sure}"',source)
  source=source.replace('data-fps="30"','data-fps="30" data-width="1080" data-height="1920"')
  defaults={'text':a.metin,'accent_word_index':0,'accent':'green','shadow':True,'split':'char','exit':'fade','overshoot':1.9,'fromScale':.8}
  source=re.sub(r'var vars =\s*window\.__hyperframes.*?: \{\};',lambda m: 'var vars = '+json.dumps(defaults,ensure_ascii=False)+';',source,flags=re.S)
  source=source.replace('Ship it today',a.metin).replace('WORDS IN MOTION',a.metin).replace('"New"',json.dumps(a.metin,ensure_ascii=False))
  face=ImageFont.truetype(str(assets/'baslik.ttf'),170);width=max(face.getlength(line) for line in a.metin.splitlines());size=min(200,170*850/max(1,width))
  shared=f'''@font-face{{font-family:Baslik;src:url('assets/baslik.ttf')}}
#root{{--pwr-accent:#fffaf1;--brand:#E8C98D;--fg:#fffaf1;--bg:transparent;--font-display:Baslik;--font-body:Baslik}}
.hs-headline,.pwr-stage,.sp-label{{font-family:Baslik!important;font-size:{size:.1f}px!important;letter-spacing:0!important;line-height:1.12!important;text-shadow:0 4px 5px #000,0 0 18px #0009}}
.hs-headline{{width:86cqw!important;gap:18px!important}}
.pwr-clip{{background:transparent!important}}.pwr-stage{{width:86cqw!important;max-width:86cqw!important;column-gap:0!important;row-gap:0!important}}.pwr-space{{width:.26em!important}}
.sp-badge{{padding:0!important;border:0!important;border-radius:0!important;background:transparent!important;box-shadow:none!important;max-width:86cqw!important;min-height:0!important}}
.sp-dot{{display:none}}.sp-label{{overflow:visible!important;text-overflow:clip!important;white-space:pre-line!important;text-align:center;color:#E8C98D!important}}
'''
  if name=='headline-slam':
   source=source.replace('var LAND_AT_BASE = 0.58;','var LAND_AT_BASE = 0.20;').replace('var IN_BASE = 0.72;','var IN_BASE = 0.32;').replace('var OUT_BASE = 0.46;','var OUT_BASE = 0.20;').replace('scale: 1.6','scale: 1.14')
  if name=='per-word-rise':source=source.replace('var RISE_BASE = 0.74;','var RISE_BASE = 0.48;').replace('var STAGGER_BASE = 0.62;','var STAGGER_BASE = 0.55;')
  if name=='spring-pop':source=source.replace('            tl.seek(0);',f'            tl.to(badge, {{opacity:0,duration:0.2}}, {a.sure-.2});\n            tl.seek(0);')
  source=source.replace('</style>',shared+'</style>',1)
  source='<!doctype html><html lang="tr"><head><meta charset="utf-8"><style>html,body{margin:0;width:1080px;height:1920px;background:transparent;overflow:hidden}</style></head><body>'+source+'</body></html>'
 (project/'index.html').write_text(source,encoding='utf8');(project/f'{name}-portre.txt').write_text(source,encoding='utf8')
 cli('check','--json',cwd=project)
 cli('render','--format','mov','--quality','delivery','--workers','1','-o',str(Path(a.o).resolve()),cwd=project)
