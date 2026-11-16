"""Çapraz ilerleyen maske yeni mekânı köşeden açar.
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
    edge = (W + H) * smooth_progress
    draw.polygon([(0, 0), (edge, 0), (0, edge)], fill=255)
    return Image.composite(new, old, mask)
if __name__ == '__main__':
    main(render, 'gecis', 'Çapraz ilerleyen maske yeni mekânı köşeden açar.')
