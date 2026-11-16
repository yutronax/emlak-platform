"""Yedi hareketli görüntü ekranı doldurur. Üst soldaki ilk hücre büyüyerek tek plana dönüşür, hücreyle birlikte kaynak zaman akışı sürer.
Kaynak: gemini-mozaik-1/istek_duzelt.py
"""
from _ortak import H, Image, ImageEnhance, W, ease, fit, main, np


def configure(cli):
    cli.add_argument('--ileri-ilk', dest='ters_ilk', action='store_false', default=True,
                     help='İlk hücreyi ileri oynatır. Özgün mozaikte ilk hücre ters akar')

def render(frames, p, args, state):
    if len(frames) != 7:
        raise ValueError('Yedi plan için --girdi ile yedi klip verin')
    result = Image.new('RGB', (W, H))
    for index, image in enumerate(frames):
        if index < 6:
            result.paste(fit(image, (640, 360)), (index % 3 * 640, index // 3 * 360))
        else:
            result.paste(fit(image, (W, 360)), (0, 720))
    q = ease((p - 1.8 / 2.8) / (1 / 2.8))
    width, height = (W / (1 + 2 * q), H / (1 + 2 * q))
    result = result.crop((0, 0, width, height)).resize((W, H), Image.Resampling.BICUBIC)
    result = ImageEnhance.Contrast(result).enhance(0.65 + 0.35 * q)
    result = ImageEnhance.Color(result).enhance(0.8 + 0.2 * q)
    pixels = np.asarray(result).astype(np.float32) - 255 * 0.175 * (1 - q)
    return Image.fromarray(np.clip(pixels, 0, 255).astype(np.uint8))
if __name__ == '__main__':
    main(render, 'kompozisyon', 'Yedi hareketli görüntü ekranı doldurur. Üst soldaki ilk hücre büyüyerek tek plana dönüşür, hücreyle birlikte kaynak zaman akışı sürer.', configure=configure, minimum=2.8)
