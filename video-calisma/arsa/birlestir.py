"""Kareleri yazı, logo ve müzikle MP4'e çevirir.

Kullanım: python -X utf8 birlestir.py <parsel.json> <kare_klasoru> <cikti.mp4> [muzik.mp3]
Kural: fiyat yazılmaz; görüntü sanal (uydu tabanlı) olduğu için kapanışta not düşülür.
"""
import json
import os
import subprocess
import sys

kok = os.path.dirname(os.path.abspath(__file__))
FONT = "C\\:/Windows/Fonts/segoeuib.ttf"
FONT_I = "C\\:/Windows/Fonts/segoeui.ttf"
LOGO = os.path.join(kok, "..", "marka", "inza-logo-saydam.png")
FPS = 30


def kac(s):
    return s.replace("\\", "\\\\").replace(":", "\\:").replace("'", "’").replace("%", "\\%")


def yazi(metin, font, boyut, y, bas, son, renk="white"):
    a = f"if(lt(t,{bas}),0,if(lt(t,{bas}+0.5),(t-{bas})/0.5,if(lt(t,{son}-0.5),1,if(lt(t,{son}),({son}-t)/0.5,0))))"
    return (f"drawtext=fontfile='{font}':text='{kac(metin)}':fontsize={boyut}:fontcolor={renk}"
            f":x=(w-text_w)/2:y={y}:alpha='{a}':shadowcolor=black@0.6:shadowx=2:shadowy=3")


def main():
    parsel_yol, kareler, cikti = sys.argv[1:4]
    muzik = sys.argv[4] if len(sys.argv) > 4 else os.path.join(kok, "..", "muzik", "carefree.mp3")
    p = json.load(open(parsel_yol, encoding="utf-8"))["properties"]
    n = len([f for f in os.listdir(kareler) if f.endswith(".jpg")])
    sure = n / FPS

    konum = f"{p['ilceAd']} · {p['mahalleAd']}".upper()
    adapar = f"Ada {p['adaNo']}  /  Parsel {p['parselNo']}"
    alan = f"{p['alan']} m²"
    mevki = f"{p['nitelik']} · {p['mevkii']} mevkii" if p.get("mevkii") else p["nitelik"]

    bitis = sure - 2.5
    filtreler = [
        # üstte okunurluk için hafif koyu degrade
        "drawbox=x=0:y=0:w=iw:h=420:color=black@0.30:t=fill",
        f"drawbox=x=0:y=1500:w=iw:h=260:color=black@0.35:t=fill:enable='between(t,3.2,{bitis})'",
        yazi(konum, FONT, 64, 150, 0.4, bitis),
        yazi(adapar, FONT_I, 44, 240, 0.9, bitis),
        yazi(alan, FONT, 96, 1530, 3.2, bitis, "#ffd84a"),
        yazi(mevki, FONT_I, 44, 1655, 3.6, bitis),
        # kapanış: karart + not
        f"fade=t=out:st={bitis}:d=0.6:color=black@1:alpha=0",
        yazi("Uydu ve parsel verisiyle hazırlanmış sanal tanıtım", FONT_I, 40, 1760, bitis + 0.3, sure + 1),
    ]
    vf = ",".join(filtreler)
    logo_bas = bitis + 0.4
    fc = (f"[0:v]{vf}[a];"
          f"[2:v]scale=520:-1,format=rgba,fade=t=in:st={logo_bas}:d=0.6:alpha=1[l];"
          f"[a][l]overlay=(W-w)/2:(H-h)/2-80:enable='gte(t,{logo_bas})'[v];"
          f"[1:a]afade=t=in:d=1,afade=t=out:st={sure - 1.5}:d=1.5[m]")
    cmd = ["ffmpeg", "-y", "-framerate", str(FPS), "-i", os.path.join(kareler, "k%04d.jpg"),
           "-i", muzik, "-loop", "1", "-i", LOGO,
           "-filter_complex", fc, "-map", "[v]", "-map", "[m]", "-t", f"{sure:.2f}",
           "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "18", "-preset", "slow",
           "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", cikti]
    subprocess.run(cmd, check=True)
    print(cikti)


if __name__ == "__main__":
    main()
