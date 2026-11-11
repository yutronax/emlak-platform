from pathlib import Path
import sys
ROOT=Path(__file__).resolve().parent.parent;sys.path.insert(0,str(ROOT/'kurgu'))
from kur import klip_hazirla
P=ROOT/'kurgu/projeler/hareket';A=P/'assets'
klip_hazirla({'src':'capcut/medya5/video6.mp4','bas':0,'sabitle':True,'kirp_alt':0.12},str(A/'balkon-clean.mp4'),3.56)
s=(P/'index.html').read_text(encoding='utf-8').replace('assets/balkon-video.mp4','assets/balkon-clean.mp4')
(P/'index.html').write_text(s,encoding='utf-8')
