import sys
if '--alfa' in sys.argv:
    from _hf_portre import main as portrait_main
    portrait_main('whip-pan')
    raise SystemExit

"""Kurulu whip-pan shader'ını gerçek kaynak kareleriyle 1920×1080 render eder."""
from pathlib import Path
import re
from _ortak import parser
from _hf_araba import PROJECT, render, run


def main():
    args = parser('gecis', __doc__).parse_args()
    (PROJECT / 'assets').mkdir(exist_ok=True)
    for label, path, start in [('a', args.a, args.a_bas), ('b', args.b, args.b_bas)]:
        run('ffmpeg', '-v', 'error', '-y', '-ss', start, '-i', path, '-vf',
            'scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080',
            '-frames:v', '1', PROJECT / f'assets/{label}.jpg')
    source = (PROJECT / 'compositions/whip-pan.html').read_text(encoding='utf8')
    source = source[source.lower().index('<!doctype html>'):]
    source = re.sub(r'<div class="bp-grid">.*?<!-- GL canvas \(left panel only\) -->',
                    '<img id="s1" src="assets/a.jpg" style="display:none"><img id="s2" src="assets/b.jpg" style="display:none">', source, flags=re.S)
    source = re.sub(r'<!-- Right panel metadata -->.*?(?=<div\s+id="driver")', '', source, flags=re.S)
    source = source.replace('1200', '1920').replace('data-duration="4"', f'data-duration="{args.sure}"')
    start = source.index('          var scene = document.getElementById(sceneId);')
    end = source.index('          var tex = gl.createTexture();', start)
    source = source[:start] + '''          var scene = document.getElementById(sceneId);
          var c = document.createElement("canvas");c.width=1920;c.height=1080;
          c.getContext("2d").drawImage(scene,0,0,1920,1080);
''' + source[end:]
    source = source.replace('if (t >= 1.0 && t < 3.0)', f'if (t >= 0 && t < {args.sure})')
    source = source.replace('easeInOut((t - 1.0) / 2.0)', f'easeInOut(t / {args.sure})')
    source = source.replace('else if (t >= 3.0)', f'else if (t >= {args.sure})')
    source = source.replace('duration: 4,', f'duration: {args.sure},')
    source = source.replace('        captureScene("s1");', '        Promise.all([document.getElementById("s1").decode(),document.getElementById("s2").decode()]).then(function(){\n        captureScene("s1");')
    source = source.replace('      } // end if (gl)', '        });\n      } // end if (gl)')
    (PROJECT / 'index.html').write_text(source, encoding='utf8')
    render(args.o)


if __name__ == '__main__':
    main()
