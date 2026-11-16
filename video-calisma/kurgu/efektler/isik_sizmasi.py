"""Sıcak bir ışık sızıntısı soldan sağa akarken görüntüler çözülür.
Kaynak: gemini-radikal-1/gecisler.py
"""
from _ortak import H, Image, W, main, math, np

def render(frames, progress, args, state):
    if progress <= 0:
        return frames[0]
    if progress >= 1:
        return frames[1]
    old, new = frames
    result = new.copy()
    smooth_progress = progress * progress * (3 - 2 * progress)
    result = Image.blend(old, new, smooth_progress)
    glow = Image.new('RGB', (W, H), '#ffdc9b')
    ramp = np.exp(-((np.arange(W) - W * progress) / (W * 0.17)) ** 2) * math.sin(math.pi * progress) * 245
    lightmask = Image.fromarray(np.tile(ramp.astype(np.uint8), (H, 1)))
    return Image.composite(glow, result, lightmask)
if __name__ == '__main__':
    main(render, 'gecis', 'Sıcak bir ışık sızıntısı soldan sağa akarken görüntüler çözülür.')
