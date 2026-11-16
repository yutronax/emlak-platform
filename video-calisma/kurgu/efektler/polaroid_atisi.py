"""Fotoğraf çerçevesindeki eski görüntü dönerek ekran dışına atılır.
Kaynak: gemini-radikal-1/gecisler.py
"""
from _ortak import H, Image, W, main

def render(frames, progress, args, state):
    if progress <= 0:
        return frames[0]
    if progress >= 1:
        return frames[1]
    old, new = frames
    result = new.copy()
    smooth_progress = progress * progress * (3 - 2 * progress)
    card = Image.new('RGB', (W + 40, H + 100), '#fff8eb')
    card.paste(old, (20, 20))
    card = card.rotate(-28 * smooth_progress, expand=True, resample=Image.Resampling.BICUBIC)
    result.paste(card, (int(-W * smooth_progress * 1.4), int(-H * smooth_progress * 0.8)))
    return result
if __name__ == '__main__':
    main(render, 'gecis', 'Fotoğraf çerçevesindeki eski görüntü dönerek ekran dışına atılır.')
