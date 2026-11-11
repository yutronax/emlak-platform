# İlan tanıtım videosunu CapCut projesi olarak kurar ("ilan-tanitim").
# Kurallar: video-calisma/egitim-notlari.md ve .claude/skills/ilan-video-edit/SKILL.md
#  - Özne her planda merkezde (anahtar karelerle yaklaşırken de merkezde kalır)
#  - Her geçiş bir kez ve bir amaçla; yazılar okunacak kadar ekranda, her plan farklı yazı animasyonu
#  - Emlakta yavaş vuruş (Cory Malveaux): kesimler 3–9 vuruşta bir, müziğin vuruşunda
# Çalıştır: .venv-capcut\Scripts\python.exe -X utf8 capcut\tanitim_proje.py
import os
import pycapcut as cc
from pycapcut import trange, SEC
from taslak import kaydet

KOK = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GORSEL = os.path.join(KOK, "hyperframes", "tanitim", "assets")   # 9:16 kırpılmış görseller
VERI = os.path.join(KOK, "gerçek_test_veri")
MUZIK = os.path.join(KOK, "muzik", "luxury-real-estate.mp3")

B = 0.4497                                      # müzik vuruş aralığı (135 BPM), müzik 4. saniyeden
S = [0, 3.193, 5.441, 6.791, 9.039, 11.737, 13.986, 18.1]   # plan sınırları (vuruş 0,7,12,15,20,26,31)
ALTIN = (0.91, 0.76, 0.48)
us = lambda s: int(round(s * SEC))

proje = cc.ScriptFile(1080, 1920)
proje.add_track(cc.TrackType.video).add_track(cc.TrackType.audio)
proje.add_track(cc.TrackType.text, "baslik").add_track(cc.TrackType.text, "alt")
proje.add_track(cc.TrackType.effect).add_track(cc.TrackType.filter)

# ---- Planlar: (görsel, özne px/py, yaklaşma başlangıç→bitiş, sonraki plana geçiş) ----
planlar = [
    ("salon.jpg",   0.30, 0.47, 1.00, 1.12, None),                        # eşleşmeli kesme: pencere → pencere
    ("manzara.jpg", 0.70, 0.48, 1.12, 1.22, cc.TransitionType.推近),       # aynı mekânda detaya dal
    ("salon.jpg",   0.25, 0.65, 1.30, 1.36, cc.TransitionType.横向模糊),   # whip: mekân değişimi
    ("cephe.jpg",   0.48, 0.40, 1.00, 1.08, cc.TransitionType.叠化),       # nefes planına yumuşak geçiş
    ("KORIDOR",     0.42, 0.45, 1.00, 1.08, cc.TransitionType.竖向模糊),   # yukarı tilt yönünde savrulma
    ("mutfak.jpg",  0.68, 0.53, 1.15, 1.05, cc.TransitionType.White_Flash), # tek vurgu: kapanışa
    ("kapi.jpg",    0.42, 0.58, 1.00, 1.25, None),
]

for i, (dosya, px, py, z0, z1, gecis) in enumerate(planlar):
    sure = S[i + 1] - S[i]
    if dosya == "KORIDOR":   # yavaş çekim nefes planı
        seg = cc.VideoSegment(os.path.join(VERI, "WhatsApp Video 2026-11-03 at 19.54.21.mp4"),
                              trange(f"{S[i]}s", f"{sure}s"),   # hız = kaynak/hedef ≈ 0.6
                              source_timerange=trange("3.0s", f"{sure * 0.6:.3f}s"))
    else:
        seg = cc.VideoSegment(os.path.join(GORSEL, dosya), trange(f"{S[i]}s", f"{sure}s"))
    # Özneyi merkeze getiren ölçek ve konum; ölçek değişirken konum da orantılı değişir → özne merkezde kalır
    taban = 1.05 * max(0.5 / px, 0.5 / (1 - px), 0.5 / py, 0.5 / (1 - py))
    for t, z in ((0, z0), (sure, z1)):
        s = taban * z
        seg.add_keyframe(cc.KeyframeProperty.uniform_scale, us(t), s)
        seg.add_keyframe(cc.KeyframeProperty.position_x, us(t), (0.5 - px) * 2 * s)
        seg.add_keyframe(cc.KeyframeProperty.position_y, us(t), (py - 0.5) * 2 * s)
    if gecis is not None:
        seg.add_transition(gecis, duration="0.5s")
    proje.add_segment(seg)

# Açılış / kapanış efektleri ve tüm videoya hafif sinematik filtre
proje.add_effect(cc.VideoSceneEffectType.渐显开幕, trange("0s", "1.2s"))
proje.add_effect(cc.VideoSceneEffectType.渐隐闭幕, trange(f"{S[7] - 1.2}s", "1.2s"))
proje.add_filter(cc.FilterType.质感, trange("0s", f"{S[7]}s"), intensity=60)

# Müzik
proje.add_segment(cc.AudioSegment(MUZIK, trange("0s", f"{S[7]}s"), source_timerange=trange("4s", f"{S[7]}s"),
                                  volume=0.9).add_fade("0.5s", "1.5s"))

# ---- Yazılar: her planda farklı animasyon, alt üçte birde; 3. planda yazı yok (nefes) ----
def yazi(metin, bas, sure, iz, *, boyut=9.0, renk=(1, 1, 1), x=0.0, y=-0.45, font=cc.FontType.Montserrat,
         kalin=False, giris=None, cikis=cc.TextOutro.渐隐, arka=None):
    t = cc.TextSegment(metin, trange(f"{bas}s", f"{sure}s"), font=font,
                       style=cc.TextStyle(size=boyut, bold=kalin, color=renk, align=1),
                       clip_settings=cc.ClipSettings(transform_x=x, transform_y=y),
                       shadow=cc.TextShadow(alpha=0.6, color=(0, 0, 0)), background=arka)
    if giris:
        t.add_animation(giris, duration="0.6s")
    if cikis:
        t.add_animation(cikis, duration="0.3s")
    proje.add_segment(t, iz)

yazi("YENİ İLAN", 0.5, S[1] - 0.7, "alt", boyut=5.0, renk=ALTIN, y=-0.22, giris=cc.TextIntro.渐显)
yazi("GENİŞ OFİS KATI", 0.9, S[1] - 1.1, "baslik", boyut=15.0, kalin=True, font=cc.FontType.BebasNeue,
     y=-0.35, giris=cc.TextIntro.逐字)
yazi("Boydan boya\ncam cephe", S[1] + 0.2, S[2] - S[1] - 0.4, "baslik", x=-0.3, giris=cc.TextIntro.向右滑动)
yazi("Tuğla kaplama\nduvar", S[3] + 0.15, S[4] - S[3] - 0.35, "baslik", x=0.3, giris=cc.TextIntro.向左模糊)
yazi("Aydınlık koridorlar", S[4] + 0.3, S[5] - S[4] - 0.7, "baslik", boyut=8.0, giris=cc.TextIntro.渐显)
yazi("Hazır mutfak", S[5] + 0.45, S[6] - S[5] - 0.75, "baslik", boyut=9.0, giris=cc.TextIntro.弹入,
     arka=cc.TextBackground(color="#1A1A1A", alpha=0.55, round_radius=0.5))
yazi("TAŞINMAYA HAZIR", S[6] + 0.4, S[7] - S[6] - 0.6, "baslik", boyut=14.0, kalin=True,
     font=cc.FontType.BebasNeue, y=-0.25, giris=cc.TextIntro.打字机, cikis=None)
yazi("Detaylar için hemen yazın", S[6] + 1.5, S[7] - S[6] - 1.7, "alt", boyut=6.0, renk=(0.08, 0.08, 0.08),
     kalin=True, y=-0.45, giris=cc.TextIntro.向上弹入, cikis=None,
     arka=cc.TextBackground(color="#E8C27A", alpha=1.0, round_radius=0.3))

print("kaydedildi:", kaydet(proje, "ilan-tanitim"))
