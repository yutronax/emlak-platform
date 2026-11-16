from pathlib import Path
import re,shutil
R=Path(__file__).resolve().parents[1]; P=R/'kurgu/projeler/esik'; A=P/'assets'
f=P/'index.html'; s=f.read_text(encoding='utf-8')
for i,(cl,t) in enumerate([('tone','0'),('tone','7'),('copy','7'),('copy','14'),('copy','22')]):
    s=s.replace(f'<div class="clip {cl}" data-start="{t}"',f'<div id="layer-{i}" class="clip {cl}" data-start="{t}"')
s=s.replace('<div id="handle">↔</div>','<div id="handle" data-layout-allow-overflow="true"><svg width="46" height="28" viewBox="0 0 46 28"><path d="M2 14H44 M12 3L2 14L12 25 M34 3L44 14L34 25" fill="none" stroke="#fff" stroke-width="3"/></svg></div>')
s=s.replace('z-index:40}#handle','z-index:40}#handle')
# The tone belongs below the graphic divider; position the divider as a root sibling.
s=s.replace('<div id="divider">','<div id="divider" class="clip" data-start="7" data-duration="7" data-track-index="24">')
divider=re.search(r'<div id="divider".*?</svg></div></div>',s).group()
s=s.replace(divider,'').replace('<div id="layer-1"',divider+'\n<div id="layer-1"')
s=s.replace('height:565px;width:5px','height:565px;width:5px;right:auto;bottom:auto')
# Give reused source images unique asset identities for the compiler.
count={}
def unique(m):
    src=m.group(1); count[src]=count.get(src,0)+1
    if count[src]==1:return m.group()
    p=Path(src); dst=p.with_stem(p.stem+f'-use{count[src]}');shutil.copy(P/src,P/dst)
    return 'src="'+dst.as_posix()+'"'
s=re.sub(r'src="(assets/[^\"]+\.jpg)"',unique,s)
# Labels stay in the flat reading plane rather than becoming edge-on miniature text.
s=s.replace('<span>ODA</span>','').replace('<span>DUŞ ALANI</span>','').replace('<span>MANZARA</span>','')
s=s.replace('<p>Oda. Doku. Manzara.</p>','<p id="room-label">ODA / PENCERE IŞIĞI</p>')
f.write_text(s,encoding='utf-8')
report='''# Şablon 9 — plan / nihai rapor
8 Kasım 2026. Dört tur tamamlandı. Son Gemini (gemini-3.5-flash): **genel 9.3/10, yenilik 9.7/10**. Önceki ortam engeli ve teslim yok durumu geçersizdir.

## Teslim
- plan-ornek.mp4: 1080×1920, 30 fps, 26 saniye; dördüncü tur son render.
- plan-ornek-telefon.mp4: 720×1280, H.264 CRF 26, AAC 128k, faststart; 26 saniye, 1.299.996 bayt.
- plan-tur1/2/3/4-elestiri.md: tur arşivleri; plan-ornek-elestiri.md: son değerlendirme.

## Turlar ve puanlar
| Tur | Genel | Yenilik | Revizyon |
|---|---|---|---|
| 1 | 7.6 | 9.5 | İlk render; uzun açılış, banyo ve Türkçe tipografi eleştirileri. |
| 2 | 8.9 | 9.6 | Açılış kısaltma, kadraj, tipografi ve ses revizyonları. |
| 3 | 8.1 | 9.3 | İki saniye açılış; oda/banyo kadrajları, gece etüdü. |
| 4 | 9.3 | 9.7 | Banyo teslim odak klibi; altın plan çizgisi ve sıralı oda vurguları; CTA/telefon büyütme; müzik 0.50, whoosh 0.52, dört snap. |

Puanlar arşiv değerlendirmelerinden alınmıştır; model değerlendirmesi değişkenlik gösterir. Pro HTTP 429 kota hatasından sonra otomatik gemini-3.5-flash yedeği kullanıldı. Video sesiyle değerlendirildi.

## Teknikler ve akış
#8 SVG kat planı çizimi, oda vurgusu ve oda dikdörtgeninden görüntüye maske açılımı. #14 banyoda yazılımsal odak kaydırma; optik çekim iddiası yok. #16 aynı manzarada gece renk/ışık simülasyonu ve sıcak pencere ışıkları.
0–2 açılış; 2–6.8 salon; 6.8–11.6 oda; 11.6–16.4 banyo; 16.4–21 balkon; 21–26 kapanış. Sahte oda ölçüsü/sayaç eklenmedi.

## Kontrol listesi
| Kontrol | Sonuç / kanıt |
|---|---|
| HyperFrames | plan-check-tur4.log: geçti, 0 hata / 7 uyarı. |
| Render | plan-render-tur4.log; son MP4 tamamlandı. |
| Yazı | Son Gemini tipografi 9.6; mobil okunurluk uygun. |
| Kesim / ritim | Son Gemini akış 9.4; kritik kesim hatası bildirilmedi. |
| Örtüşme | Kritik örtüşme bildirilmedi; ölçülmüş piksel denetimi değildir. |
| Ses | Son Gemini 9.0; müzik azaltıldı, geçiş sesleri belirginleştirildi. |
| Görsel dil | Lacivert/altın mimari dil; renk/ışık 9.5. |
| Telefon kopyası | Son renderdan yeniden üretildi; ffprobe ile süre, boyut ve çözünürlük doğrulandı. |

## MOCK ve riskler
3+1 plan ve 145 m² temsili/MOCK; gerçek ölçü değildir. Telefon 0 (5XX) XXX XX XX yer tutucu; fiyat yok. Ekrandaki “temsili plan” ve “Temsili ışık etüdü” açıklamaları korunur. Balkon manzarası balkonun tamamını kanıtlamaz. Gece ışıkları ve banyo odağı simülasyondur. Yayından önce plan/alan/telefon doğrulanmalıdır. Gemini puanı dönüşüm garantisi değildir.
Son eleştirideki maske yumuşatma, gölge/kontrast, odak sesi ve CTA nabzı ince ayarları dört tur sınırı korunarak uygulanmadı. Doğrulanmış telefon yokken gerçek numara eklenmedi. Flaş/ışık sızması önerileri brif kısıtları nedeniyle alınmadı. Son değerlendirmeden sonra video değiştirilmedi.
'''
(R/'cikti/plan-ornek-RAPOR.md').write_text(report,encoding='utf-8')
f=R/'kurgu/SABLONLAR.md';s=f.read_text(encoding='utf-8');start=s.index('## Şablon 9 — plan (kaynak');end=s.index('Çalışma ortamı:',start);s=s[:start]+s[end:];s=s[:s.index('## ?ablon 9')]+'''## Şablon 9 — plan (mimari) — 9.3/10, yenilik 9.7/10
Proje: `kurgu/projeler/plan/`; medya: `kurgu/plan_hazirla.py`.
Teknikler #8 kat planından odaya maskeli geçiş, #14 yazılımsal odak kaydırma, #16 temsili gündüz/gece ışık etüdü.
26 saniye, 1080×1920, 30 fps. Lacivert/altın pafta; iki saniye çizilen plan, oda vurguları, salon → oda → banyo → balkon → gece kapanışı.
Dört tur genel/yenilik: 7.6/9.5 → 8.9/9.6 → 8.1/9.3 → 9.3/9.7. Son check: 0 hata, 7 uyarı.
Teslim: `cikti/plan-ornek.mp4`, `cikti/plan-ornek-telefon.mp4`. Plan, 3+1, 145 m² MOCK; telefon yer tutucu.
Temsili ibareleri korunur. Ayrıntı: `cikti/plan-ornek-RAPOR.md`.
''';f.write_text(s,encoding='utf-8')
f=R/'kurgu/TEKNIK-HAVUZU.md';s=f.read_text(encoding='utf-8').replace('✓ plan (kaynak taslak; render doğrulanmadı)','✓ plan (4 tur; genel 9.3, yenilik 9.7)');f.write_text(s,encoding='utf-8')
