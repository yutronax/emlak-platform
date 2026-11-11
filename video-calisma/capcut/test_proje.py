# pycapcut uyumluluk testi: 3 fotoğraf + geçiş + giriş animasyonu + yazı + müzik
# Çalıştır: .venv-capcut\Scripts\python.exe -X utf8 capcut\test_proje.py
import os
import pycapcut as cc
from pycapcut import trange, SEC

KOK = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
VERI = os.path.join(KOK, "gerçek_test_veri")
TASLAK = os.path.join(os.environ["LOCALAPPDATA"], "CapCut", "User Data", "Projects", "com.lveditor.draft")

proje = cc.ScriptFile(1080, 1920)   # kaydetme CapCut 9.x iskeletiyle yapılır (taslak.py)
proje.add_track(cc.TrackType.video).add_track(cc.TrackType.audio).add_track(cc.TrackType.text)

fotolar = ["WhatsApp Image 2026-11-03 at 19.54.20 (2).jpeg",
           "WhatsApp Image 2026-11-03 at 19.54.20 (3).jpeg",
           "WhatsApp Image 2026-11-03 at 19.54.21 (4).jpeg"]
for i, ad in enumerate(fotolar):
    seg = cc.VideoSegment(os.path.join(VERI, ad), trange(f"{i * 2}s", "2s"))
    if i == 0:
        seg.add_animation(cc.IntroType.动感放大)
    else:
        pass
    if i < len(fotolar) - 1:
        seg.add_transition(cc.TransitionType.White_Flash)
    proje.add_segment(seg)

proje.add_segment(cc.AudioSegment(os.path.join(KOK, "muzik", "luxury-real-estate.mp3"),
                                  trange("0s", "6s"), source_timerange=trange("4s", "6s")).add_fade("0.5s", "1s"))

yazi = cc.TextSegment("GENİŞ OFİS KATI", trange("0.3s", "1.6s"),
                      style=cc.TextStyle(size=12.0, bold=True, color=(1.0, 1.0, 1.0), align=1),
                      clip_settings=cc.ClipSettings(transform_y=-0.5))
yazi.add_animation(cc.TextIntro.向上滑动)
proje.add_segment(yazi)

from taslak import kaydet
print("kaydedildi:", kaydet(proje, "ilan-test"))
