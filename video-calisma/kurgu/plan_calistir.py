"""Windows sandbox içinde açık binary yollarıyla HyperFrames komutları."""
import os, shutil, subprocess, sys
from pathlib import Path
root=Path(__file__).resolve().parent.parent
project=root/'kurgu/projeler/plan'
cli=Path(os.environ['LOCALAPPDATA'])/'npm-cache/_npx/8a5870cc59afb7ee/node_modules/hyperframes/dist/cli.js'
env=os.environ.copy()
env['NODE_OPTIONS']='--preserve-symlinks --preserve-symlinks-main'
env['HYPERFRAMES_BROWSER_PATH']='C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
env['HYPERFRAMES_FFMPEG_PATH']=shutil.which('ffmpeg')
env['HYPERFRAMES_FFPROBE_PATH']=shutil.which('ffprobe')
env['XDG_STATE_HOME']=str(root/'.hyperframes-state')
sys.exit(subprocess.call([shutil.which('node'),str(cli),*sys.argv[1:]],cwd=project,env=env))
