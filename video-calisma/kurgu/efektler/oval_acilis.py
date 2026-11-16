"""Yumuşak kenarlı oval açıklık merkezden genişleyerek görüntüyü siyahın içinden ortaya çıkarır.
Kaynak: gemini-yeni-tur-1/son_dokunus.py
"""
from _ortak import H, Image, W, main, np

def render(frames, p, args, state):
    if 'radius' not in state:
        y, x = np.mgrid[0:H, 0:W]
        state['radius'] = np.sqrt(((x - W / 2) / (W / 2)) ** 2 + ((y - H / 2) / (H / 2)) ** 2)
    alpha = np.clip((min(1, args.t / 0.8) * 1.65 - state['radius']) / 0.15, 0, 1)
    return Image.fromarray((np.asarray(frames[0]) * alpha[..., None]).astype(np.uint8))
if __name__ == '__main__':
    main(render, 'acilis', 'Yumuşak kenarlı oval açıklık merkezden genişleyerek görüntüyü siyahın içinden ortaya çıkarır.')
