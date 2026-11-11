from pathlib import Path
import json
P=Path('kurgu/projeler/hareket')
for f in [Path('kurgu/hareket-beats.json'),Path('kurgu/hareket-katalog.json'),*P.glob('check-tur*.json'),*P.glob('snapshot-tur*.json')]:
 b=f.read_bytes()
 if b.startswith((b'\xff\xfe',b'\xfe\xff')): f.write_text(b.decode('utf-16'),encoding='utf-8')
for n in [1,2]:
 j=json.loads((P/f'check-tur{n}.json').read_text(encoding='utf-8-sig'))
 assert j['ok'] and not j['browserSkipped']
 for area in ['lint','runtime','layout','contrast','craft']:
  assert j[area]['errorCount']==0
  assert all(x['severity']=='info' or x.get('code')=='nested_structure_needs_subcomposition' for x in j[area]['findings'])
 assert (P/f'index-tur{n}.html.bak').stat().st_size>0
 assert Path(f'cikti/hareket-tur{n}-elestiri.md').stat().st_size>0
for n in ['hareket-ornek.mp4','hareket-ornek-telefon.mp4','hareket-ornek-RAPOR.md']:
 f=Path('cikti')/n;assert f.stat().st_size>0;print(n,f.stat().st_size)
print('İki kalite turu, kaynak yedekleri, eleştiriler ve teslimler doğrulandı.')
