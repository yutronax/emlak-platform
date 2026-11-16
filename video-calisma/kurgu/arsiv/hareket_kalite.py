from pathlib import Path
p=Path('kurgu/projeler/hareket/index.html');s=p.read_text(encoding='utf-8')
s=s.replace('.shade{', '#portal{z-index:20}.shade{',1)
s=s.replace('#16213Eee 0%,#16213Edd 15%,#16213E22 43%,#16213E00 53%', '#16213E 0%,#16213Ef5 38%,#16213E22 46%,#16213E00 53%')
s=s.replace('.letters span{display:inline-block;', '.letters span{display:inline-block;margin-right:2px;')
s=s.replace('class="letters">','class="letters" data-layout-allow-overlap>').replace('class="gold letters">','class="gold letters" data-layout-allow-overlap>')
s=s.replace('top:670px;width:820px;height:440px;perspective','top:740px;width:820px;height:360px;perspective')
s=s.replace('padding:48px;backface','padding:34px 48px;backface')
p.write_text(s,encoding='utf-8')
