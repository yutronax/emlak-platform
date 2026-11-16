"""İki geniş ve yumuşak sıcak ışık halesi mekândaki aydınlık hissini destekler.
Kaynak: gemini-isik-1/son_dokunus.py
"""
from _ortak import H, W, light, main, np

def render(frames, p, args, state):
    if 'mask' not in state:
        y, x = np.mgrid[0:H, 0:W]
        state['mask'] = np.exp(-(((x - W * .339) / (W * .094)) ** 2 + ((y - H * .194) / (H * .102)) ** 2)) + np.exp(-(((x - W * .651) / (W * .094)) ** 2 + ((y - H * .204) / (H * .102)) ** 2))
    return light(frames[0], state['mask'], strength=0.11 * args.siddet)
if __name__ == '__main__':
    main(render, 'isik', 'İki geniş ve yumuşak sıcak ışık halesi mekândaki aydınlık hissini destekler.')
