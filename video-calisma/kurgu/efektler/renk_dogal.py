"""Hafif kontrast ve dengeli açık tonlarla doğal bir mekân görünümü sağlar.
Kaynak: gemini-cizim-1 son üretim brifi.
"""
from _ortak import main

def render(frames, p, args, state):
    return frames[0]
render.girdi_filtre = "eq=contrast=1.05:saturation=1.02:brightness=0.01,colorbalance=rs=0.015:bs=0.015:rh=0.015:bh=-0.01,curves=all='0/0 0.2/0.18 0.8/0.83 1/1'"
if __name__ == '__main__':
    main(render, 'renk', 'Hafif kontrast ve dengeli açık tonlarla doğal bir mekân görünümü sağlar.')
