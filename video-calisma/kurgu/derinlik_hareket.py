# 2.5B derinlik hareketi: tek bir net kareden, derinlik haritasıyla yumuşak kamera hareketi üretir.
# Odaya hiçbir şey eklenmez; yalnızca netlik/ışık/renk iyileştirilir ve kare kırpılabilir.
# Kullanım: .venv-capcut/Scripts/python.exe -X utf8 kurgu/derinlik_hareket.py <kare.png> <cikti.mp4>
#           [--sure 4] [--hareket ileri|sola|saga|yukari] [--guc 1.0] [--kirp x,y,w,h]
import argparse
import subprocess

import cv2
import numpy as np
import torch
from PIL import Image
from transformers import pipeline

W, H, FPS = 1080, 1920, 30
ap = argparse.ArgumentParser()
ap.add_argument("kare"); ap.add_argument("cikti")
ap.add_argument("--sure", type=float, default=4.0)
ap.add_argument("--hareket", default="ileri")
ap.add_argument("--guc", type=float, default=1.0)
ap.add_argument("--kirp", default="")
a = ap.parse_args()

img = cv2.imdecode(np.fromfile(a.kare, np.uint8), cv2.IMREAD_COLOR)  # Türkçe yol güvenli
if a.kirp:
    x, y, w, h = map(int, a.kirp.split(","))
    img = img[y:y + h, x:x + w]
# 9:16'ya ortadan oturt
h0, w0 = img.shape[:2]
if w0 / h0 > W / H:
    nw = int(h0 * W / H); img = img[:, (w0 - nw) // 2:(w0 - nw) // 2 + nw]
else:
    nh = int(w0 * H / W); img = img[(h0 - nh) // 2:(h0 - nh) // 2 + nh]

# --- iyileştirme: gürültü, büyütme, netlik, ışık/renk (içerik değişmez) ---
img = cv2.fastNlMeansDenoisingColored(img, None, 3, 3, 7, 21)
PAD = 1.35  # kamera hareketi için kenar payı (hareket bu payın içinde kalır, kenar uydurulmaz)
img = cv2.resize(img, (int(W * PAD), int(H * PAD)), interpolation=cv2.INTER_LANCZOS4).astype(np.float32)
img = img + (img - cv2.GaussianBlur(img, (0, 0), 2.0)) * 0.45          # yumuşak netleştirme
img = 255 * ((img / 255) ** 0.95) * 1.03 + 2                              # hafif aydınlatma/kontrast
img += np.random.default_rng(0).normal(0, 1.6, img.shape)               # ince gren: bant/kontur önler
img = np.clip(img, 0, 255).astype(np.uint8)

# --- derinlik ---
cihaz = 0 if torch.cuda.is_available() else -1
d = pipeline("depth-estimation", model="depth-anything/Depth-Anything-V2-Small-hf", device=cihaz)
dep = np.array(d(Image.fromarray(cv2.cvtColor(img, cv2.COLOR_BGR2RGB)))["depth"], np.float32)
dep = cv2.resize(dep, (img.shape[1], img.shape[0]))
dep = (dep - dep.min()) / (dep.max() - dep.min() + 1e-6)  # 1 = yakın
dep = cv2.GaussianBlur(dep, (0, 0), 6)  # kenar yırtılmasını azalt

ih, iw = img.shape[:2]
cx, cy = iw / 2, ih / 2
gx, gy = np.meshgrid(np.arange(W, dtype=np.float32), np.arange(H, dtype=np.float32))
ox, oy = (iw - W) / 2, (ih - H) / 2  # çıktı penceresi kaynağın ortasında
N = int(a.sure * FPS)
yaz = subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "bgr24", "-s", f"{W}x{H}", "-r", str(FPS),
                        "-i", "-", "-c:v", "libx264", "-crf", "16", "-pix_fmt", "yuv420p", "-g", "15", a.cikti], stdin=subprocess.PIPE)
for i in range(N):
    t = i / (N - 1)
    e = 0.5 - 0.5 * np.cos(np.pi * t) * 0.85 - 0.075 * (1 - 2 * t)  # neredeyse sabit hızlı, uçlar hafif yumuşak
    px, py = gx + ox, gy + oy
    D = cv2.remap(dep, px, py, cv2.INTER_LINEAR)
    g = a.guc
    hx, hy = {"ileri": (0, 0), "sola": (1, 0), "saga": (-1, 0), "yukari": (0, 1), "kavis_sol": (1, 0), "kavis_sag": (-1, 0)}[a.hareket]
    dolly = a.hareket in ("ileri", "kavis_sol", "kavis_sag")
    z = 1 + e * ((0.14 + 0.26 * D) if dolly else (0.05 + 0.06 * D)) * g     # ileri itme, yakın nesne daha çok büyür
    m = (e - 0.5) * ((60 + 110 * D) if not a.hareket == "ileri" else 0) * g  # parallaks kayması
    if a.hareket.startswith("kavis"):
        m *= 0.8
    sx = cx + (px - cx) / z + hx * m
    sy = cy + (py - cy) / z + hy * m
    kare = cv2.remap(img, sx.astype(np.float32), sy.astype(np.float32), cv2.INTER_CUBIC, borderMode=cv2.BORDER_REFLECT)
    yaz.stdin.write(kare.tobytes())
yaz.stdin.close(); yaz.wait()
print("yazıldı:", a.cikti)
