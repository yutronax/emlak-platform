"""Logoyu, çağrıyı, telefon yer tutucusunu ve kredi satırlarını gösteren panel kapanış kartı. Son 0,6 saniyede siyaha kapanır.
Kaynak: gemini-cizim-radikal-1/son_dokunus.py
"""
from _ortak import font, FPS, H, Image, ImageDraw, ImageEnhance, W, ease, main

def configure(cli):
    cli.add_argument('--logo', required=True)
    cli.add_argument('--cagri', default='YERİNDE GÖRÜN')
    cli.add_argument('--telefon', default='0 (5XX) XXX XX XX')
    cli.add_argument('--yz-notu', default='Seslendirme yapay zekâ ile üretildi')
    cli.add_argument('--muzik-kredisi', default='')

def render(frames, p, args, state):
    if 'card' not in state:
        style = 'panel'
        bg = '#0b151e'
        fg = '#ECECEC'
        card = Image.new('RGBA', (1200, H), bg)
        draw = ImageDraw.Draw(card)
        with Image.open(args.logo) as original:
            logo = original.convert('RGBA')
        bounds = logo.getbbox()
        if bounds:
            logo = logo.crop(bounds)
        logo.thumbnail((600, 280))
        card.alpha_composite(logo, ((1200 - logo.width) // 2, 140))
        rows = [(args.cagri, 86, 540), (args.telefon, 60, 700), (args.yz_notu, 28, 920), (args.muzik_kredisi, 26, 980)]
        voice_note = 'Seslendirme yapay zekâ ile üretildi'
        if args.yz_notu != voice_note:
            rows.insert(2, (voice_note, 28, 860))
        for text, size, y in rows:
            face = font(args.font, size)
            while face.getlength(text) > 1040 and size > 12:
                size -= 1
                face = font(args.font, size)
            draw.text((600, y), text, font=face, fill=fg, anchor='ms')
        state['card'] = card
    card = state['card']
    panel = card
    base = frames[0].convert('RGBA')
    base.alpha_composite(panel, (round(W - 1200 * ease(args.t / 0.45)), 0))
    card = base
    amount = min(1, max(0, (args.sure - args.t - 1 / FPS) / 0.6))
    return ImageEnhance.Brightness(card.convert('RGB')).enhance(amount)

if __name__ == '__main__':
    main(render, 'kapanis', __doc__, configure)
