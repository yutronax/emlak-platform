"""Üç ayrı görüntü dikey sütunlarda, sırayla karşı yönlerden kayarak yerleşir.
Kaynak: gemini-radikal-1/kolaj_tam.py
"""
from _ortak import H, Image, W, ease, fit, main

def render(frames, p, args, state):
    if len(frames) != 3:
        raise ValueError('Üçlü kolaj için --girdi ile üç klip verin')
    result = Image.new('RGB', (W, H), '#10191f')
    for index, image in enumerate(frames):
        offset = round((1 - ease((args.t - index * 0.06) / 0.4)) * W * (1 if index % 2 else -1))
        result.paste(fit(image, (640, H)), (index * 640 + offset, 0))
    return result
if __name__ == '__main__':
    main(render, 'kompozisyon', 'Üç ayrı görüntü dikey sütunlarda, sırayla karşı yönlerden kayarak yerleşir.')
