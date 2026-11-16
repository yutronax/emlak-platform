"""Küçük kareler sıralı olarak büyüyüp yeni görüntüyü kurar.
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
    for row in range(6):
        for col in range(10):
            threshold = (col * 17 + row * 31) % 60 / 60
            tile_progress = min(1, max(0, (smooth_progress - threshold) * 5))
            x, y = (col * W // 10, row * H // 6)
            draw.rectangle((x, y, x + int(W / 10 * tile_progress), y + int(H / 6 * tile_progress)), fill=255)
    return Image.composite(new, old, mask)
if __name__ == '__main__':
    main(render, 'gecis', 'Küçük kareler sıralı olarak büyüyüp yeni görüntüyü kurar.')
