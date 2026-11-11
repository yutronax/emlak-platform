# Şablon 8 "tahmin" medya hazırlığı: POV klipler (sabitlenmiş, sıcak renk), donma karesi, bulanık zeminler,
# sentetik "evin sesi" efektleri (ffmpeg ile üretildi, lisanssız): ayak sesi, kapı gıcırtısı, kuş, tik, doğru cevap.
# Kaynak: Cannes Lions 2025 jürisi "platform-yerli" + "trendi çevir" (TEKNIK-HAVUZU #9 #10 #11 #17).
# Çalıştır: python -X utf8 kurgu/tahmin_hazirla.py
import os
import shutil
import subprocess
import sys

sys.path.insert(0, os.path.dirname(__file__))
from kur import KOK, RENK_DUZELT, W, H, klip_hazirla  # noqa: E402

P = os.path.join(KOK, "kurgu", "projeler", "tahmin", "assets")
os.makedirs(P, exist_ok=True)


def ff(*a):
    subprocess.run(["ffmpeg", "-v", "error", "-y", *a], check=True)


B = 0.4497
for ad, src, bas, hiz, kirp in (("hol", "video5", 0.5, 0.8, 0), ("salon", "video1", 0.2, 0.6, 0.08),
                                ("oda", "video3", 0.4, 0.6, 0), ("balkon", "video6", 0.0, 0.7, 0)):
    klip_hazirla(dict(src=f"capcut/medya5/{src}.mp4", bas=bas, hiz=hiz, kirp_ust=kirp, sabitle=True),
                 os.path.join(P, f"{ad}.mp4"), 5 * B)
ff("-sseof", "-0.05", "-i", os.path.join(P, "balkon.mp4"), "-frames:v", "1", "-q:v", "2", os.path.join(P, "donma.jpg"))
for src, ad, bulanik in (("capcut/medya2/balkon.jpg", "kanca.jpg", 0), ("capcut/medya2/salon.jpg", "zemin_bulanik.jpg", 28)):
    vf = f"scale={W}:{H}:force_original_aspect_ratio=increase,crop={W}:{H},{RENK_DUZELT}"
    if bulanik:
        vf += f",gblur=sigma={bulanik},eq=brightness=-0.12"
    ff("-i", os.path.join(KOK, src), "-vf", vf, "-q:v", "2", os.path.join(P, ad))

# --- sentetik ev sesleri ---
# ayak sesi: 4 adım, alçak gövde vuruşu + kısa sürtünme
ff("-f", "lavfi", "-i", "aevalsrc='0.9*sin(2*PI*85*t)*exp(-18*mod(t,0.48))+0.25*(random(0)-0.5)*exp(-40*mod(t,0.48))':d=1.9:s=44100",
   "-af", "lowpass=f=1800,volume=0.8", os.path.join(P, "adim.wav"))
# kapı gıcırtısı: titreyen yükselen ton + sonda tık
ff("-f", "lavfi", "-i", "aevalsrc='0.35*sin(2*PI*(260+180*t)*t)*(0.6+0.4*sin(2*PI*23*t))*lt(t,0.75)+0.8*sin(2*PI*140*t)*exp(-30*(t-0.8))*gte(t,0.8)':d=1.1:s=44100",
   "-af", "highpass=f=120,afade=t=in:d=0.05", os.path.join(P, "kapi.wav"))
# kuş cıvıltısı (balkon): iki kısa glissando
ff("-f", "lavfi", "-i", "aevalsrc='0.3*sin(2*PI*(3200+1400*mod(t,0.22)/0.22)*t)*lt(mod(t,0.55),0.18)*exp(-6*mod(t,0.55))':d=1.6:s=44100",
   "-af", "highpass=f=1500,volume=0.7", os.path.join(P, "kus.wav"))
# geri sayım tiki ve doğru cevap zili
ff("-f", "lavfi", "-i", "aevalsrc='0.8*sin(2*PI*1500*t)*exp(-60*t)':d=0.2:s=44100", os.path.join(P, "tik.wav"))
ff("-f", "lavfi", "-i", "aevalsrc='0.5*(sin(2*PI*880*t)+0.7*sin(2*PI*1320*t))*exp(-4*t)':d=1.2:s=44100", os.path.join(P, "ding.wav"))
ff("-f", "lavfi", "-i", "aevalsrc='0.7*sin(2*PI*(600-400*t*8)*t)*exp(-25*t)':d=0.25:s=44100", os.path.join(P, "pop.wav"))

for kaynak, hedef in ((os.path.join(KOK, "marka", "inza-logo-saydam.png"), "logo.png"),
                      (os.path.join(KOK, "varliklar", "font", "BebasNeue-Regular.ttf"), "BebasNeue.ttf"),
                      (os.path.join(KOK, "muzik", "luxury-real-estate.mp3"), "muzik.mp3"),
                      (os.path.join(KOK, "hyperframes", "ilan", "assets", "impact.wav"), "vurus.wav"),
                      (os.path.join(KOK, "hyperframes", "ilan", "assets", "whoosh.wav"), "whoosh.wav")):
    shutil.copy(kaynak, os.path.join(P, hedef))
print("hazır:", sorted(os.listdir(P)))
