from pathlib import Path
from PIL import Image,ImageOps
import shutil,subprocess,re
R=Path(__file__).resolve().parents[1];P=R/'kurgu/projeler/esik';A=P/'assets'
shutil.copy(R/'cikti/esik-ornek-elestiri.md',R/'cikti/esik-tur1-elestiri.md')
shutil.copy(R/'cikti/esik-ornek.mp4',R/'cikti/esik-tur1.mp4')
shutil.copy(P/'index.html',P/'index-tur1.html.bak')
# Aynı gerçek manzaranın sol kısmı. Nesne silme veya yeni manzara üretme yok.
im=Image.open(R/'capcut/medya2/manzara.jpg');w,h=im.size
im=ImageOps.fit(im.crop((0,0,int(w*.45),int(h*.82))),(1080,1920))
for name in ['manzara.jpg','manzara-use2.jpg','manzara-use3.jpg']:im.save(A/name,quality=95)
# Duş yerine ikinci temiz oda yönü; hortum ve tavan kablosu kadraj dışında.
subprocess.run(['ffmpeg','-v','error','-y','-ss','1','-i',str(R/'capcut/medya5/video3.mp4'),'-vf','crop=820:1260:150:400,scale=1080:1920','-frames:v','1',str(A/'oda-detay.jpg')],check=True)
# Renk karşılaştırması: aynı geometri, orta tonlar sıcak ve aydınlık.
subprocess.run(['ffmpeg','-v','error','-y','-i',str(A/'oda2.jpg'),'-vf','eq=brightness=0.065:gamma=1.10:contrast=1.06:saturation=1.18,colorbalance=rs=0.07:bs=-0.07:rm=0.045:bm=-0.035','-frames:v','1',str(A/'oda-renk.jpg')],check=True)
f=P/'index.html';s=f.read_text(encoding='utf-8')
# 4 + 6 + 8 + 4 = 22 saniye.
def timing(m):
    v=float(m.group(1));return 'data-start="'+str({7:4,14:10,22:18}.get(v,v)).removesuffix('.0')+'"'
s=re.sub(r'data-start="([\d.]+)"',timing,s)
s=s.replace('data-duration="26"','data-duration="22"')
# İlk ve karşılaştırma sahnelerinin süreleri başlangıca göre değiştirilir.
s=re.sub(r'data-start="0" data-duration="7"','data-start="0" data-duration="4"',s)
s=re.sub(r'data-start="4" data-duration="7"','data-start="4" data-duration="6"',s)
s=s.replace('top:950px','top:900px').replace('top:1270px','top:1285px')
s=s.replace('assets/banyo.jpg','assets/oda-detay.jpg').replace('alt="Duş alanı"','alt="İkinci oda açısı"')
s=s.replace('ODA · DUŞ · MANZARA','IŞIK · DERİNLİK · MANZARA')
s=s.replace('Sinemagraf · temsili bulut hareketi','Temsili bulut hareketi').replace('GÖRÜNTÜYE YAKINDAN BAK','IŞIĞI İNCELE')
# Açılışa özel, gökyüzünü bastırmayan gradyan; yazının altında koyu değer korunur.
s=s.replace('</style>','#layer-0{background:linear-gradient(#0d1822f0 0%,#0d1822bc 26%,#0d182200 42%,#0d182200 60%,#0d1822ee 74%,#0d1822 100%)}\n.skybox{clip-path:polygon(0 0,100% 0,100% 47%,0 47%)}\n</style>')
start=s.index("tl.fromTo('#clouds'");end=s.index('window.__timelines',start)
s=s[:start]+'''tl.fromTo('#clouds',{x:-45,scale:1.12},{x:45,scale:1.12,duration:4,ease:'none'},0);
tl.fromTo('#open-copy .rule',{scaleX:.2,transformOrigin:'left'},{scaleX:1,duration:.6,ease:'power2.out'},0);
tl.fromTo('#graded',{clipPath:'inset(0 80% 0 0)'},{clipPath:'inset(0 12% 0 0)',duration:2.4,ease:'sine.inOut'},4.3);
tl.fromTo('#divider',{x:-324},{x:410,duration:2.4,ease:'sine.inOut'},4.3);
tl.to('#graded',{clipPath:'inset(0 50% 0 0)',duration:1.6,ease:'sine.inOut'},7.1);
tl.to('#divider',{x:0,duration:1.6,ease:'sine.inOut'},7.1);
tl.fromTo('#orbit',{rotationY:28},{rotationY:0,duration:.9,ease:'power2.out'},10);
tl.to('#orbit',{rotationY:-120,duration:1.2,ease:'power2.inOut'},12.1);
tl.to('#orbit',{rotationY:-240,duration:1.2,ease:'power2.inOut'},14.9);
tl.to('#root',{opacity:1,duration:.01},21.99);
'''+s[end:]
# Trois tını: başlangıçların yanı sıra iki galeri dönüşüne de ses.
extra='''<audio id="turn-a" src="assets/cam.wav" data-start="12.1" data-duration="0.26" data-volume="0.7" data-track-index="25"></audio><audio id="turn-b" src="assets/cam.wav" data-start="14.9" data-duration="0.26" data-volume="0.7" data-track-index="26"></audio>'''
s=s.replace('</div><script>',extra+'</div><script>')
f.write_text(s,encoding='utf-8')
