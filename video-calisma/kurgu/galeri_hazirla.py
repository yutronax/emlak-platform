# Şablon 6 "galeri" medya hazırlığı: renk düzeltilmiş klipler + geçiş shader'ları için uç kareler (son/ilk kare).
# Çalıştır: python -X utf8 kurgu/galeri_hazirla.py
import os
import shutil
import subprocess
import sys

sys.path.insert(0, os.path.dirname(__file__))
from kur import KOK, RENK_DUZELT, W, H, klip_hazirla  # noqa: E402

P = os.path.join(KOK, "kurgu", "projeler", "galeri", "assets")
os.makedirs(P, exist_ok=True)

klipler = {   # ad: (brif parçası, süre sn)
    "salon": (dict(src="capcut/medya5/video1.mp4", bas=0.2, hiz=0.6, kirp_ust=0.08, sabitle=True), 3.15),
    "hol":   (dict(src="capcut/medya5/video5.mp4", bas=0.5, hiz=0.8, sabitle=True), 2.7),
    "oda":   (dict(src="capcut/medya5/video3.mp4", bas=0.4, hiz=0.6, sabitle=True), 2.7),
}
for ad, (p, sure) in klipler.items():
    klip_hazirla(p, os.path.join(P, f"{ad}.mp4"), sure)


def kare(girdi, cikti, an=None, son=False):
    k = ["ffmpeg", "-v", "error", "-y"]
    if son:
        k += ["-sseof", "-0.05"]
    elif an is not None:
        k += ["-ss", str(an)]
    k += ["-i", girdi, "-frames:v", "1", "-q:v", "2", cikti]
    subprocess.run(k, check=True)


def foto(src, cikti, kirp=0.0):
    vf = (f"scale={W}:{int(H * (1 + kirp))}:force_original_aspect_ratio=increase,crop={W}:{H},{RENK_DUZELT}")
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", os.path.join(KOK, src), "-vf", vf, "-q:v", "2", cikti],
                   check=True)


# Geçiş uçları: giden klibin son karesi, gelen klibin ilk karesi
kare(os.path.join(P, "salon.mp4"), os.path.join(P, "u_salon_son.jpg"), son=True)
kare(os.path.join(P, "hol.mp4"), os.path.join(P, "u_hol_ilk.jpg"), an=0)
kare(os.path.join(P, "hol.mp4"), os.path.join(P, "u_hol_son.jpg"), son=True)
kare(os.path.join(P, "oda.mp4"), os.path.join(P, "u_oda_ilk.jpg"), an=0)
kare(os.path.join(P, "oda.mp4"), os.path.join(P, "u_oda_son.jpg"), son=True)
# Fotoğraflar (renk düzeltilmiş)
for src, ad in (("capcut/medya2/salon.jpg", "g_salon.jpg"), ("capcut/medya2/oda1.jpg", "g_oda.jpg"),
                ("capcut/medya2/banyo.jpg", "g_banyo.jpg"), ("capcut/medya2/manzara.jpg", "manzara.jpg"),
                ("capcut/medya2/balkon.jpg", "balkon.jpg")):
    foto(src, os.path.join(P, ad))
for kaynak, hedef in ((os.path.join(KOK, "marka", "inza-logo-saydam.png"), "logo.png"),
                      (os.path.join(KOK, "varliklar", "font", "BebasNeue-Regular.ttf"), "BebasNeue.ttf"),
                      (os.path.join(KOK, "muzik", "luxury-real-estate.mp3"), "muzik.mp3"),
                      (os.path.join(KOK, "hyperframes", "ilan", "assets", "whoosh.wav"), "whoosh.wav"),
                      (os.path.join(KOK, "hyperframes", "ilan", "assets", "impact.wav"), "impact.wav")):
    shutil.copy(kaynak, os.path.join(P, hedef))
print("hazır:", sorted(os.listdir(P)))
