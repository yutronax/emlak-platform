from pathlib import Path
import re
p=Path(__file__).parent/'projeler/plan'; f=p/'index.html'; s=f.read_text(encoding='utf-8')
s=re.sub(r'<div[^>]*id="visual2".*?(?=<div[^>]*id="text2")','<video id="visual2" class="clip media" style="z-index:40" src="assets/banyo-focus.mp4" muted playsinline data-start="12.6" data-duration="4.8" data-media-start="0" data-track-index="26"></video><div id="tone2" class="clip tone" style="z-index:41" data-start="12.6" data-duration="4.8" data-track-index="27"></div>\n',s,count=1,flags=re.S)
f.write_text(s,encoding='utf-8')
