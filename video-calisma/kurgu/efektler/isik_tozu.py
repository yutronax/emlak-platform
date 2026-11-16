"""Küçük, yarı saydam ışık tanecikleri yavaşça yukarı süzülür.
Kaynak: gemini-cizim-radikal-1/son_dokunus.py
"""
from _ortak import H, Image, ImageDraw, ImageFilter, W, main, math

def render(frames, p, args, state):
    layer = Image.new('RGBA', (W, H))
    draw = ImageDraw.Draw(layer)
    for i in range(28):
        x = 1000 + i * 137 % 800 + 8 * math.sin(args.t * 2)
        y = (180 + i * 79 % 600 - 12 * args.t) % H
        draw.ellipse((x, y, x + 3, y + 3), fill=(255, 247, 226, round(40 * min(1, args.siddet))))
    return Image.alpha_composite(frames[0].convert('RGBA'), layer.filter(ImageFilter.GaussianBlur(1)))
if __name__ == '__main__':
    main(render, 'isik', 'Küçük, yarı saydam ışık tanecikleri yavaşça yukarı süzülür.')
