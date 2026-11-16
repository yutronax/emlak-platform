"""Yatay şeritler yeni görüntüyü eşzamanlı olarak açar.
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
    for y in range(0, H, 180):
        draw.rectangle((0, y, W, y + round(180 * smooth_progress)), fill=255)
    return Image.composite(new, old, mask)
if __name__ == '__main__':
    main(render, 'gecis', 'Yatay şeritler yeni görüntüyü eşzamanlı olarak açar.')
