"""İnce altın vurgu merkezde parlar, görüntü iki yana açılan bir perdeyle belirir.
Kaynak: gemini-radikal-2/duzelt.py
"""
from _ortak import H, Image, ImageDraw, ImageEnhance, W, ease, main

def render(frames, p, args, state):
    q = ease(min(1, args.t / 1.2))
    result = ImageEnhance.Brightness(frames[0]).enhance(0.24)
    half = round(W * q / 2)
    if half:
        result.paste(frames[0].crop((W // 2 - half, 0, W // 2 + half, H)), (W // 2 - half, 0))
    if 0.03 <= args.t <= 0.1:
        ImageDraw.Draw(result).rectangle((W // 2 - 5, 0, W // 2 + 5, H), fill='#F4E8C1')
    return result
if __name__ == '__main__':
    main(render, 'acilis', 'İnce altın vurgu merkezde parlar, görüntü iki yana açılan bir perdeyle belirir.')
