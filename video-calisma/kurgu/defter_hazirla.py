# Şablon 7 "defter" medya hazırlığı: Super 8 dokulu klipler, kâğıt dokusu, el yapımı sesler (kalem, kâğıt).
# Super 8 (SERHANT. ödüllü içerik paketi + D&AD 2025 "handmade"): sıcak ton, hafif kalkık siyah (film), gren,
# vinyet, kare titremesi (gate weave), ışık titreşimi. Hepsi deterministik (n'ye bağlı sinüs), rastgele değil.
# Çalıştır: python -X utf8 kurgu/defter_hazirla.py
import os
import shutil
import subprocess
import sys

sys.path.insert(0, os.path.dirname(__file__))
from kur import KOK, W, H  # noqa: E402

P = os.path.join(KOK, "kurgu", "projeler", "defter", "assets")
os.makedirs(P, exist_ok=True)


def ff(*a):
    subprocess.run(["ffmpeg", "-v", "error", "-y", *a], check=True)


SUPER8 = ("scale={w}:{h}:force_original_aspect_ratio=increase,crop={w}:{h},"
          "crop={W}:{H}:x='12+6*sin(n/2.3)':y='12+5*cos(n/3.1)',"                 # kare titremesi
          "curves=all='0/0.06 0.5/0.52 1/0.95',"                                   # film: siyah hafif kalkık
          "colorbalance=rs=0.08:gs=0.02:bs=-0.08:rm=0.04:bm=-0.05,eq=saturation=0.88,"
          "eq=brightness='0.025*sin(n*1.7)':eval=frame,"                          # ışık titreşimi
          "noise=alls=16:allf=t,vignette=PI/4.5,fps=24,format=yuv420p").format(w=W + 24, h=H + 24, W=W, H=H)

klipler = {  # ad: (kaynak, başlangıç, hız, süre)
    "salon": ("capcut/medya5/video1.mp4", 0.2, 0.6, 3.2),
    "oda": ("capcut/medya5/video3.mp4", 0.4, 0.6, 2.75),
    "balkon": ("capcut/medya5/video6.mp4", 0.0, 0.7, 2.75),
}
for ad, (src, bas, hiz, sure) in klipler.items():
    ff("-ss", str(bas), "-i", os.path.join(KOK, src), "-t", f"{sure}", "-an",
       "-vf", f"setpts=PTS/{hiz}," + SUPER8, "-c:v", "libx264", "-crf", "17", "-preset", "fast", os.path.join(P, f"{ad}.mp4"))

# Polaroid / not fotoğrafları (sıcak, hafif soluk — film baskısı)
FOTO = "curves=all='0/0.05 0.5/0.52 1/0.95',colorbalance=rs=0.06:bs=-0.06,eq=saturation=0.9"
for src, ad, w, h in (("capcut/medya2/banyo.jpg", "p_banyo.jpg", 700, 700), ("capcut/medya2/koridor.jpg", "p_koridor.jpg", 700, 700),
                      ("capcut/medya2/oda2.jpg", "p_oda.jpg", 700, 700), ("capcut/medya2/manzara.jpg", "p_manzara.jpg", 700, 700),
                      ("capcut/medya2/mutfak1.jpg", "p_mutfak.jpg", 900, 1100)):
    ff("-i", os.path.join(KOK, src), "-vf", f"scale={w}:{h}:force_original_aspect_ratio=increase,crop={w}:{h},{FOTO}",
       "-q:v", "3", os.path.join(P, ad))

# Kâğıt dokusu (krem + lif gürültüsü + kenar kararması), deterministik seed
ff("-f", "lavfi", "-i", f"color=0xEFE6D2:s={W}x{H}", "-vf",
   "noise=alls=10:allf=u:all_seed=7,gblur=sigma=0.6,vignette=PI/9,format=rgb24", "-frames:v", "1",
   os.path.join(P, "kagit.jpg"))

# El yapımı sesler (ffmpeg ile üretildi, lisanssız): kalem cızırtısı, kâğıt hışırtısı, damga
ff("-f", "lavfi", "-i", "anoisesrc=d=0.7:c=pink:seed=3:a=0.5", "-af",
   "highpass=f=1800,lowpass=f=6500,volume='0.6+0.4*sin(2*PI*14*t)':eval=frame,afade=t=in:d=0.04,afade=t=out:st=0.55:d=0.15",
   os.path.join(P, "kalem.wav"))
ff("-f", "lavfi", "-i", "anoisesrc=d=0.5:c=brown:seed=5:a=0.6", "-af",
   "highpass=f=400,lowpass=f=4000,afade=t=in:d=0.05,afade=t=out:st=0.25:d=0.25", os.path.join(P, "kagit.wav"))

for kaynak, hedef in ((os.path.join(KOK, "marka", "inza-logo-saydam.png"), "logo.png"),
                      (os.path.join(KOK, "muzik", "luxury-real-estate.mp3"), "muzik.mp3"),
                      (os.path.join(KOK, "hyperframes", "ilan", "assets", "impact.wav"), "damga.wav")):
    shutil.copy(kaynak, os.path.join(P, hedef))
for src in ("salon", "oda"):   # ilk kare: el çizimi işaret konumunu ölçmek için
    ff("-i", os.path.join(P, f"{src}.mp4"), "-frames:v", "1", "-q:v", "3", os.path.join(P, f"_olcu_{src}.jpg"))
print("hazır:", sorted(os.listdir(P)))
