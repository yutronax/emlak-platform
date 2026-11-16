"""Kare parçalar merkezden başlayarak büyür ve tek görüntüde birleşir.
Kaynak: gemini-radikal-1/kolaj_tam.py
"""
from _ortak import H, Image, W, ease, main, math

def render(frames, p, args, state):
    result = Image.new('RGB', (W, H))
    for row in range(3):
        for col in range(4):
            delay = 0.055 * math.hypot(col - 1.5, row - 1)
            q = ease((args.t - delay) / 0.27)
            if q:
                tile = frames[0].crop((col * 480, row * 360, (col + 1) * 480, (row + 1) * 360))
                tw, th = (max(1, round(480 * q)), max(1, round(360 * q)))
                result.paste(tile.resize((tw, th)), (col * 480 + (480 - tw) // 2, row * 360 + (360 - th) // 2))
    return result
if __name__ == '__main__':
    main(render, 'acilis', 'Kare parçalar merkezden başlayarak büyür ve tek görüntüde birleşir.')
