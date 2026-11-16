"""Merkeze hızla yaklaşan görüntü bulanıklık içinde yeni mekâna geçer.
Kaynak: gemini-radikal-1/gecisler.py
"""
from _ortak import H, ImageFilter, W, main, math

def render(frames, progress, args, state):
    if progress <= 0:
        return frames[0]
    if progress >= 1:
        return frames[1]
    old, new = frames
    result = new.copy()
    smooth_progress = progress * progress * (3 - 2 * progress)
    image = old if progress < 0.5 else new
    zoom_factor = 1 + 2.8 * math.sin(math.pi * progress) ** 4
    crop_width, crop_height = (W / zoom_factor, H / zoom_factor)
    result = image.crop(((W - crop_width) / 2, (H - crop_height) / 2, (W + crop_width) / 2, (H + crop_height) / 2)).resize((W, H))
    return result.filter(ImageFilter.GaussianBlur(6 * math.sin(math.pi * progress)))
if __name__ == '__main__':
    main(render, 'gecis', 'Merkeze hızla yaklaşan görüntü bulanıklık içinde yeni mekâna geçer.')
