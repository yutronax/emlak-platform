"""İki görüntü daralıp genişleyen yüzeylerle birbiri yerine döner.
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
    result = Image.new('RGB', (W, H), '#08121a')
    seam = round(W * (1 - smooth_progress))
    if seam > 0:
        face = old.resize((max(1, seam), H))
        face = ImageEnhance.Brightness(face).enhance(1 - 0.45 * smooth_progress)
        result.paste(face, (0, 0))
    if seam < W:
        face = new.resize((max(1, W - seam), H))
        face = ImageEnhance.Brightness(face).enhance(0.55 + 0.45 * smooth_progress)
        result.paste(face, (seam, 0))
    return result
if __name__ == '__main__':
    main(render, 'gecis', 'İki görüntü daralıp genişleyen yüzeylerle birbiri yerine döner.')
