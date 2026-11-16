"""Şampanya tonlu başlık yumuşakça belirir, harf aralığı açılır ve gölgeyle okunur kalır.
Kaynak: gemini-radikal-2/duzelt.py
"""
from _ortak import main, shadow, text_layer

def render(frames, p, args, state):
    base = frames[0].convert('RGBA')
    if not args.bas <= args.t < args.bitis:
        return base
    elapsed = args.t - args.bas
    remaining = args.bitis - args.t
    opacity = min(1, elapsed / 0.4, remaining / 0.4)
    layer = text_layer(args.metin, args, elapsed, tracking=4)
    base.alpha_composite(shadow(layer, opacity))
    return base
if __name__ == '__main__':
    main(render, 'yazi', 'Şampanya tonlu başlık yumuşakça belirir, harf aralığı açılır ve gölgeyle okunur kalır.')
