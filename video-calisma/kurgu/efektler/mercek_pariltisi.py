"""Sağ üstteki hafif sıcak mercek parıltısı ve ince yatay ışık izi görüntüye eklenir.
Kaynak: gemini-isik-1/son_dokunus.py
"""
from _ortak import H, W, light, main, np

def render(frames, p, args, state):
    if 'mask' not in state:
        y, x = np.mgrid[0:H, 0:W]
        state['mask'] = np.exp(-(((x - W * .77) / (W * .089)) ** 2 + ((y - H * .324) / (W * .089)) ** 2)) + 0.3 * np.exp(-((y - H * .324) / (H * .0185)) ** 2 - ((x - W * .77) / (W * .198)) ** 2)
    return light(frames[0], state['mask'], strength=0.14 * args.siddet)
if __name__ == '__main__':
    main(render, 'isik', 'Sağ üstteki hafif sıcak mercek parıltısı ve ince yatay ışık izi görüntüye eklenir.')
