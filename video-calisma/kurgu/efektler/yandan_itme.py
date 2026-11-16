"""Yeni görüntü yandan girerken önceki görüntüyü fiziksel olarak dışarı iter.
Kaynak: gemini-radikal-1/gecisler.py
"""
from _ortak import W, main

def render(frames, progress, args, state):
    if progress <= 0:
        return frames[0]
    if progress >= 1:
        return frames[1]
    old, new = frames
    result = new.copy()
    smooth_progress = progress * progress * (3 - 2 * progress)
    x = round(W * smooth_progress)
    result.paste(old, (-x, 0))
    result.paste(new, (W - x, 0))
    return result
if __name__ == '__main__':
    main(render, 'gecis', 'Yeni görüntü yandan girerken önceki görüntüyü fiziksel olarak dışarı iter.')
