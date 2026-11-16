"""Çözülme sırasında kenarlardan merkeze kısa bir kararma ilerler, ardından yeni görüntü açılır.
Kaynak: gemini-yeni-tur-1/son_dokunus.py
"""
from _ortak import H, Image, W, ease, main, np

def render(frames, p, args, state):
    if 'radius' not in state:
        y, x = np.mgrid[0:H, 0:W]
        state['radius'] = np.sqrt(((x - W / 2) / (W / 2)) ** 2 + ((y - H / 2) / (H / 2)) ** 2)
    image = Image.blend(frames[0], frames[1], ease(p))
    amount = 0.12 + 0.88 * np.clip((abs(2 * p - 1) - 0.35 * state['radius']) * 2, 0, 1)
    if p == 0 or p == 1:
        amount = np.ones((H, W))
    return Image.fromarray((np.asarray(image) * amount[..., None]).astype(np.uint8))
if __name__ == '__main__':
    main(render, 'gecis', 'Çözülme sırasında kenarlardan merkeze kısa bir kararma ilerler, ardından yeni görüntü açılır.')
