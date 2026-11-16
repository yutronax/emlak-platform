"""Altın renkli geniş bir blok kadrajı süpürerek mekân değiştirir.
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
    edge = int(W * smooth_progress * 2)
    result = old.copy() if progress < 0.5 else new.copy()
    draw = ImageDraw.Draw(result)
    draw.rectangle((max(0, edge - W), 0, min(W, edge), H), fill='#e8c27a')
    return result
if __name__ == '__main__':
    main(render, 'gecis', 'Altın renkli geniş bir blok kadrajı süpürerek mekân değiştirir.')
