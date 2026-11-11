from pathlib import Path
import shutil,subprocess,re
R=Path(__file__).resolve().parents[1];P=R/'kurgu/projeler/esik';A=P/'assets'
for src,dst in [('esik-ornek.mp4','esik-tur3.mp4'),('esik-ornek-elestiri.md','esik-tur3-elestiri.md')]:shutil.copy(R/'cikti'/src,R/'cikti'/dst)
shutil.copy(P/'index.html',P/'index-tur3.html.bak')
# Cam akoru: ilk sürümdeki -40 dB civarı tek sinüs yerine duyulur üç armonik.
expr='0.25*sin(2*PI*(880*t+180*t*t))*exp(-7*t)+0.12*sin(2*PI*1320*t)*exp(-11*t)+0.08*sin(2*PI*1760*t)*exp(-16*t)'
subprocess.run(['ffmpeg','-v','error','-y','-f','lavfi','-i',f'aevalsrc={expr}:s=48000:d=0.45','-af','afade=t=in:d=0.008,afade=t=out:st=0.30:d=0.15',str(A/'cam.wav')],check=True)
f=P/'index.html';s=f.read_text(encoding='utf-8')
s=s.replace("tl.fromTo('#clouds',{x:-35},{x:35,duration:4,ease:'none'},0);","tl.fromTo('#clouds',{x:-55},{x:10,duration:.8,ease:'power1.out'},0);\ntl.to('#clouds',{x:55,duration:3.2,ease:'none'},.8);")
s=s.replace('data-duration="0.26"','data-duration="0.45"')
s=s.replace('id="sound1" src="assets/cam.wav" data-start="4"','id="sound1" src="assets/cam.wav" data-start="4.3"')
s=s.replace('data-volume="0.7"','data-volume="0.85"')
extra='<audio id="slider-return" src="assets/cam.wav" data-start="7.1" data-duration="0.45" data-volume="0.75" data-track-index="27"></audio><audio id="opening-glass" src="assets/cam.wav" data-start="0" data-duration="0.45" data-volume="0.55" data-track-index="28"></audio>'
s=s.replace('</div><script>',extra+'</div><script>')
f.write_text(s,encoding='utf-8')
