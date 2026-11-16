"""İlk gerçek snapshot incelemesinde bulunan plan sorunlarını düzeltir."""
from pathlib import Path
import re, shutil
p=Path(__file__).parent/'projeler/plan'
f=p/'index.html'
s=f.read_text(encoding='utf-8')
shutil.copyfile(f,p/'index-taslak.html.bak')
# CLI'nin zamanlanmış medyayı statik olarak keşfetmesi gerekir.
rooms=[('SALON','salon',5,[130,650,370,280],'01 / YAŞAM ALANI',4.8),('ODA','oda',9.8,[130,930,370,320],'02 / PENCEREYE DOĞRU',4.8),('BANYO','banyo',14.6,[690,850,210,210],'03 / ODAKTAN DETAYA',4.8),('BALKON','balkon',19.4,[130,650,370,280],'04 / DIŞARIYA AÇILAN',4.6)]
blocks=[]
for i,(name,slug,t,rect,sub,d) in enumerate(rooms):
 x,y,w,h=rect
 if i<2:
  media=f'<video id="v{i}" class="clip media" src="assets/{slug}.mp4" muted playsinline></video>'
 elif i==2:
  media='<div class="bath-frame"><img id="focus-back" class="bath-crop" src="assets/banyo.jpg" alt=""><img id="focus-front" class="bath-crop focus-front" src="assets/banyo.jpg" alt=""></div>'
 else: media='<img id="balcony-view" class="clip media" src="assets/manzara.jpg" alt="">'
 blocks.append(f'''<div id="bp{i}" class="clip blueprint" data-start="{t}" data-duration="{d}" data-track-index="1"></div>
<svg id="map{i}" class="clip drawing" data-start="{t}" data-duration="{d}" data-track-index="2" viewBox="0 0 1080 1920"><path class="walls" d="M130 650H900V1250H130Z M500 650V1250 M130 930H500 M500 850H900 M500 1060H900 M690 850V1060"/><rect class="selected" x="{x}" y="{y}" width="{w}" height="{h}"/></svg>
<div id="visual{i}" class="clip" style="z-index:40;overflow:hidden" data-start="{t}" data-duration="{d}" data-track-index="3">{media}<div class="clip tone"></div></div>
<div id="text{i}" class="clip copy" data-start="{t}" data-duration="{d}" data-track-index="4"><div class="content"><p class="eyebrow">{sub}</p><h2 class="title">{name}</h2><p class="note bottom">temsili plan</p></div></div>
<audio id="sfx{i}" src="assets/whoosh.wav" data-start="{t+.6}" data-duration="0.7" data-volume="0.22" data-track-index="11"></audio>''')
s=s.replace('<div id="scene-mount"></div>','\n'.join(blocks))
s=re.sub(r"const mount=document.querySelector\('#scene-mount'\);.*?const tl=",'const tl=',s,flags=re.S)
s=s.replace('pathLength="1"','pathLength="1" stroke-dasharray="1"')
s=s.replace('class="walls" d="M130 650','class="walls" data-hold="true" d="M130 650',1)
s=s.replace('id="opening" class=', 'id="opening" data-hold="true" class=')
s=s.replace('id="day" class="clip media" src="assets/manzara.jpg"','id="day" class="clip media" src="assets/manzara-day.jpg"')
shutil.copyfile(p/'assets/manzara.jpg',p/'assets/manzara-day.jpg')
# Banyo kolu x630,y1100. Ambalaj y1400 altında; crop gerçek kapıya taşınır.
s=s.replace('transform-origin:87% 47%','transform-origin:62% 52%')
s=s.replace('polygon(35% 25%,100% 25%,100% 90%,35% 90%)','polygon(39% 18%,58% 18%,58% 88%,39% 88%)')
s=s.replace("{filter:'blur(15px)'},{filter:'blur(0px)'", "{'--hf-color-grading-blur':.35},{'--hf-color-grading-blur':0}")
s=s.replace("{filter:'blur(0px)'},{filter:'blur(18px)'", "{'--hf-color-grading-blur':0},{'--hf-color-grading-blur':.3}")
f.write_text(s,encoding='utf-8')
