"""Hareket yönünde kısa ivmelenme, orta noktada sert kesim ve sakinleşme."""
from _ortak import main, ImageFilter, Image, W, H

def render(frames, progress, args, state):
    before = progress < .5
    strength = (progress * 2) ** 2 if before else ((1-progress)*2) ** 2
    source = frames[0 if before else 1]
    # Overscan keeps the moving edge filled throughout the nine-frame cut.
    margin_x, margin_y = max(2, round(W / 96)), max(2, round(H / 90))
    image = source.resize((W + 2 * margin_x, H + 2 * margin_y), Image.Resampling.BICUBIC)
    offset = round(margin_x + (1 if before else -1) * margin_x * .9 * strength)
    return image.crop((offset, margin_y, offset + W, margin_y + H)).filter(ImageFilter.GaussianBlur(1.8*strength))

if __name__ == '__main__':
    main(render,'gecis',__doc__)
