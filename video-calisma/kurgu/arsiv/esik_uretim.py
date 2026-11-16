"""Üretim CLI sarmalayıcı: Windows realpath engelini symlink korumasıyla aşar."""
from pathlib import Path
import subprocess,sys,os,json
ROOT=Path(__file__).resolve().parents[1]
CLI=Path(os.environ['LOCALAPPDATA'])/'npm-cache/_npx/8a5870cc59afb7ee/node_modules/hyperframes/dist/cli.js'
P=ROOT/'kurgu/projeler/esik'
if sys.argv[1]=='catalog':
    r=subprocess.run(['node','--preserve-symlinks','--preserve-symlinks-main',str(CLI),'catalog','--json'],capture_output=True)
    (ROOT/'cikti/esik-katalog.json').write_bytes(r.stdout)
    items=json.loads(r.stdout); print(json.dumps([x for x in items if any(s in x['name'] for s in ['cinemagraph','before-after','carousel-vision'])],ensure_ascii=False,indent=2));sys.exit(r.returncode)
tag=sys.argv[1]; args=sys.argv[2:]
env=dict(os.environ)
env['LOCALAPPDATA']=str(P/'.runtime-data')
env['NODE_OPTIONS']='--preserve-symlinks --preserve-symlinks-main'
r=subprocess.run(['node','--preserve-symlinks','--preserve-symlinks-main',str(CLI),*args],cwd=P,capture_output=True,env=env)
(ROOT/f'cikti/esik-{tag}.log').write_bytes(r.stdout+r.stderr)
print((r.stdout+r.stderr).decode('utf-8',errors='replace')[-8500:]);sys.exit(r.returncode)
