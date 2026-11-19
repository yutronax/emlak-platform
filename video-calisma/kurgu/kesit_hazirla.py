# Ham telefon turundan seçilen kesitleri rijit sabitleyip (vidstab, warp yok) dikey 1080x1920, her kare anahtar kare olarak çıkarır.
# Kullanım: python -X utf8 kurgu/kesit_hazirla.py <kaynak.mp4> <cikti_klasoru> ad:bas:sure[:kirp] ...
#   kirp: ffmpeg crop ifadesi (ör. 480:600:0:0 → üst kısım). Remotion'a doğrudan girer.
import os, subprocess, sys

src, out = sys.argv[1], sys.argv[2]
os.makedirs(out, exist_ok=True)
for spec in sys.argv[3:]:
    p = spec.split(":")
    ad, bas, sure = p[0], float(p[1]), float(p[2])
    kirp = ("crop=" + ":".join(p[3:7]) + ",") if len(p) >= 7 else ""
    cs, cl = max(0.0, bas - 1), sure + 2
    on = bas - cs
    trf = os.path.join(out, ad + ".trf")
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", str(cs), "-t", str(cl), "-i", src, "-vf",
                    f"fps=30,vidstabdetect=shakiness=10:accuracy=15:fileformat=ascii:result='{trf.replace(chr(92), '/').replace(':', chr(92) + ':')}'",
                    "-an", "-f", "null", "-"], check=True)
    g = (f"fps=30,vidstabtransform=input='{trf.replace(chr(92), '/').replace(':', chr(92) + ':')}':optalgo=gauss:smoothing=20:optzoom=1:interpol=bicubic:relative=1:maxshift=24:maxangle=0.04:zoom=3,"
         f"trim=start={on}:duration={sure},setpts=PTS-STARTPTS,{kirp}hqdn3d=1.0:0.8:1.5:1.2,"
         "eq=contrast=1.035:brightness=0.014:saturation=1.03,colorbalance=rs=0.012:bs=-0.009,"
         "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1,unsharp=5:5:0.6,"
         "tpad=stop_mode=clone:stop_duration=0.6,fps=30")
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", str(cs), "-t", str(cl), "-i", src, "-vf", g, "-an",
                    "-c:v", "libx264", "-crf", "16", "-g", "1", "-bf", "0", "-pix_fmt", "yuv420p", "-video_track_timescale", "30000",
                    os.path.join(out, ad + ".mp4")], check=True)
    os.remove(trf)
    print("ok", ad)
