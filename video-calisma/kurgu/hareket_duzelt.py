from pathlib import Path
import shutil
p=Path('kurgu/projeler/hareket');f=p/'index.html';s=f.read_text(encoding='utf-8')
old='<div id="portal" class="clip scene" data-start="10.66" data-duration="3.56" data-track-index="4"><div id="video-world" class="world"><video id="balcony-video" class="vimage" src="assets/balkon-video.mp4" muted playsinline preload="auto"></video></div>'
new='<div id="video-world" class="world"><video id="balcony-video" class="clip vimage" data-start="10.66" data-duration="3.56" data-track-index="4" src="assets/balkon-video.mp4" muted playsinline preload="auto"></video></div><div id="portal" class="clip scene" data-start="10.66" data-duration="3.56" data-track-index="5">'
s=s.replace(old,new)
s=s.replace('<small>MOCK · Gerçek ilan bilgisi değildir.</small>','')
s=s.replace('<div class="graphics"><div id="spec-ribbon"','<div class="bottom"><p>Fiyat ve alan MOCK.</p></div><div class="graphics"><div id="spec-ribbon"')
s=s.replace('class="cta-logo" src="assets/logo.png"','class="cta-logo" src="assets/logo-cta.png"')
s=s.replace('id="end-world" class="world"><img class="plate" src="assets/balkon-original.jpg"','id="end-world" class="world"><img class="plate" src="assets/balkon-end.jpg"')
s=s.replace("{display:'inline-block',y:160,rotation:8}","{y:160,rotation:8}").replace("{display:'inline-block',x:-760}","{x:-760}")
s=s.replace('.type-mask{overflow:hidden;', '.type-mask span{display:inline-block}.type-mask{overflow:hidden;')
f.write_text(s,encoding='utf-8')
shutil.copy2(p/'assets/logo.png',p/'assets/logo-cta.png');shutil.copy2(p/'assets/balkon-original.jpg',p/'assets/balkon-end.jpg')
ref=p/'catalog-reference';ref.mkdir(exist_ok=True)
for file in (p/'compositions').rglob('*.html'):
 shutil.move(str(file),str(ref/(file.stem+'.txt')))
