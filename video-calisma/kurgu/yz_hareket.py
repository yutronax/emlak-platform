# Yapay zekâ ile kareden kamera hareketli klip (LTX-Video, yerel GPU). Gerçek ilan karesinden üretilir;
# yalnızca kamera hareketi istenir, odaya bir şey eklenmesi/değiştirilmesi istenmez. Her klip elle kontrol edilmeli.
# Kullanım: .venv-capcut/Scripts/python.exe -X utf8 kurgu/yz_hareket.py <kare.png> <cikti.mp4> "<kamera tarifi>" [--kirp x,y,w,h] [--kare 97]
import argparse
import cv2
import numpy as np
import torch
from PIL import Image
from diffusers import LTXImageToVideoPipeline
from diffusers.utils import export_to_video

ap = argparse.ArgumentParser()
ap.add_argument("kare"); ap.add_argument("cikti"); ap.add_argument("tarif")
ap.add_argument("--kirp", default=""); ap.add_argument("--kare", type=int, default=97)  # 97 kare ≈ 4 sn @24
ap.add_argument("--adim", type=int, default=40); ap.add_argument("--tohum", type=int, default=7)
a = ap.parse_args()

img = cv2.imdecode(np.fromfile(a.kare, np.uint8), cv2.IMREAD_COLOR)
if a.kirp:
    x, y, w, h = map(int, a.kirp.split(",")); img = img[y:y + h, x:x + w]
# 9:16 → 480x864 (LTX 32'nin katı ister)
h0, w0 = img.shape[:2]
if w0 / h0 > 480 / 864:
    nw = int(h0 * 480 / 864); img = img[:, (w0 - nw) // 2:(w0 - nw) // 2 + nw]
else:
    nh = int(w0 * 864 / 480); img = img[(h0 - nh) // 2:(h0 - nh) // 2 + nh]
img = cv2.resize(img, (480, 864), interpolation=cv2.INTER_LANCZOS4)
img = cv2.fastNlMeansDenoisingColored(img, None, 3, 3, 7, 21)
resim = Image.fromarray(cv2.cvtColor(img, cv2.COLOR_BGR2RGB))

pipe = LTXImageToVideoPipeline.from_pretrained("Lightricks/LTX-Video", torch_dtype=torch.bfloat16)
pipe.enable_model_cpu_offload()   # 8 GB VRAM için
pipe.vae.enable_tiling()
istem = (f"Smooth cinematic real estate video, {a.tarif}. Stable gimbal camera, steady continuous motion, "
         "the room stays exactly the same, no new objects, no people, realistic interior, natural daylight, sharp details.")
olumsuz = ("people, person, hands, new furniture, changing objects, morphing, warping walls, distortion, flicker, "
           "blurry, low quality, text, watermark, shaky camera")
kareler = pipe(image=resim, prompt=istem, negative_prompt=olumsuz, width=480, height=864, num_frames=a.kare,
               num_inference_steps=a.adim, guidance_scale=3.0,
               generator=torch.Generator().manual_seed(a.tohum)).frames[0]
export_to_video(kareler, a.cikti, fps=24)
print("yazıldı:", a.cikti)
