"""Eski görüntü koyu bir kıvrımla sayfa gibi kenara çekilir.
Kaynak: gemini-radikal-1/gecisler.py
"""
from _ortak import H, Image, ImageEnhance, W, main

def render(frames, progress, args, state):
    if progress <= 0:
        return frames[0]
    if progress >= 1:
        return frames[1]
    old, new = frames
    result = new.copy()
    smooth_progress = progress * progress * (3 - 2 * progress)
    result = new.copy()
    edge = round(W * (1 - smooth_progress))
    if edge > 0:
        result.paste(old.crop((0, 0, edge, H)), (0, 0))
        fold = min(200, edge)
        result.paste(ImageEnhance.Brightness(old.crop((edge - fold, 0, edge, H)).transpose(Image.Transpose.FLIP_LEFT_RIGHT)).enhance(0.5), (edge - fold, 0))
    return result
if __name__ == '__main__':
    main(render, 'gecis', 'Eski görüntü koyu bir kıvrımla sayfa gibi kenara çekilir.')
