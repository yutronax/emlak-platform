"""İnce ışıklı tarama sınırı yukarıdan aşağıya ilerler.
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
    y = round(H * smooth_progress)
    draw.rectangle((0, 0, W, y), fill=255)
    result = Image.composite(new, old, mask)
    ImageDraw.Draw(result).rectangle((0, y - 8, W, y + 8), fill='#c1efff')
    return result
if __name__ == '__main__':
    main(render, 'gecis', 'İnce ışıklı tarama sınırı yukarıdan aşağıya ilerler.')
