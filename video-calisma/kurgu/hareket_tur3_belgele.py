from pathlib import Path
import shutil,json,hashlib,subprocess
R=Path(__file__).resolve().parent.parent
P=R/'kurgu/projeler/hareket'
report=R/'cikti/hareket-ornek-RAPOR.md'
old=R/'cikti/hareket-tur2-RAPOR-arsiv.md'
if not old.exists(): shutil.copy2(report,old)
shutil.copy2(P/'index.html',P/'index-tur3-final.html')
med=P/'MEDYA.md'
text=med.read_text(encoding='utf-8')
text+='''

## Tur 3 — güncel kaynak eşlemesi

0–3,55: oda-clean.jpg, medya5/video3 ilk kare; sol tesisat ve tavan kablosu kadraj dışında.
3,55–7,11: medya2/balkon.jpg, mevcut üç derinlik katmanı ve örtülü kenar dolgusu.
7,11–10,66: medya2/koridor.jpg, koridor-back.jpg / mid.png / front.png.
10,66–14,22: medya5/video9.mp4, banyo-clean.mp4; 0,65x hız, deshake, alt kırpma %10, 30fps.
14,22–17,78: medya2/manzara.jpg.
17,78–21,333: medya2/salon.jpg; soldaki tezgahsız mutfak kadraj dışında.

Altı farklı kaynak, altı bölüm. Video3'ten tek kare kullanımı bilinçlidir: ilk kare kapağında temiz kadrajı sabit tutarken GSAP kamerayla hareket sağlar.
Koridor katmanları özgün fotoğrafın uzak kapı/orta bölge/yakın sol duvar alanlarıdır. Arka plaka özgün fotoğraftır; bu turda yeni üretken dolgu yoktur. Küçük paralaks hareketi kenar tekrarını sınırlamak içindir, gerçek 3D rekonstrüksiyon değildir.
Önceki turdaki balkon-clean.mp4 ve manzara paralaks dosyaları arşivde bulunur fakat bu turda oynatılmaz.
Sanal döşeme kullanılmadı. Fiyat X.XXX.XXX TL; telefon 0 (5XX) XXX XX XX; 145 m² temsilidir.
'''
med.write_text(text,encoding='utf-8')
print('Kaynak notu, tur 2 rapor arşivi ve tur 3 final HTML kaydedildi.')
