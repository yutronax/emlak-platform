"""Giden mekân odağını kaybederken gelen mekân netleşir. Yumuşak çözülme optik odak değişimi hissi verir.
Kaynak: gemini-cizim-radikal-1/gecis_duzelt.py
"""
from _ortak import Image, ImageFilter, ease, main

def render(frames, p, args, state):
    a, b = frames
    q = ease(p)
    leaving = a.filter(ImageFilter.GaussianBlur(3 * p * args.siddet))
    incoming = b.filter(ImageFilter.GaussianBlur(3 * (1 - p) * args.siddet))
    return Image.blend(leaving, incoming, q)
if __name__ == '__main__':
    main(render, 'gecis', 'Giden mekân odağını kaybederken gelen mekân netleşir. Yumuşak çözülme optik odak değişimi hissi verir.')
