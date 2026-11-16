"""Yumuşak şampanya orta tonları ve soğuk gölgelerle sakin bir iç mekân görünümü verir.
Kaynak: gemini-yeni-tur-1 son üretim brifi.
"""
from _ortak import main

def render(frames, p, args, state):
    return frames[0]
render.girdi_filtre = "eq=contrast=1.04:saturation=0.94,curves=all='0/0.0706 0.5/0.51 1/0.98',colorbalance=rs=-0.018:gs=0.012:bs=0.022:rm=0.025:gm=0.012:bm=-0.018"
if __name__ == '__main__':
    main(render, 'renk', 'Yumuşak şampanya orta tonları ve soğuk gölgelerle sakin bir iç mekân görünümü verir.')
