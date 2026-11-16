"""Serin gölgeler ile sıcak ahşap ve altın tonlarını dengeler.
Kaynak: gemini-radikal-2 son üretim brifi.
"""
from _ortak import main

def render(frames, p, args, state):
    return frames[0]
render.girdi_filtre = "curves=master='0/0 0.15/0.11 0.5/0.51 1/1',colorbalance=rs=-0.025:gs=0.012:bs=0.025:rm=0.035:gm=0.012:bm=-0.035:pl=1,eq=saturation=1.10"
if __name__ == '__main__':
    main(render, 'renk', 'Serin gölgeler ile sıcak ahşap ve altın tonlarını dengeler.')
