# Bir mekânın telefon görüntüsünden kareleri birleştirip panorama yapar (içerik uydurmaz: gerçek kareler),
# sonra panorama üzerinde hızlı, akıcı bir dikey (9:16) kamera gezinmesi üretir.
# Kullanım: .venv-capcut/Scripts/python.exe -X utf8 kurgu/panorama_gezinme.py <video> <bas> <bitis> <cikti.mp4>
#           [--sure 3.5] [--yon sag|sol] [--adim 0.25] [--zoom 1.0]
import argparse, subprocess
import cv2
import numpy as np

W, H, FPS = 1080, 1920, 30
ap = argparse.ArgumentParser()
ap.add_argument("video"); ap.add_argument("bas", type=float); ap.add_argument("bitis", type=float); ap.add_argument("cikti")
ap.add_argument("--sure", type=float, default=3.5); ap.add_argument("--yon", default="sag")
ap.add_argument("--adim", type=float, default=0.25); ap.add_argument("--zoom", type=float, default=1.0); ap.add_argument("--mod", default="panorama")
a = ap.parse_args()

v = cv2.VideoCapture(a.video)
kareler, t = [], a.bas
while t <= a.bitis:
    v.set(cv2.CAP_PROP_POS_MSEC, t * 1000)
    en, enk = -1, None
    for _ in range(4):  # adım içindeki en net kare
        ok, f = v.read()
        if not ok: break
        s = cv2.Laplacian(cv2.cvtColor(f, cv2.COLOR_BGR2GRAY), cv2.CV_64F).var()
        if s > en: en, enk = s, f
    if enk is not None: kareler.append(enk)
    t += a.adim
st = cv2.Stitcher_create(cv2.Stitcher_SCANS if a.mod == "tarama" else cv2.Stitcher_PANORAMA)
durum, pano = st.stitch(kareler)
if durum != 0:
    raise SystemExit(f"panorama birleştirilemedi (kod {durum}, {len(kareler)} kare)")
cv2.imencode(".jpg", pano)[1].tofile(a.cikti.replace(".mp4", "-ham.jpg"))
# siyah kenarları at: maske içinde kalan en büyük dikdörtgeni, kenarlardan içe daraltarak bul
m = (cv2.cvtColor(pano, cv2.COLOR_BGR2GRAY) > 3).astype(np.uint8)
m = cv2.erode(m, np.ones((5, 5), np.uint8))
y0, y1, x0, x1 = 0, m.shape[0] - 1, 0, m.shape[1] - 1
while y1 - y0 > 50 and x1 - x0 > 50:
    ust, alt, sol, sag = m[y0, x0:x1].mean(), m[y1, x0:x1].mean(), m[y0:y1, x0].mean(), m[y0:y1, x1].mean()
    en = min(ust, alt, sol, sag)
    if en >= 0.999: break
    if en == ust: y0 += 2
    elif en == alt: y1 -= 2
    elif en == sol: x0 += 2
    else: x1 -= 2
pano = pano[y0:y1, x0:x1]
cv2.imencode(".jpg", pano)[1].tofile(a.cikti.replace(".mp4", "-pano.jpg"))
ph, pw = pano.shape[:2]
print("panorama", pw, "x", ph, "kare:", len(kareler))

# iyileştirme (içerik değişmez): gürültü, büyütme, yumuşak netlik, ışık
pano = cv2.fastNlMeansDenoisingColored(pano, None, 3, 3, 7, 21)
olcek = H * a.zoom * 1.08 / ph
pano = cv2.resize(pano, (int(pw * olcek), int(ph * olcek)), interpolation=cv2.INTER_LANCZOS4).astype(np.float32)
pano = pano + (pano - cv2.GaussianBlur(pano, (0, 0), 2.0)) * 0.45
pano = np.clip(255 * ((pano / 255) ** 0.95) * 1.03 + 2 + np.random.default_rng(0).normal(0, 1.6, pano.shape), 0, 255).astype(np.uint8)
ph, pw = pano.shape[:2]
if pw < W:
    raise SystemExit("panorama dar: gezinme için yeterli genişlik yok")

N = int(a.sure * FPS)
yaz = subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "bgr24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
                        "-c:v", "libx264", "-crf", "16", "-pix_fmt", "yuv420p", "-g", "15", a.cikti], stdin=subprocess.PIPE)
for i in range(N):
    u = i / (N - 1)
    e = u * u * (3 - 2 * u) * 0.25 + u * 0.75  # neredeyse sabit hız
    if a.yon == "sol": e = 1 - e
    x = e * (pw - W)
    y = (ph - H) / 2 + np.sin(u * np.pi) * (ph - H) * 0.25  # hafif kavis
    z = 1 + 0.06 * np.sin(u * np.pi)  # ortada hafif yaklaşma
    M = np.float32([[z, 0, -x * z - (z - 1) * W / 2], [0, z, -y * z - (z - 1) * H / 2]])
    kare = cv2.warpAffine(pano, M, (W, H), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REFLECT)
    yaz.stdin.write(kare.tobytes())
yaz.stdin.close(); yaz.wait()
print("yazıldı:", a.cikti)
