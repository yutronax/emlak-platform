from pathlib import Path
P=Path(__file__).resolve().parent/'projeler/esik/index.html'
s=P.read_text(encoding='utf-8')
s=s.replace('left:540px;top:860px','left:540px;top:950px').replace('left:-270px;top:-355px;width:540px;height:710px','left:-240px;top:-270px;width:480px;height:540px')
s=s.replace('ODA / PENCERE IŞIĞI','ODA · DUŞ · MANZARA')
P.write_text(s,encoding='utf-8')
