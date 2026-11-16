"""Yerel HyperFrames CLI ve teslim renderı için ortak yardımcılar."""
from pathlib import Path
import os
import subprocess

ROOT = Path(__file__).resolve().parents[2]
PROJECT = ROOT / 'hyperframes/gemini-araba-dili-1'


def run(*args, cwd=None):
    subprocess.run(list(map(str, args)), cwd=cwd or ROOT, check=True)


def cli(*args):
    env = os.environ.copy()
    env['PATH'] = str(ROOT / '.runtime') + os.pathsep + env['PATH']
    env['npm_config_cache'] = str(ROOT / '.runtime/npm-cache')
    env['HYPERFRAMES_CACHE_DIR'] = str(ROOT / '.runtime/hyperframes-cache')
    env['PRODUCER_BROWSER_GPU_MODE'] = 'software'
    (ROOT / '.runtime/tmp').mkdir(exist_ok=True)
    env['TEMP'] = env['TMP'] = str(ROOT / '.runtime/tmp')
    env['HYPERFRAMES_BROWSER_PATH'] = str(ROOT / '.runtime/chrome/chrome-headless-shell.exe')
    run_args = [ROOT / '.runtime/node.exe', ROOT / '.runtime/npm/bin/npx-cli.js',
                'hyperframes', *args]
    subprocess.run(list(map(str, run_args)), cwd=PROJECT, env=env, check=True)


def render(output):
    cli('check', '--json')
    cli('render', '--quality', 'delivery', '-o', str(Path(output).resolve()))
