from pathlib import Path
import re
f=Path(__file__).parent/'projeler/plan/index.html'
s=f.read_text(encoding='utf-8')
s=re.sub(r'(<svg[^>]*id="map3".*?)(</svg>)',lambda m:m[1].replace('y="650" width="370" height="280"','y="560" width="370" height="90"')+m[2],s,flags=re.S)
f.write_text(s,encoding='utf-8')
