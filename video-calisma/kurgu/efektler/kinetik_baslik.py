"""İri başlık yana kayarak ve hafif salınımla kadraja oturur, sonunda dışarı çıkar.
Kaynak: gemini-radikal-1/kolaj_okunur.py
"""
from _ortak import H, Image, W, ease, main, math, shadow, text_layer

def render(frames, p, args, state):
    base = frames[0].convert('RGBA')
    if not args.bas <= args.t < args.bitis:
        return base
    elapsed = args.t - args.bas
    remaining = args.bitis - args.t
    opacity = min(1, elapsed / 0.4, remaining / 0.4)
    layer = text_layer(args.metin, args)
    offset = round(-700 * (1 - ease(elapsed / 0.4)) + 1000 * ease((args.t - args.bitis + 0.35) / 0.35) + 18 * math.exp(-elapsed * 8) * math.sin(elapsed * 25))
    moved = Image.new('RGBA', (W, H))
    moved.alpha_composite(layer, (offset, 0))
    layer = moved
    base.alpha_composite(shadow(layer, opacity))
    return base
if __name__ == '__main__':
    main(render, 'yazi', 'İri başlık yana kayarak ve hafif salınımla kadraja oturur, sonunda dışarı çıkar.')
