"""Doygun ve sıcak renkler, belirgin kontrastla canlı bir kolaj görünümü verir.
Kaynak: gemini-radikal-1 son üretim brifi.
"""
from _ortak import main

def render(frames, p, args, state):
    return frames[0]
render.girdi_filtre = "eq=contrast=1.1:saturation=1.15:brightness=0.05,curves=all='0/0 0.5/0.5 1/1',colorbalance=rs=0.05:gs=0.03:bs=0.02"
if __name__ == '__main__':
    main(render, 'renk', 'Doygun ve sıcak renkler, belirgin kontrastla canlı bir kolaj görünümü verir.')
