from pathlib import Path
import json
R=Path(__file__).resolve().parents[1]; P=R/'kurgu/projeler/yz'
style='''@font-face{font-family:Bebas;src:url(assets/BebasNeue.ttf)}@font-face{font-family:Metin;src:url(assets/Metin.ttf)}*{box-sizing:border-box;margin:0}body{background:#16213E;overflow:hidden;color:white;font-family:Metin,sans-serif}#root{position:relative;width:1080px;height:1920px;overflow:hidden;background:#16213E}.clip{position:absolute;inset:0}.media{z-index:10}.photo{position:absolute;inset:0;width:1080px;height:1920px;object-fit:cover}.room .photo{top:480px;height:960px;object-fit:contain}.room{background:#16213E}.tone{z-index:20;background:linear-gradient(#16213Ef5 0%,#16213Edd 24%,transparent 40%,transparent 58%,#16213Ef5 78%,#16213E 100%)}.copy{z-index:50}.heading{position:absolute;left:72px;top:270px;width:850px}h1,h2{font:124px/1.02 Bebas,sans-serif;font-weight:400}.gold{color:#F2B526}.kicker{font-size:30px;letter-spacing:4px;margin-bottom:20px;color:#F2B526}.disclosure{position:absolute;left:72px;top:1110px;width:840px;background:#16213E;padding:16px 22px;font-size:32px;line-height:1.4;border-left:4px solid #F2B526}.caption{position:absolute;left:72px;top:1245px;width:840px;padding:18px 22px;background:#16213E;font-size:52px;line-height:1.22;z-index:50}.brand{z-index:60;position:absolute;left:72px;top:220px;width:128px}.ring{position:absolute;left:290px;top:710px;width:500px;height:500px;border:3px solid #F2B526;border-radius:50%;z-index:70;pointer-events:none}.end{background:#16213E;z-index:30}.endcopy{position:absolute;left:72px;top:370px;width:850px}.endlogo{width:360px;margin-bottom:55px}.endcopy h2{font-size:124px;margin-bottom:36px}.endcopy p{font-size:43px;line-height:1.4}.endcopy .honest{font-size:36px;margin-top:34px}.dash{width:120px;height:5px;background:#F2B526;margin-bottom:30px}'''
style+=' .endcopy{top:300px}.endlogo{width:300px;margin-bottom:32px}.endcopy h2{font-size:110px}.endcopy p{font-size:40px}.endcopy .honest{font-size:34px}'
style+=' .disclosure{top:630px;font-size:34px}.tone{background:linear-gradient(#16213Ef5 0%,#16213Edd 24%,transparent 42%,transparent 67%,#16213E 88%)}.caption{top:1260px;font-size:50px}.heading{top:250px}.bloom{position:absolute;left:0;top:480px;width:1080px;height:960px}'
style+=' .disclosure{top:585px;font-size:42px;line-height:1.2;font-weight:600}.caption{top:1240px;font-size:64px;line-height:1.15;font-weight:600;min-height:112px}.endcopy .honest{font-size:42px}.endcopy p{font-size:44px}'
style+=' #end-copy{z-index:auto}.endcopy{z-index:auto}.endcopy h2,.endcopy p{position:relative;z-index:50}.endcopy .dash{position:relative;z-index:40}.endlogo{position:relative;z-index:60}'
parts=[]; anim=[]; lane=0
def clip(id,cl,start,dur,body,track=1):
    global lane
    lane+=1
    return f'<div id="{id}" class="clip {cl}" data-start="{start}" data-duration="{dur}" data-track-index="{lane}">{body}</div>'
scenes=[('salon',0,6,'EVİ DEĞİL,<br><span class="gold">OLASILIĞI GÖR.</span>','01 / OTURMA'),('oda1',6,6,'DİNLENMEYE<br><span class="gold">YER AÇ.</span>','02 / DİNLENME'),('oda2',12,6,'BİR KÖŞE DE<br><span class="gold">KENDİNE.</span>','03 / ÇALIŞMA')]
for n,t,d,title,kicker in scenes:
    room=' room' if n!='salon' else ''
    parts.append(clip(n,'media'+room,t,d,f'<div id="{n}-camera" class="clip"><img class="photo" src="assets/{n}-bos.jpg" alt="Gerçek boş oda"><div id="{n}-reveal" class="clip"><img class="photo" src="assets/{n}-doseli.jpg" alt="Yapay zekâ ile sanal döşenmiş oda"></div></div>'))
    parts.append(clip(n+'-tone','tone',t,d,'',2))
    parts.append(clip(n+'-copy','copy',t,d,f'<div class="heading"><p class="kicker">{kicker}</p><h1>{title}</h1></div><p class="disclosure">Yapay zekâ ile sanal döşeme<br>· temsilidir</p>',3))
    parts.append(clip(n+'-fx','',t,d,f'<div id="{n}-ring" class="ring"></div>',4))
    anim.extend([f"tl.fromTo('#{n}-camera',{{scale:1.035}},{{scale:1,duration:{d},ease:'none'}},{t});",f"tl.fromTo('#{n}-reveal',{{clipPath:'circle({'18%' if t==0 else '0%'} at 50% 55%)'}},{{clipPath:'circle(130% at 50% 55%)',duration:1.75,ease:'power2.inOut'}},{t+.15});",f"tl.fromTo('#{n}-ring',{{scale:.1,opacity:.7}},{{scale:3,opacity:0,duration:1.65,ease:'power2.out'}},{t+.15});"])
    if n=='oda1':
        # Same camera push, with a matched dissolve rather than repeating the salon iris.
        anim[-2]=f"tl.fromTo('#oda1-reveal',{{opacity:0}},{{opacity:1,duration:1.45,ease:'sine.inOut'}},{t+.2});"
        anim[-1]="tl.set('#oda1-ring',{opacity:0},0);"
    if n=='oda2':
        # Three blooms begin at the plant, desk and chair, then join without moving architecture.
        media_index=len(parts)-4
        svg='<svg class="bloom" viewBox="0 0 1080 960"><defs><mask id="furnish-mask"><rect width="1080" height="960" fill="black"/><circle id="bloom-a" cx="940" cy="440" r="0" fill="white"/><circle id="bloom-b" cx="870" cy="650" r="0" fill="white"/><circle id="bloom-c" cx="780" cy="710" r="0" fill="white"/></mask></defs><image href="assets/oda2-doseli.jpg" width="1080" height="960" mask="url(#furnish-mask)"/></svg>'
        parts[media_index]=clip(n,'media room',t,d,'<div id="oda2-camera" class="clip"><img class="photo" src="assets/oda2-bos.jpg" alt="Gerçek boş oda">'+svg+'</div>')
        anim[-2]="tl.to('#bloom-a',{attr:{r:1600},duration:2.2,ease:'power2.inOut'},12.15);tl.to('#bloom-b',{attr:{r:1450},duration:1.9,ease:'power2.inOut'},12.5);tl.to('#bloom-c',{attr:{r:1400},duration:1.65,ease:'power2.inOut'},12.85);"
        anim[-1]="tl.set('#oda2-ring',{opacity:0},0);"
parts.append(clip('ending','end',18,6,'',1))
parts.append(clip('end-copy','copy',18,6,'<div class="endcopy"><img class="endlogo" src="assets/logo.png" alt="İNZA Gayrimenkul ve Yatırım"><div class="dash"></div><h2>HAYALİNİ KUR.<br><span class="gold">YERİNDE GÖR.</span></h2><p>Gerçek mekânı birlikte keşfedelim.</p><p class="honest">Seslendirme ve döşeme<br>yapay zekâ ile üretildi.</p></div>',3))
# Sentence captions: boundaries are refined from silencedetect evidence after voice generation.
caps=[(0,1.588,'Boş bir oda,'),(1.588,1.612,'yeni bir başlangıç.'),(3.2,1.4,'Salonda sıcak bir'),(4.6,1.77,'oturma köşesi<br>hayal edin.'),(6.37,1.744,'Bir odada dinlenmeye,'),(8.114,2.326,'diğerinde çalışmaya<br>yer açın.'),(10.44,1.605,'Gördüğünüz mobilyalar'),(12.045,1.955,'yapay zekâ ile eklendi.'),(14,1.6,'Sanal döşeme yalnızca'),(15.6,1.53,'fikir vermek içindir.'),(17.13,1.47,'Evin gerçek hâlini'),(18.6,2.4,'yerinde keşfedin.')]
for i,(t,d,txt) in enumerate(caps):parts.append(clip('caption-'+str(i),'copy',t,d,f'<p class="caption">{txt}</p>',8))
parts.append('<audio id="voice" src="assets/anlati.wav" data-start="0" data-duration="19.651" data-volume="1" data-track-index="40"></audio><audio id="music" src="assets/muzik.mp3" data-start="0" data-duration="24" data-media-start="4" data-volume="0.18" data-fade-out="2" data-track-index="41"></audio>')
for i,t in enumerate([.15,6.15,12.15]):parts.append(f'<audio id="sound-{i}" src="assets/belirme.wav" data-start="{t}" data-duration="0.8" data-volume="0.32" data-track-index="22"></audio>')
html='<!doctype html><html lang="tr"><head><meta charset="utf-8"><script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script><style>'+style+'</style></head><body><div id="root" data-composition-id="main" data-width="1080" data-height="1920" data-fps="30" data-duration="24">'+''.join(parts)+'</div><script>const tl=gsap.timeline({paused:true});'+''.join(anim)+"tl.fromTo('.dash',{scaleX:.2,transformOrigin:'left'},{scaleX:1,duration:.7},18);tl.to('#root',{opacity:1,duration:.01},23.99);window.__timelines=window.__timelines||{};window.__timelines.main=tl;</script></body></html>"
(P/'index.html').write_text(html,encoding='utf-8')
(P/'STORYLINES.md').write_text('''# Olasılık — seçilen anlatı
1. Olasılık: gerçek odanın içinde genişleyen ışık halkası eşya fikrini açar. İlk karede başlık ve kısmen döşenmiş salon vardır; boş oda → oturma → dinlenme → çalışma → gerçek mekâna davet. Lacivert/altın, özgün oda fotoğrafları, sıcak Türkçe ses ve hafif müzik. Tek öneriyi somut fotoğraflarla takip etmek kolay olduğu için seçildi.
2. Eşya izi: mobilya siluetleri çizilir, gerçekçi döşemeye dönüşür; daha grafik ağırlıklı alternatif.
3. Geri sar: döşenmiş odadan mobilyalar çözülerek çıkar; son kare gerçek boş odadır; sonuçtan kaynağa anlatı.
''',encoding='utf-8')
(P/'SPEC.md').write_text('''# Olasılık / Şablon 11
1080×1920, 30 fps, 24 saniye. Yazı x72–930 y220–1440. Medya10, ton20, grafik30–40, yazı50, marka60, efekt70.
0–6 salon; 6–12 yatak odası; 12–18 çalışma odası; 18–24 kapanış. İlk kare kapak, ilk saniyede halkasal açılma ve eşleşmiş kamera itmesi. Fotoğraflar aynı kadrajda hizalı. Oda fotoğraflarında mimarinin tamamını göstermek için contain.
Yasak varsayılanlar: kaydırıcı, defter, 3D halka galerisi, siyahtan açılış, parçacık yağmuru, uydurma fiyat/alan/telefon. Mobilya temsilidir etiketi her döşeli sahnede görünür. Kapanışta iki yapay zekâ bileşeni açıkça belirtilir.
''',encoding='utf-8')
