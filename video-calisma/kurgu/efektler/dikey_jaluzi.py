"""Dikey dilimler aynı anda açılarak yeni mekânı gösterir.
Kaynak: gemini-radikal-1/gecisler.py
"""
from _ortak import H, Image, ImageDraw, W, main

def render(frames, progress, args, state):
    if progress <= 0:
        return frames[0]
    if progress >= 1:
        return frames[1]
    old, new = frames
    result = new.copy()
    mask = Image.new('L', (W, H), 0)
    draw = ImageDraw.Draw(mask)
    smooth_progress = progress * progress * (3 - 2 * progress)
    for x in range(0, W, 160):
        draw.rectangle((x, 0, x + round(160 * smooth_progress), H), fill=255)
    return Image.composite(new, old, mask)
if __name__ == '__main__':
    main(render, 'gecis', 'Dikey dilimler aynı anda açılarak yeni mekânı gösterir.')
