import json
from pathlib import Path
p=Path("kurgu/projeler/yatay/gemini-mozaik-1");p.mkdir(parents=True,exist_ok=True)
def g(ad,a,b,h,rate,vol):
 return dict(ad=ad,giden=a,gelen=b,harman=h,ses=dict(tur="whoosh",oran=rate,ses=vol))
trans=[
g("Hafif Parlama","eq=brightness='0.22*{p}':eval=frame","eq=brightness='0.22*{p}':eval=frame","min(255,A*P+B*(1-P)+55*sin(PI*P))",1.1,.15),
g("Çözülen Sütun","null","null","A*(1-clip((1-P)*W-X+20,0,40)/40)+B*clip((1-P)*W-X+20,0,40)/40",.8,.15),
g("Perde Hareketi","null","null","if(lt(Y,H*(1-P)),B,A)",1.2,.14),
g("Yavaş Döngüsel Çözülme","null","null","A*(1-clip(((1-P)*sqrt(W*W+H*H)/2-sqrt((X-W/2)*(X-W/2)+(Y-H/2)*(Y-H/2))+30)/60,0,1))+B*clip(((1-P)*sqrt(W*W+H*H)/2-sqrt((X-W/2)*(X-W/2)+(Y-H/2)*(Y-H/2))+30)/60,0,1)",.5,.12),
g("Kapı İçinden Zoom","scale=w='1920*(1+0.7*{p})':h='1080*(1+0.7*{p})':eval=frame,crop=1920:1080","scale=w='1920*(1+0.4*{p})':h='1080*(1+0.4*{p})':eval=frame,crop=1920:1080","A*P*P+B*(1-P*P)",1.4,.18),
g("Şeffaf Bulanıklık Geçişi","gblur=sigma=9","gblur=sigma=1","A*P+B*(1-P)",1.8,.08)]
a="clip(min((t-{t0})/0.5,({t1}-t)/0.4),0,1)"
y="150+60*pow(1-("+a+"),2)"
x="(w-tw)/2+18*sin(PI*("+a+"))"
txt="drawtext=fontfile='{FONT}':text='{metin}':fontsize=64:fontcolor=white:borderw=2:bordercolor=black@0.6:shadowcolor=black@0.9:shadowx=0:shadowy=4:x='"+x+"':y='"+y+"':alpha='"+a+"':enable='between(t,{t0},{t1})'"
br=dict(ad="gemini-mozaik-1",vurus=7,rampa=.3,harman=.3333,yavas=1,egri=[1,1,1,1],alt_bant="İNZA · ÖRNEK KURGU",font="segoe_kalin",muzik="muzik/luxury-real-estate.mp3",muzik_bas=0,seslendirme_bas=.5,planlar=[[f"varliklar/pexels-kindel/{n}.mp4",s] for n,s in zip([7578540,7578542,7578544,7578546,7578549,7578550,7578551],[0,.38,1.04,1.35,2.2,2.4,2.56])],gecisler=trans,renk_filtre="eq=contrast=1.05:saturation=1.03,curves=all='0/0.015 0.15/0.17 0.75/0.75 1/0.97',colorbalance=rh=0.012:bh=-0.012",yazi_filtre=txt,yazilar=[[0,"SOFİSTİKE YAŞAM"],[2,"GENİŞ ALANLAR"],[3,"ÖZEL BAHÇE"],[6,"LÜKS DETAYLAR"]],tekrar_izin=True)
Path("kurgu/brifler/gemini-mozaik-1.json").write_text(json.dumps(br,ensure_ascii=False,indent=2),encoding="utf-8")
