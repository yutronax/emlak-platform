"""Kadrajdan çapraz geçen yumuşak ışık huzmesi iç mekâna sıcaklık katar.
Kaynak: gemini-yeni-tur-1/son_dokunus.py
"""
from _ortak import H, W, light, main, np

def render(frames, p, args, state):
    if 'mask' not in state:
        y, x = np.mgrid[0:H, 0:W]
        state['mask'] = np.exp(-((x - y - 680) / 92) ** 2)
    return light(frames[0], state['mask'], strength=0.11 * args.siddet)
if __name__ == '__main__':
    main(render, 'isik', 'Kadrajdan çapraz geçen yumuşak ışık huzmesi iç mekâna sıcaklık katar.')
