"""Sıcak kâğıt üzerinde beliren karakalem çizim, yumuşak bir ışık sınırıyla gerçek görüntüye dönüşür. Kaynak görüntü açılış boyunca kesintisiz ilerler.
Kaynak: gemini-cizim-radikal-1/duzelt.py + kurgu/cizimden_gercege.py
"""
from _ortak import H, Image, W, cv2, ease, main, np

def configure(cli):
    cli.add_argument('--yon', choices=['sag', 'sol'], default='sag')
    cli.add_argument('--silme-orani', type=float, default=0.55)

def render(frames, p, args, state):
    if not 0 < args.silme_orani <= 0.55:
        raise ValueError('--silme-orani 0–0.55 aralığında olmalı')
    pixels = np.asarray(frames[0])
    if 'kagit' not in state:
        noise = np.random.default_rng(1).integers(0, 10, (H, W, 1), dtype=np.uint8)
        state['kagit'] = np.clip(np.array([244, 240, 232]) + noise, 0, 255).astype(np.float32) / 255
    gray = cv2.cvtColor(pixels, cv2.COLOR_RGB2GRAY)
    sketch = cv2.divide(gray, 255 - cv2.GaussianBlur(255 - gray, (31, 31), 0), scale=256)
    sketch = cv2.convertScaleAbs(sketch, alpha=1.6, beta=-110).astype(np.float32)[..., None] / 255
    amount = ease(p / 0.3) ** 0.6
    reveal = np.clip((1 - sketch - (1 - amount) * 0.9) * 4, 0, 1) * amount
    drawing = state['kagit'] * (1 - reveal * (1 - sketch))
    sweep = ease((p - 0.45) / args.silme_orani)
    xs = np.linspace(0, 1, W, dtype=np.float32)[None, :, None]
    if args.yon == 'sol':
        xs = 1 - xs
    mask = np.clip((sweep * 1.12 - xs) / 0.12, 0, 1)
    edge = np.exp(-((xs - sweep * 1.12 + 0.06) / 0.02) ** 2) * (0 < sweep < 1)
    result = drawing * (1 - mask) + pixels.astype(np.float32) / 255 * mask + edge * np.array([0.45, 0.25, 0.1])
    return Image.fromarray((np.clip(result, 0, 1) * 255).astype(np.uint8))
if __name__ == '__main__':
    main(render, 'acilis', 'Sıcak kâğıt üzerinde beliren karakalem çizim, yumuşak bir ışık sınırıyla gerçek görüntüye dönüşür. Kaynak görüntü açılış boyunca kesintisiz ilerler.', configure=configure, minimum=2)
