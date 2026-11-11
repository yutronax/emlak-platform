# Geçişlerin akışını görmek için kare şeridi: her kesim anının çevresinden kareler, satır satır.
# Kullanım: python -X utf8 kurgu/gecis_seridi.py <video.mp4> <cikti.png> <kesim_no,...> [plan_suresi]
import os
import subprocess
import sys
import tempfile

video, cikti = sys.argv[1], sys.argv[2]
kesimler = [int(x) for x in sys.argv[3].split(",")]
D = float(sys.argv[4]) if len(sys.argv) > 4 else 4 * 0.4497
OFSETLER = [-0.3, -0.2, -0.13, -0.067, 0, 0.067, 0.13, 0.2, 0.3, 0.4]
gec = tempfile.mkdtemp()
satirlar = []
for k in kesimler:
    kareler = []
    for j, o in enumerate(OFSETLER):
        f = os.path.join(gec, f"{k}_{j}.png")
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", f"{k * D + o:.3f}", "-i", video, "-frames:v", "1",
                        "-vf", f"scale=256:144,drawtext=text='{k}  {o:+.2f}':fontcolor=yellow:fontsize=18:x=4:y=4", f],
                       check=True)
        kareler.append(f)
    satir = os.path.join(gec, f"s{k}.png")
    girdi = sum((["-i", f] for f in kareler), [])
    subprocess.run(["ffmpeg", "-v", "error", "-y", *girdi, "-filter_complex",
                    "".join(f"[{i}]" for i in range(len(kareler))) + f"hstack={len(kareler)}", satir], check=True)
    satirlar.append(satir)
girdi = sum((["-i", f] for f in satirlar), [])
fc = "".join(f"[{i}]" for i in range(len(satirlar))) + f"vstack={len(satirlar)}" if len(satirlar) > 1 else "null"
subprocess.run(["ffmpeg", "-v", "error", "-y", *girdi, "-filter_complex", fc, cikti], check=True)
print(cikti)
