from pathlib import Path
import os,subprocess,sys
R=Path.cwd(); project=R/'hyperframes/gercek-ilan-1-v2'
env=os.environ.copy();env['PATH']=str(R/'.runtime')+os.pathsep+env['PATH'];env['npm_config_cache']=str(R/'.runtime/npm-cache');env['HYPERFRAMES_CACHE_DIR']=str(R/'.runtime/hyperframes-cache');env['TEMP']=env['TMP']=str(R/'.runtime/tmp');env['HYPERFRAMES_BROWSER_PATH']=str(R/'.runtime/chrome/chrome-headless-shell.exe');env['PRODUCER_BROWSER_GPU_MODE']='software'
def cli(*args,cwd=R):
 subprocess.run([str(R/'.runtime/node.exe'),str(R/'.runtime/npm/bin/npx-cli.js'),'hyperframes',*args],cwd=cwd,env=env,check=True)
if __name__=='__main__':
 if not project.exists():cli('init',str(project),'--resolution','portrait','--skip-skills','--non-interactive')
 for name in ['headline-slam','per-word-rise','spring-pop','whip-pan']:cli('add',name,'--json',cwd=project)
