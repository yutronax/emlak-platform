"""Merkezden büyüyen elmas biçimi yeni görüntüyü açar.
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
    radius = (W + H) * smooth_progress / 2
    draw.polygon([(W / 2, H / 2 - radius), (W / 2 + radius, H / 2), (W / 2, H / 2 + radius), (W / 2 - radius, H / 2)], fill=255)
    return Image.composite(new, old, mask)
if __name__ == '__main__':
    main(render, 'gecis', 'Merkezden büyüyen elmas biçimi yeni görüntüyü açar.')
