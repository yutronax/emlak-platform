import sys
if '--alfa' in sys.argv:
    from _hf_portre import main as portrait_main
    portrait_main('headline-slam')
    raise SystemExit

"""Kurulu headline-slam bileşenini yeşil zemine render edip videoya bindirir."""
import json
import shutil
from pathlib import Path
from _ortak import parser
from _hf_araba import ROOT, PROJECT, render, run


def main():
    args = parser('yazi', __doc__).parse_args()
    duration = args.bitis - args.bas
    if duration <= 0:
        raise ValueError('Başlık süresi pozitif olmalı')
    assets = PROJECT / 'assets'
    assets.mkdir(exist_ok=True)
    shutil.copy(args.font or ROOT / 'varliklar/font/BebasNeue-Regular.ttf', assets / 'bebas.ttf')
    source = (PROJECT / 'compositions/components/headline-slam.html').read_text(encoding='utf8')
    source = source.replace('Ship it today', args.metin).replace('data-duration="3.5"', f'data-duration="{duration}"')
    source = source.replace('letter-spacing: -0.5cqw;', 'letter-spacing: 0;')
    source = source.replace('font-size: var(--hs-font-size, 10.5cqw);', 'font-size: 110px;')
    source = source.replace('place-items: center;', 'place-items: start; padding: 150px 150px;')
    source = source.replace('width: 90cqw;', 'width: auto;')
    source = source.replace('color: var(--fg, #f8fafc);', 'color: #FFFFFF;')
    source = source.replace('text-shadow: 0 1.2cqh 4.5cqh color-mix(in srgb, #000 52%, transparent);',
                            'text-shadow: 0 3px 3px #000, 2px 2px 2px #000, -2px -2px 2px #000;')
    source = source.replace('var(--font-display, Inter, system-ui, sans-serif)', 'Bebas')
    source = source.replace('var LAND_AT_BASE = 0.58;', 'var LAND_AT_BASE = 0.20;')
    source = source.replace('var IN_BASE = 0.72;', 'var IN_BASE = 0.30;')
    source = source.replace('var OUT_BASE = 0.46;', 'var OUT_BASE = 0.20;')
    (PROJECT / 'compositions/slam-film.html').write_text(source, encoding='utf8')
    variables = json.dumps({'text': args.metin, 'accent_word_index': -1, 'shadow': True}, ensure_ascii=False)
    html = f'''<!doctype html><html lang="tr"><head><meta charset="UTF-8">
<script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
<style>@font-face{{font-family:Bebas;src:url('assets/bebas.ttf')}}
*{{margin:0;box-sizing:border-box}}html,body{{width:1920px;height:1080px;background:#00ff00;overflow:hidden}}
.clip{{position:absolute;inset:0}}</style></head><body>
<div id="root" data-composition-id="main" data-start="0" data-duration="{duration}" data-width="1920" data-height="1080">
<div id="slam" class="clip" data-composition-id="headline-slam" data-composition-src="compositions/slam-film.html"
data-start="0" data-duration="{duration}" data-width="1920" data-height="1080" data-track-kind="graphics"
data-variable-values='{variables}'></div></div>
<script>window.__timelines=window.__timelines||{{}};window.__timelines.main=gsap.timeline({{paused:true}});</script></body></html>'''
    (PROJECT / 'index.html').write_text(html, encoding='utf8')
    layer = Path(args.o).resolve().with_suffix('.green.mp4')
    render(layer)
    run('ffmpeg', '-v', 'error', '-y', '-i', Path(args.video).resolve(), '-i', layer,
        '-filter_complex', f'[1:v]chromakey=0x00ff00:0.18:0.03,despill=type=green,setpts=PTS+{args.bas}/TB[k];[0:v][k]overlay=eof_action=pass:enable=\'between(t,{args.bas},{args.bitis})\'[v]',
        '-map', '[v]', '-an', '-c:v', 'libx264', '-preset', 'fast', '-crf', '18', args.o)


if __name__ == '__main__':
    main()
