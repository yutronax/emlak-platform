"""Önce soldaki dar sütun, ardından sağdaki geniş sütun yukarı kayar. İkinci sütun 0,4 saniye gecikir, görüntüler hareket etmeyi sürdürür.
Kaynak: gemini-cizim-radikal-1/duzelt.py
"""
from _ortak import H, W, main, np

def configure(cli):
    cli.add_argument('--oran', type=float, default=0.38)
    cli.add_argument('--gecikme', type=float, default=0.4)

def render(frames, p, args, state):
    if not 0 < args.oran < 1 or not 0 <= args.gecikme < args.sure:
        raise ValueError('Sütun oranı 0–1, gecikme süre aralığında olmalı')
    old, new = frames
    result = old.copy()
    split = round(W * args.oran)
    for left, right, delay in [(0, split, 0), (split, W, args.gecikme)]:
        q = np.clip((p * args.sure - delay) / (args.sure - args.gecikme), 0, 1)
        height = round(H * q)
        if height:
            result.paste(new.crop((left, 0, right, height)), (left, H - height))
        if height < H:
            result.paste(old.crop((left, height, right, H)), (left, 0))
    return result
if __name__ == '__main__':
    main(render, 'gecis', 'Önce soldaki dar sütun, ardından sağdaki geniş sütun yukarı kayar. İkinci sütun 0,4 saniye gecikir, görüntüler hareket etmeyi sürdürür.', configure=configure, minimum=0.6)
