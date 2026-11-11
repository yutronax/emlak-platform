from pathlib import Path
import shutil,subprocess,re
p=Path(__file__).parent/'projeler/plan';a=p/'assets';root=Path(__file__).parent.parent;f=p/'index.html'
shutil.copyfile(root/'cikti/plan-ornek-elestiri.md',root/'cikti/plan-tur3-elestiri.md')
shutil.copyfile(root/'cikti/plan-ornek.mp4',root/'cikti/plan-tur3.mp4')
shutil.copyfile(f,p/'index-tur3.html.bak')
s=f.read_text(encoding='utf-8')
s=re.sub(r'(<svg[^>]*id="plan".*?<path[^>]*class="walls")',r'\1 style="opacity:.10"',s,count=1,flags=re.S)
s=re.sub(r'(id="draw-walls"[^>]*class="fine")',r'\1 style="stroke:#F2B526;stroke-width:9"',s,count=1)
s=s.replace('data-volume="0.65"','data-volume="0.50"').replace('data-volume="0.36"','data-volume="0.52"')
s=s.replace('#phone{font-size:66px','#phone{font-size:74px').replace('#close-title{font-size:126px','#close-title{font-size:140px')
subprocess.run(['ffmpeg','-v','error','-y','-i',str(a/'banyo-focus-son.mp4'),'-vf','eq=brightness=0.045:gamma=1.10:contrast=1.035','-an','-c:v','libx264','-crf','17','-preset','fast','-g','30',str(a/'banyo-focus-teslim.mp4')],check=True)
s=s.replace('assets/banyo-focus-son.mp4','assets/banyo-focus-teslim.mp4')
subprocess.run(['ffmpeg','-v','error','-y','-f','lavfi','-i','sine=frequency=1300:duration=0.09','-af','afade=t=out:st=0.015:d=0.075,volume=0.6',str(a/'snap.wav')],check=True)
audios=''.join(f'<audio id="snap{i}" src="assets/snap.wav" data-start="{t+.6:g}" data-duration="0.09" data-volume="0.48" data-track-index="{45+i}"></audio>' for i,t in enumerate([2,6.8,11.6,16.4]))
s=s.replace('</div>\n<script>',audios+'</div>\n<script>')
# Küçük oda vurguları ilk saniyede mimari seçimi görünür kılar.
highlights=''.join(f'<rect id="intro-room{i}" x="{x}" y="{y}" width="{w}" height="{h}" fill="#F2B526" opacity="0"/>' for i,(x,y,w,h) in enumerate([(130,650,370,280),(130,930,370,320),(690,850,210,210),(130,560,370,90)]))
s=re.sub(r'(<svg[^>]*id="plan".*?)(</svg>)',lambda m:m[1]+highlights+m[2],s,count=1,flags=re.S)
s=s.replace("const tl=gsap.timeline({paused:true});","const tl=gsap.timeline({paused:true});\n[0,1,2,3].forEach(i=>{tl.to('#intro-room'+i,{opacity:.18,duration:.12},.05+i*.35);tl.to('#intro-room'+i,{opacity:0,duration:.18},.2+i*.35)});")
f.write_text(s,encoding='utf-8')
