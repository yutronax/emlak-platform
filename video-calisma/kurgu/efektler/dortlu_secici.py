"""Dört mekân bir arada görünür, ışıklı çerçeve kısa seçimler yapar. Seçilen panel büyüyerek tam ekran olur.
Kaynak: gemini-radikal-1/gecisler.py
"""
from _ortak import H, Image, ImageDraw, W, ease, fit, main

def configure(cli):
    cli.add_argument('--secim', type=int, choices=range(4), default=0)

def render(frames, p, args, state):
    if len(frames) != 4:
        raise ValueError('Seçici için --girdi ile dört klip verin')
    result = Image.new('RGB', (W, H), '#10191f')
    t = args.t * 1.7 / args.sure
    for index, image in enumerate(frames):
        result.paste(fit(image, (960, 540)), (index % 2 * 960, index // 2 * 540))
    if 0.3 <= t < 1.24:
        hops = [1, 3, 2, 1, args.secim]
        active = hops[min(4, int((t - 0.3) / 0.18))]
        x, y = (active % 2 * 960, active // 2 * 540)
        ImageDraw.Draw(result).rectangle((x + 10, y + 10, x + 949, y + 529), outline='#fff2b2', width=18)
    elif t >= 1.24:
        q = ease((t - 1.24) / 0.46)
        x, y = (args.secim % 2 * 960, args.secim // 2 * 540)
        panel = fit(frames[args.secim], (round(960 + 960 * q), round(540 + 540 * q)))
        result.paste(panel, (round(x * (1 - q)), round(y * (1 - q))))
    return result
if __name__ == '__main__':
    main(render, 'kompozisyon', 'Dört mekân bir arada görünür, ışıklı çerçeve kısa seçimler yapar. Seçilen panel büyüyerek tam ekran olur.', configure=configure, minimum=1.7)
