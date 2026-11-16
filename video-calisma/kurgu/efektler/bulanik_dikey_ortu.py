"""Giden görüntü bulanıklaşırken yeni görüntü yukarıdan aşağı ilerleyen bir örtüyle görünür.
Kaynak: gemini-yeni-tur-1/son_dokunus.py
"""
from _ortak import H, ImageFilter, W, ease, main, math

def render(frames, p, args, state):
    old = frames[0].filter(ImageFilter.GaussianBlur(9 * math.sin(math.pi * p)))
    result = old.copy()
    height = round(H * ease(p))
    if height:
        result.paste(frames[1].crop((0, 0, W, height)), (0, 0))
    return result
if __name__ == '__main__':
    main(render, 'gecis', 'Giden görüntü bulanıklaşırken yeni görüntü yukarıdan aşağı ilerleyen bir örtüyle görünür.')
