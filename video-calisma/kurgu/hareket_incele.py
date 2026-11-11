from pathlib import Path
from PIL import Image,ImageDraw
p=Path('capcut/medya2')
files=list(p.glob('*.jpg'))
sheet=Image.new('RGB',(1000,((len(files)+3)//4)*290),'#16213e')
d=ImageDraw.Draw(sheet)
for i,f in enumerate(files):
 im=Image.open(f); im.thumbnail((245,250)); x=(i%4)*250;y=(i//4)*290
 sheet.paste(im,(x,y));d.text((x+8,y+255),f.name,fill='white')
sheet.save('kurgu/hareket-kaynaklar.jpg')
