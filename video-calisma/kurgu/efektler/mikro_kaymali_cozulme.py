"""Görüntüler kadraj genişliğinin yüzde biri kadar kayarak çözülür. Kayma yönü giden çekimin hareketinden ölçülür.
Kaynak: gemini-cizim-radikal-1/gecis_duzelt.py
"""
from _ortak import H, Image, W, cv2, ease, main, np

def configure(cli):
    cli.add_argument('--yon', choices=['oto', 'sag', 'sol'], default='oto')
    cli.add_argument('--kayma', type=float, default=19.2)

def render(frames, p, args, state):
    a, b = [np.asarray(image) for image in frames]
    if 'yon' not in state:
        state['yon'] = -1 if args.yon == 'sol' else 1
    if args.yon == 'oto' and 'onceki' in state and ('olculdu' not in state):
        flow = cv2.calcOpticalFlowFarneback(state['onceki'], cv2.cvtColor(cv2.resize(a, (480, 270)), cv2.COLOR_RGB2GRAY), None, 0.5, 3, 21, 3, 5, 1.2, 0)
        state['yon'] = 1 if np.median(flow[30:-30, 30:-30, 0]) >= 0 else -1
        state['olculdu'] = True
    state['onceki'] = cv2.cvtColor(cv2.resize(a, (480, 270)), cv2.COLOR_RGB2GRAY)
    q = ease(p)

    def slide(pixels, offset):
        matrix = np.float32([[1, 0, offset], [0, 1, 0]])
        return cv2.warpAffine(pixels, matrix, (W, H), borderMode=cv2.BORDER_REFLECT_101)
    leaving = slide(a, state['yon'] * args.kayma * q)
    incoming = slide(b, -state['yon'] * args.kayma * (1 - q))
    return Image.fromarray(cv2.addWeighted(leaving, 1 - q, incoming, q, 0))
if __name__ == '__main__':
    main(render, 'gecis', 'Görüntüler kadraj genişliğinin yüzde biri kadar kayarak çözülür. Kayma yönü giden çekimin hareketinden ölçülür.', configure=configure)
