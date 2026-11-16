"""İkinci görüntü sağdan açılır, en az üç saniye açık kalır ve geri çekilir. Her iki kenar hareketi 0,7 saniyelik kosinüs eğrisiyle yumuşar.
Kaynak: gemini-radikal-2/duzelt.py
"""
from _ortak import H, ImageDraw, W, fit, main, math, np

def configure(cli):
    cli.add_argument('--panel-genisligi', type=int, default=740)

def render(frames, p, args, state):
    if len(frames) != 2:
        raise ValueError('Diptik için --girdi ile iki klip verin')
    if not 100 <= args.panel_genisligi <= 1400:
        raise ValueError('--panel-genisligi 100–1400 arasında olmalı')
    entering = 0.5 - 0.5 * math.cos(math.pi * np.clip(args.t / 0.7, 0, 1))
    leaving = 0.5 - 0.5 * math.cos(math.pi * np.clip((args.sure - args.t) / 0.7, 0, 1))
    q = entering * leaving
    if p == 1:
        q = 0
    result = frames[0].copy()
    width = args.panel_genisligi
    panel = fit(frames[1], (width, H))
    ImageDraw.Draw(panel).line((1, 0, 1, H), fill='#E8C27A', width=2)
    result.paste(panel, (round(W - width * q), 0))
    return result
if __name__ == '__main__':
    main(render, 'kompozisyon', 'İkinci görüntü sağdan açılır, en az üç saniye açık kalır ve geri çekilir. Her iki kenar hareketi 0,7 saniyelik kosinüs eğrisiyle yumuşar.', configure=configure, minimum=4.4)
