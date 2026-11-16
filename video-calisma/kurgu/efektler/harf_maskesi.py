"""Harfler sabit bir açıklıktan yukarı yükselir, harf araları açılarak başlık yerleşir.
Kaynak: gemini-cizim-radikal-1/duzelt.py
"""
from _ortak import main, shadow, text_layer

def render(frames, p, args, state):
    base = frames[0].convert('RGBA')
    if not args.bas <= args.t < args.bitis:
        return base
    elapsed = args.t - args.bas
    remaining = args.bitis - args.t
    opacity = min(1, elapsed / 0.4, remaining / 0.4)
    layer = text_layer(args.metin, args, elapsed, rise=110, tracking=3, mask=True)
    base.alpha_composite(shadow(layer, opacity))
    return base
if __name__ == '__main__':
    main(render, 'yazi', 'Harfler sabit bir açıklıktan yukarı yükselir, harf araları açılarak başlık yerleşir.')
