"""Hafif desatüre görüntüde serin gölgeler ve doğal açık tonlar oluşturur.
Kaynak: gemini-cizim-radikal-1 son üretim brifi.
"""
from _ortak import main

def render(frames, p, args, state):
    return frames[0]
render.girdi_filtre = 'eq=saturation=0.88:contrast=1.025,colorbalance=rs=-0.012:bs=0.025:rh=0.008:bh=0.005'
if __name__ == '__main__':
    main(render, 'renk', 'Hafif desatüre görüntüde serin gölgeler ve doğal açık tonlar oluşturur.')
