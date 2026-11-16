"""Kurulu iris-reveal bileşeninden 1,5 sn oval açılış luma maskesi üretir."""
from pathlib import Path
import os
import re
import subprocess
from _ortak import parser

ROOT = Path(__file__).resolve().parents[2]
PROJECT = ROOT / 'hyperframes/gercek-ilan-1'

def cli(*args):
    env = os.environ.copy()
    env.update(npm_config_cache=str(ROOT/'.runtime/npm-cache'), HYPERFRAMES_CACHE_DIR=str(ROOT/'.runtime/hyperframes-cache'), HYPERFRAMES_BROWSER_PATH=str(ROOT/'.runtime/chrome/chrome-headless-shell.exe'), PRODUCER_BROWSER_GPU_MODE='software', TEMP=str(ROOT/'.runtime/tmp'), TMP=str(ROOT/'.runtime/tmp'))
    env['PATH'] = str(ROOT/'.runtime') + os.pathsep + env['PATH']
    subprocess.run([str(ROOT/'.runtime/node.exe'), str(ROOT/'.runtime/npm/bin/npx-cli.js'), 'hyperframes', *map(str,args)], cwd=PROJECT, env=env, check=True)

def main():
    args = parser('acilis', __doc__).parse_args()
    source = (PROJECT/'compositions/components/iris-reveal.html').read_text(encoding='utf8')
    content = source.rsplit('<template>',1)[1].split('</template>')[0]
    content = re.sub(r'<section class="ir-panel ir-before".*?</section>', '<section class="ir-panel ir-before" style="background:black"></section>', content, flags=re.S)
    content = re.sub(r'<section class="ir-panel ir-after".*?</section>', '<section class="ir-panel ir-after" style="background:white;filter:blur(9px)"></section>', content, flags=re.S)
    content = content.replace('data-duration="3.5"', f'data-duration="{args.sure}" data-width="1920" data-height="1080"')
    content = content.replace('circle(calc(var(--ir-r, 0) * 1px) at', 'ellipse(calc(var(--ir-r, 0) * 1.3px) calc(var(--ir-r, 0) * .75px) at')
    content = content.replace('var STAGE_IN_BASE = 0.32;', 'var STAGE_IN_BASE = 0;').replace('var OPEN_DURATION_BASE = 1.1;', f'var OPEN_DURATION_BASE = {args.sure};').replace('clampNumber(vars.open_at, 0.35, 0, 8)', '0')
    content = content.replace('stroke: var(--ir-accent, #22c55e);','stroke: transparent;')
    page = '<!doctype html><html lang="tr"><head><meta charset="utf-8"><style>html,body{margin:0;width:1920px;height:1080px;background:black;overflow:hidden}</style></head><body>'+content+'</body></html>'
    (PROJECT/'index.html').write_text(page, encoding='utf8')
    cli('check','--json')
    cli('preview','--background')
    cli('render','--quality','delivery','-o',Path(args.o).resolve())

if __name__ == '__main__':
    main()
