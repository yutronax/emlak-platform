from pathlib import Path
import re,shutil
p=Path(__file__).parent/'projeler/plan'; f=p/'index.html'; s=f.read_text(encoding='utf-8')
for i,t in [(0,5),(1,9.8)]:
 pattern=rf'<div[^>]*id="visual{i}".*?</div></div>'
 replacement=f'<video id="visual{i}" class="clip media" style="z-index:40" src="assets/{["salon","oda"][i]}.mp4" muted playsinline data-start="{t}" data-duration="4.8" data-media-start="0" data-track-index="{20+i}"></video><div id="tone{i}" class="clip tone" style="z-index:41" data-start="{t}" data-duration="4.8" data-track-index="{22+i}"></div>'
 s=re.sub(pattern,replacement,s,count=1,flags=re.S)
shutil.copyfile(p/'assets/banyo.jpg',p/'assets/banyo-front.jpg')
s=re.sub(r'(id="focus-front"[^>]*src=")assets/banyo.jpg',r'\1assets/banyo-front.jpg',s)
# Ayrı düzenleme yolları; aynı satırda altı öğe uyarısını önler.
counter=[0]
def track(m):
 counter[0]+=1
 return f'data-track-index="{counter[0]}"'
s=re.sub(r'data-track-index="\d+"',track,s)
f.write_text(s,encoding='utf-8')
