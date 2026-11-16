"""Eski görüntünün iki yarısı yanlara ayrılır, aradan yeni mekân görünür.
Kaynak: gemini-radikal-1/gecisler.py
"""
from _ortak import H, ImageDraw, W, main

def render(frames, progress, args, state):
    if progress <= 0:
        return frames[0]
    if progress >= 1:
        return frames[1]
    old, new = frames
    result = new.copy()
    smooth_progress = progress * progress * (3 - 2 * progress)
    gap = round(W * smooth_progress / 2)
    left = old.crop((0, 0, W // 2, H))
    right = old.crop((W // 2, 0, W, H))
    result.paste(left, (-gap, 0))
    result.paste(right, (W // 2 + gap, 0))
    ImageDraw.Draw(result).line((W // 2 - gap, 0, W // 2 - gap, H), fill='#e8c27a', width=5)
    return result
if __name__ == '__main__':
    main(render, 'gecis', 'Eski görüntünün iki yarısı yanlara ayrılır, aradan yeni mekân görünür.')
