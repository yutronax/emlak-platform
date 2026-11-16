# "Çizimden gerçeğe" efekti: oda boş kâğıt üstünde karakalem olarak çizilir, sonra yumuşak kenarlı bir silmeyle
# gerçek görüntüye döner. Klip bağımsız çalışır; çıktı sessiz 1920x1080 mp4 (kurguya plan olarak eklenir).
# Kullanım: python -X utf8 kurgu/cizimden_gercege.py <klip.mp4> <baslangic_sn> <cikti.mp4> [sure_sn=5] [yon=sag|sol]
import subprocess
import sys

import cv2
import numpy as np

W, H, FPS = 1920, 1080, 30
klip, bas, cikti = sys.argv[1], float(sys.argv[2]), sys.argv[3]
SURE = float(sys.argv[4]) if len(sys.argv) > 4 else 5.0
YON = sys.argv[5] if len(sys.argv) > 5 else "sag"
N = int(SURE * FPS)
# evreler (sürenin oranı): çizilme → bekleme → silmeyle gerçeğe → gerçek
CIZ, BEKLE, SIL = 0.30, 0.15, 0.30
if len(sys.argv) > 6:
    SIL = float(sys.argv[6])
    if not 0 < SIL <= 1 - CIZ - BEKLE + 1e-9:
        raise ValueError('Silme oranı pozitif olmalı ve kalan süreyi aşmamalı')

oku = subprocess.Popen(["ffmpeg", "-v", "error", "-ss", str(bas), "-i", klip, "-frames:v", str(N),
                        "-vf", f"scale={W}:{H}:force_original_aspect_ratio=increase,crop={W}:{H},fps={FPS}",
                        "-f", "rawvideo", "-pix_fmt", "bgr24", "-"], stdout=subprocess.PIPE)
yaz = subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "bgr24", "-s", f"{W}x{H}",
                        "-r", str(FPS), "-i", "-", "-c:v", "libx264", "-crf", "17", "-pix_fmt", "yuv420p", cikti],
                       stdin=subprocess.PIPE)

kagit = np.full((H, W, 3), (232, 240, 244), np.uint8)                       # sıcak kâğıt tonu (BGR)
kagit = cv2.add(kagit, np.random.default_rng(1).integers(0, 10, (H, W, 1), dtype=np.uint8).repeat(3, 2))  # doku
xs = np.linspace(0, 1, W, dtype=np.float32)[None, :, None]
if YON == "sol":
    xs = 1 - xs


def ease(t):
    t = min(max(t, 0.0), 1.0)
    return t * t * (3 - 2 * t)


def karakalem(f):
    g = cv2.cvtColor(f, cv2.COLOR_BGR2GRAY)
    s = cv2.divide(g, 255 - cv2.GaussianBlur(255 - g, (31, 31), 0), scale=256)
    s = cv2.convertScaleAbs(s, alpha=1.6, beta=-110)                         # çizgileri koyulaştır
    return s


for i in range(N):
    ham = oku.stdout.read(W * H * 3)
    if len(ham) < W * H * 3:
        break
    f = np.frombuffer(ham, np.uint8).reshape(H, W, 3)
    t = i / N
    s = karakalem(f).astype(np.float32)[..., None] / 255.0                  # 1 = beyaz, 0 = çizgi
    # 1) çizilme: koyu çizgiler önce, açık tonlar sonra belirir (kalem darbesi hissi)
    c = ease(t / CIZ) ** 0.6                                                 # ilk anlarda boş kâğıt kalmasın
    esik = 1 - c                                                             # 1→0
    goster = np.clip((1 - s - esik * 0.9) * 4, 0, 1) * c
    cizim = kagit.astype(np.float32) / 255.0 * (1 - goster * (1 - s))
    # 2) silme: yumuşak kenarlı sınır sağa ilerler, sınırda sıcak ışık
    w = ease((t - CIZ - BEKLE) / SIL)
    yumusak = 0.12
    m = np.clip((w * (1 + yumusak) - xs) / yumusak, 0, 1)                   # 1 = gerçek
    gercek = f.astype(np.float32) / 255.0
    kare = cizim * (1 - m) + gercek * m
    kenar = np.exp(-((xs - w * (1 + yumusak) + yumusak / 2) / 0.02) ** 2) * (0 < w < 1)
    kare = np.clip(kare + kenar * np.array([0.10, 0.25, 0.45], np.float32), 0, 1)   # BGR sıcak parlama
    yaz.stdin.write((kare * 255).astype(np.uint8).tobytes())

yaz.stdin.close()
yaz.wait()
oku.wait()
print("yazıldı:", cikti)
