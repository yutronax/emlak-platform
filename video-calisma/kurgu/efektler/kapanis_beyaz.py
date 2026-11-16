"""Logoyu, çağrıyı, telefon yer tutucusunu ve kredi satırlarını gösteren beyaz kapanış kartı. Son 0,6 saniyede siyaha kapanır.
Kaynak: gemini-mozaik-1/son_dokunus.py
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
        style = 'beyaz'
        bg = '#FFFFFF'
        fg = '#17243a'
        card = Image.new('RGBA', (W, H), bg)
        draw = ImageDraw.Draw(card)
        with Image.open(args.logo) as original:
            logo = original.convert('RGBA')
        bounds = logo.getbbox()
        if bounds:
            logo = logo.crop(bounds)
        logo.thumbnail((600, 280))
        card.alpha_composite(logo, ((W - logo.width) // 2, 140))
        rows = [(args.cagri, 86, 540), (args.telefon, 60, 700), (args.yz_notu, 28, 920), (args.muzik_kredisi, 26, 980)]
        for text, size, y in rows:
            face = font(args.font, size)
            while face.getlength(text) > 1640 and size > 12:
                size -= 1
                face = font(args.font, size)
            draw.text((W // 2, y), text, font=face, fill=fg, anchor='ms')
        state['card'] = card
    card = state['card']
    amount = min(1, max(0, (args.sure - args.t - 1 / FPS) / 0.6))
    return ImageEnhance.Brightness(card.convert('RGB')).enhance(amount)
