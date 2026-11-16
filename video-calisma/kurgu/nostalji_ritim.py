# Nostaljik film görünümü + müziğin ritmine tepki veren efektler (videonun kendi sesi kullanılır).
# Kullanım: .venv-capcut/Scripts/python.exe -X utf8 kurgu/nostalji_ritim.py <girdi.mp4> <cikti.mp4> [--alt_kirp 0.06]
#  Nostalji: sıcak sepya/solgun renk, kalkık siyahlar, film greni, toz/çizik, vinyet, hafif kare titremesi (gate weave), ışık kaçağı.
#  Ritim: her vuruşta pozlama nabzı + mini zoom vuruşu; güçlü vuruşta (onset tepe) ışık patlaması ve renk kayması;
#         her 4. vuruşta (ölçü başı) kısa film yanığı/ışık kaçağı süpürmesi. Yoğunluk anlık ses enerjisine bağlı.
import argparse, subprocess
import cv2, librosa, numpy as np

ap = argparse.ArgumentParser()
ap.add_argument("girdi"); ap.add_argument("cikti"); ap.add_argument("--alt_kirp", type=float, default=0.06)
a = ap.parse_args()
W, H, FPS = 1080, 1920, 30

# --- ses analizi ---
y, sr = librosa.load(a.girdi, sr=22050)
tempo, beats = librosa.beat.beat_track(y=y, sr=sr)
bt = librosa.frames_to_time(beats, sr=sr)
onset = librosa.onset.onset_strength(y=y, sr=sr)
ot = librosa.times_like(onset, sr=sr)
onset = onset / (onset.max() + 1e-6)
rms = librosa.feature.rms(y=y)[0]; rt = librosa.times_like(rms, sr=sr); rms = rms / (rms.max() + 1e-6)
guclu = set(np.round(bt[[i for i, b in enumerate(beats) if onset[min(b, len(onset) - 1)] > np.percentile(onset[beats], 70)]], 3))
print(f"tempo {float(np.atleast_1d(tempo)[0]):.0f} BPM, {len(bt)} vuruş, {len(guclu)} güçlü")

def zarf(t, tepe, tau):  # son vuruştan bu yana üstel sönüm
    gecmis = [x for x in tepe if x <= t]
    return np.exp(-(t - gecmis[-1]) / tau) if gecmis else 0.0

# --- video ---
oku = subprocess.Popen(["ffmpeg", "-v", "error", "-i", a.girdi, "-vf", f"fps={FPS}", "-f", "rawvideo", "-pix_fmt", "bgr24", "-"], stdout=subprocess.PIPE)
info = cv2.VideoCapture(a.girdi); sw, sh = int(info.get(3)), int(info.get(4)); info.release()
yaz = subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "bgr24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
                        "-i", a.girdi, "-map", "0:v", "-map", "1:a", "-c:v", "libx264", "-crf", "17", "-pix_fmt", "yuv420p", "-g", "15",
                        "-c:a", "aac", "-b:a", "192k", "-shortest", a.cikti], stdin=subprocess.PIPE)
rng = np.random.default_rng(3)
gx, gy = np.meshgrid(np.linspace(-1, 1, W, dtype=np.float32), np.linspace(-1, 1, H, dtype=np.float32))
vinyet = np.clip(1 - 0.55 * (gx ** 2 * 0.8 + gy ** 2 * 0.6), 0.35, 1)[..., None]
cizikler = []
i = 0
while True:
    ham = oku.stdout.read(sw * sh * 3)
    if len(ham) < sw * sh * 3: break
    f = np.frombuffer(ham, np.uint8).reshape(sh, sw, 3)
    t = i / FPS
    # filigranı (sağ alt) ve gürültülü alt şeridi at, 9:16'ya ölçekle
    f = f[: int(sh * (1 - a.alt_kirp))]
    hh, ww = f.shape[:2]; nh = int(ww * 16 / 9)
    f = f[max(0, (hh - nh) // 2): max(0, (hh - nh) // 2) + nh] if hh > nh else f
    vb = zarf(t, bt, 0.12)                     # her vuruş: hızlı nabız
    gb = zarf(t, sorted(guclu), 0.22)          # güçlü vuruş
    en = float(np.interp(t, rt, rms))
    # mini zoom vuruşu + gate weave
    z = 1 + 0.035 * vb + 0.025 * gb
    dx = rng.normal(0, 1.2) + 2 * np.sin(t * 7); dy = rng.normal(0, 1.5)
    f = cv2.resize(f, (W, H), interpolation=cv2.INTER_LANCZOS4)
    M = np.float32([[z, 0, (1 - z) * W / 2 + dx], [0, z, (1 - z) * H / 2 + dy]])
    f = cv2.warpAffine(f, M, (W, H), borderMode=cv2.BORDER_REFLECT).astype(np.float32) / 255
    # nostaljik renk: solgun, sıcak, kalkık siyah
    gri = f.mean(2, keepdims=True)
    f = f * 0.72 + gri * 0.28
    f = f * np.array([0.82, 0.95, 1.12], np.float32) + np.array([0.03, 0.035, 0.05], np.float32)  # BGR: sıcak
    f = 0.06 + f * 0.9
    # ritim: pozlama nabzı + güçlü vuruşta ışık patlaması
    f = f * (1 + 0.22 * vb * (0.5 + en)) + 0.18 * gb
    # güçlü vuruşta renk kanalı kayması (kromatik)
    if gb > 0.15:
        s = int(6 * gb)
        f[..., 2] = np.roll(f[..., 2], s, 1); f[..., 0] = np.roll(f[..., 0], -s, 1)
    # ölçü başı (her 4. vuruş): ışık kaçağı süpürmesi
    olcu = [x for j, x in enumerate(bt) if j % 4 == 0]
    lk = zarf(t, olcu, 0.45)
    if lk > 0.02:
        son = [x for x in olcu if x <= t][-1]
        cx = -0.8 + (t - son) * 3.0
        sizinti = np.exp(-(((gx - cx) / 0.55) ** 2 + ((gy + 0.3) / 1.1) ** 2))[..., None]
        f = f + sizinti * lk * np.array([0.10, 0.35, 0.75], np.float32)
    # film greni, toz, çizik, titreme
    f = f * vinyet * (1 + rng.normal(0, 0.025))
    f = f + rng.normal(0, 0.035, (H // 2, W // 2, 1)).astype(np.float32).repeat(2, 0).repeat(2, 1)
    if rng.random() < 0.08: cizikler.append([rng.integers(0, W), rng.integers(3, 10)])
    for c in cizikler:
        cv2.line(f, (int(c[0]), 0), (int(c[0] + rng.integers(-3, 4)), H), (0.85, 0.85, 0.8), 1)
        c[1] -= 1
    cizikler = [c for c in cizikler if c[1] > 0]
    for _ in range(rng.poisson(2)):
        cv2.circle(f, (int(rng.integers(0, W)), int(rng.integers(0, H))), int(rng.integers(1, 4)), (0.1, 0.1, 0.1) if rng.random() < .5 else (0.9, 0.9, 0.85), -1)
    yaz.stdin.write((np.clip(f, 0, 1) * 255).astype(np.uint8).tobytes())
    i += 1
yaz.stdin.close(); yaz.wait(); oku.wait()
print("yazıldı:", a.cikti, i, "kare")
