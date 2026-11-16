from pathlib import Path
from PIL import Image,ImageOps
import shutil
R=Path(__file__).resolve().parents[1];P=R/'kurgu/projeler/esik';A=P/'assets'
for src,dst in [('esik-ornek.mp4','esik-tur2.mp4'),('esik-ornek-elestiri.md','esik-tur2-elestiri.md')]:shutil.copy(R/'cikti'/src,R/'cikti'/dst)
shutil.copy(P/'index.html',P/'index-tur2.html.bak')
# Gökyüzü dokusunda bina, kablo ve ufuk yok; hareket yalnız bu bölgede kalır.
im=Image.open(A/'manzara.jpg');sky=ImageOps.fit(im.crop((0,0,1080,540)),(1200,650));sky.save(A/'bulut.jpg',quality=95)
f=P/'index.html';s=f.read_text(encoding='utf-8')
s=s.replace('top:900px','top:930px').replace('left:-240px;top:-270px;width:480px;height:540px','left:-240px;top:-250px;width:480px;height:500px')
s=s.replace('src="assets/manzara-use2.jpg"','src="assets/bulut.jpg"')
s=s.replace('</style>','''.skybox{clip-path:inset(0);height:650px;mask-image:linear-gradient(#000 0%,#000 72%,transparent 100%)}
#clouds{position:absolute;left:-60px;top:0;width:1200px;height:650px;object-fit:cover;transform:none}
.end-logo{position:relative;z-index:60}
</style>''')
# Yalnız bulut dokusu hareketli; CSS ve GSAP aynı transformu paylaşmaz.
s=s.replace("{x:-45,scale:1.12},{x:45,scale:1.12,duration:4,ease:'none'}","{x:-35},{x:35,duration:4,ease:'none'}")
f.write_text(s,encoding='utf-8')
