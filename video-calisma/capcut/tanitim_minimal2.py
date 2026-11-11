# Şablon 5 — "Minimal nesne-merkezli" → CapCut projesi "ilan-minimal2"
# Kaynak araştırma (2026-11-05, egitim-notlari.md):
#  - "How to Make Viral Minimal Reel Edits in CapCut" (youtube MJHpo7pOaLg): ortada tek nesne, arkasında büyüyen koyu
#    gri daire (%50→%205, 1 sn), sahne girişi ölçek 130→100 + dönme 10→0, koyu kutu içinde kayan kelime, küçük çizgi
#    süsleri (— — —), dev çizgili (stroke) arka kelime %20, beyaz zemin + yumuşak kenar gölgesi + pencere ışığı.
#  - Cory Malveaux (G8M3KGSTGcc): kesimler seyrek vuruşta, yazılar güvenli alanda; geçiş az.
#  - Codex eleştirisi: bitmemiş kareler (tezgahsız mutfak) yok; kullanıcı: yazılar büyük olmalı.
# Şablon 3'ten (ilan-minimal) farkı: polaroid/İtalik editoryal yok; her sahne "daire + kart + kutulu kelime" ritmi,
# kartlar dönerek oturur, pencere ışığı zemine düşer, yazılar çok daha büyük.
# Medya: capcut/medya5 (video), capcut/medya2 (foto), capcut/medya3/golge.png, varliklar/overlay/*.png
# Çalıştır: .venv-capcut\Scripts\python.exe -X utf8 capcut\tanitim_minimal2.py
import os
import pycapcut as cc
from pycapcut import trange, SEC
from taslak import kaydet

ILAN = {"oda": "3+1", "m2": "145 m²", "kat": "5. KAT", "bina": "SIFIR BİNA",      # MOCK — gerçek ilanla değiştir
        "fiyat": "X.XXX.XXX TL", "tel": "0 (5XX) XXX XX XX"}

KOK = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
V = lambda n: os.path.join(KOK, "capcut", "medya5", f"video{n}.mp4")
F = lambda ad: os.path.join(KOK, "capcut", "medya2", ad)
OV = lambda ad: os.path.join(KOK, "varliklar", "overlay", ad)
GOLGE = os.path.join(KOK, "capcut", "medya3", "golge.png")
SES = os.path.join(KOK, "hyperframes", "ilan", "assets")
MUZIK = os.path.join(KOK, "muzik", "luxury-real-estate.mp3")
LOGO = os.path.join(KOK, "marka", "inza-logo.jpg")

B = 0.4497
us = lambda s: int(round(s * SEC))
KOMUR = (0.16, 0.16, 0.18)
GRI = (0.45, 0.45, 0.48)
ALTIN = (0.78, 0.57, 0.12)
BEYAZ = (1, 1, 1)
KUTU = "#2A2A2E"

proje = cc.ScriptFile(1080, 1920)
for ad in ("zemin", "isik", "agac", "izgara", "daire", "golge", "kart"):
    proje.add_track(cc.TrackType.video, ad)
proje.add_track(cc.TrackType.audio, "muzik").add_track(cc.TrackType.audio, "sfx")
for ad in ("dev", "t1", "t2", "t3", "t4", "t5"):
    proje.add_track(cc.TrackType.text, ad)

bolumler = [("kanca", 6), ("salon", 5), ("hol", 4), ("oda", 5), ("banyo", 4), ("balkon", 5), ("bilgi", 7),
            ("kapanis", 6)]
T, t = {}, 0.0
for ad, n in bolumler:
    T[ad] = (t, t + n * B)
    t += n * B
SON = t


def seg(dosya, bas, sure, iz, **clip):
    s = cc.VideoSegment(dosya, cc.Timerange(us(bas), us(bas + sure) - us(bas)),
                        clip_settings=cc.ClipSettings(**clip) if clip else None)
    proje.add_segment(s, iz)
    return s


# Zemin: kenarları gölgeli beyaz + pencereden düşen ışık (çarpma modu) — tüm video
seg(OV("kenar_golge.png"), 0, SON, "zemin")
isik = seg(OV("pencere_isigi.png"), 0, SON, "isik", alpha=0.55)
isik.set_mix_mode(cc.MixModeType.正片叠底)
isik.add_keyframe(cc.KeyframeProperty.position_x, 0, -0.08)          # ışık çok yavaş kayar (zaman geçiyor hissi)
isik.add_keyframe(cc.KeyframeProperty.position_x, us(SON), 0.08)

# Unsplash ağaç gölgesi (Augustine Wong, varliklar/unsplash/KAYNAK.txt): açılış, bilgi ve kapanışta duvara düşer,
# rüzgârda gibi hafifçe kayar
AGAC = os.path.join(KOK, "varliklar", "unsplash", "agac_golgesi.png")
for ad_ in ("kanca", "bilgi", "kapanis"):
    a, b = T[ad_]
    g_ = seg(AGAC, a, b - a, "agac", alpha=0.8)
    g_.set_mix_mode(cc.MixModeType.正片叠底)
    g_.add_animation(cc.IntroType.渐显, duration="0.5s")
    g_.add_keyframe(cc.KeyframeProperty.uniform_scale, 0, 1.08)
    g_.add_keyframe(cc.KeyframeProperty.position_x, 0, 0.03)
    g_.add_keyframe(cc.KeyframeProperty.uniform_scale, us(b - a), 1.12)
    g_.add_keyframe(cc.KeyframeProperty.position_x, us(b - a), -0.03)


def daire(ad_, x, y):
    """Kartın arkasında koyu gri daire: %50 → %205, ~1 sn."""
    a, b = T[ad_]
    d = seg(OV("daire_koyu.png"), a, b - a, "daire", transform_x=x, transform_y=y, alpha=0.9)
    d.add_keyframe(cc.KeyframeProperty.uniform_scale, 0, 0.25)
    d.add_keyframe(cc.KeyframeProperty.uniform_scale, us(0.9), 1.0)
    d.add_keyframe(cc.KeyframeProperty.uniform_scale, us(b - a), 1.06)


def kart(ad_, dosya, *, kaynak=None, hiz=1.0, y=0.10, olcek=0.66, yon=1):
    """Ortada yuvarlak köşeli kart: ölçek 1.30→1.00 + dönme 10°→0 ile oturur, sonra yavaşça yaklaşır."""
    a, b = T[ad_]
    sure = b - a
    g = seg(GOLGE, a, sure, "golge", scale_x=0.86, scale_y=0.86, transform_y=y - 0.035, alpha=0.55)
    g.add_animation(cc.IntroType.渐显, duration="0.5s")
    tr = cc.Timerange(us(a), us(a + sure) - us(a))
    st = cc.Timerange(us(kaynak), int(tr.duration * hiz)) if kaynak is not None else None
    s = cc.VideoSegment(dosya, tr, source_timerange=st, speed=hiz if kaynak is not None else None,
                        clip_settings=cc.ClipSettings(transform_y=y))
    if kaynak is not None:
        s.volume = 0
    s.add_mask(cc.MaskType.矩形, size=0.9, rect_width=0.9, round_corner=14)
    for tt, z, r in ((0, 1.30, 10 * yon), (0.6, 1.0, 0), (sure, 1.04, 0)):
        s.add_keyframe(cc.KeyframeProperty.uniform_scale, us(tt), olcek * z)
        s.add_keyframe(cc.KeyframeProperty.rotation, us(tt), r)
    s.add_animation(cc.IntroType.模糊渐显, duration="0.5s")
    proje.add_segment(s, "kart")


def yazi(metin, bas, sure, iz, *, boyut=12.0, renk=KOMUR, x=0.0, y=-0.62, font=cc.FontType.Montserrat,
         kalin=False, saydam=1.0, giris=cc.TextIntro.渐显, giris_sure="0.4s", cikis=True, arka=None, kenar=None):
    ts = cc.TextSegment(metin, cc.Timerange(us(bas), us(bas + sure) - us(bas)), font=font,
                        style=cc.TextStyle(size=boyut, bold=kalin, color=renk, alpha=saydam, align=1),
                        clip_settings=cc.ClipSettings(transform_x=x, transform_y=y), background=arka, border=kenar)
    if giris:
        ts.add_animation(giris, duration=giris_sure)
    if cikis:
        ts.add_animation(cc.TextOutro.渐隐, duration="0.25s")
    proje.add_segment(ts, iz)


kutu = lambda: cc.TextBackground(color=KUTU, alpha=1.0, round_radius=0.25)


def sahne(ad_, dosya, kelime, aciklama, *, kaynak=None, hiz=1.0, dx=0.35, dy=0.30, yon=1):
    a, b = T[ad_]
    daire(ad_, dx, dy)
    kart(ad_, dosya, kaynak=kaynak, hiz=hiz, yon=yon)
    # dev çizgili kelime (silik, kartın arkasında)
    yazi(kelime, a, b - a, "dev", boyut=40.0, font=cc.FontType.BebasNeue, y=0.80, saydam=0.20, renk=BEYAZ,
         kenar=cc.TextBorder(color=GRI, width=18.0), giris=cc.TextIntro.渐显, giris_sure="0.6s", cikis=False)
    # koyu kutu içinde kelime kayarak gelir, açıklama altında, çizgi süs üstte
    yazi(f" {kelime} ", a + 0.25, b - a - 0.4, "t1", boyut=17.0, renk=BEYAZ, font=cc.FontType.BebasNeue,
         y=-0.58, giris=cc.TextIntro.向右滑动, arka=kutu())
    yazi(aciklama, a + 0.25 + 15 / 30, b - a - 0.4 - 0.5, "t2", boyut=10.5, kalin=True, y=-0.71,
         giris=cc.TextIntro.打字机, giris_sure="0.5s")
    yazi("— — —", a + 0.1, b - a - 0.3, "t3", boyut=8.0, renk=GRI, x=-0.30, y=-0.48, giris=cc.TextIntro.向右滑动)


# ---- 1. Kanca: metin merkezli + salon kartı ----
a, b = T["kanca"]
daire("kanca", -0.30, 0.35)
kart("kanca", V(1), kaynak=0.3, hiz=0.6, yon=-1)
yazi("YENİ", a, b - a, "dev", boyut=48.0, font=cc.FontType.BebasNeue, y=0.80, saydam=0.20, renk=BEYAZ,
     kenar=cc.TextBorder(color=GRI, width=18.0), cikis=False)
yazi("BALKONA AÇILAN", a + 0.2, b - a - 0.3, "t1", boyut=18.0, font=cc.FontType.BebasNeue, y=-0.56,
     giris=cc.TextIntro.向上滑动)
yazi(" SALON ", a + 0.2 + B, b - a - 0.3 - B, "t2", boyut=18.0, renk=BEYAZ, font=cc.FontType.BebasNeue,
     y=-0.70, giris=cc.TextIntro.向右滑动, arka=kutu())

# ---- 2–6. Oda sahneleri (tezgahsız mutfak yok) ----
sahne("salon",  F("salon.jpg"),  "SALON",  "Gün ışığı alan yaşam alanı", dx=0.32, dy=0.32, yon=1)
sahne("hol",    V(5),            "HOL",    "Odaları bağlayan geniş hol", kaynak=0.8, hiz=0.8, dx=-0.32, dy=0.28, yon=-1)
sahne("oda",    V(3),            "ODA",    "Geniş pencereli",            kaynak=0.5, hiz=0.6, dx=0.30, dy=-0.10, yon=1)
sahne("banyo",  F("banyo.jpg"),  "BANYO",  "Cam duşakabin",              dx=-0.30, dy=-0.12, yon=-1)
sahne("balkon", V(6),            "BALKON", "Şehre bakan manzara",        kaynak=0.0, hiz=0.7, dx=0.32, dy=0.36, yon=1)

# ---- 7. Bilgi: metin merkezli (kart yok), ızgara %10 ----
a, b = T["bilgi"]
seg(OV("izgara.png"), a, b - a, "izgara", alpha=0.10).set_mix_mode(cc.MixModeType.正片叠底)
d = seg(OV("daire_koyu.png"), a, b - a, "daire", alpha=0.9, transform_y=0.12)
d.add_keyframe(cc.KeyframeProperty.uniform_scale, 0, 0.3)
d.add_keyframe(cc.KeyframeProperty.uniform_scale, us(0.9), 0.95)
yazi(ILAN["oda"], a, b - a, "dev", boyut=70.0, font=cc.FontType.BebasNeue, y=0.12, saydam=0.20, renk=BEYAZ,
     kenar=cc.TextBorder(color=GRI, width=18.0), cikis=False)
yazi(ILAN["m2"], a + 0.2, b - a - 0.3, "t1", boyut=30.0, renk=BEYAZ, font=cc.FontType.BebasNeue, y=0.12,
     giris=cc.TextIntro.弹出)
yazi(f" {ILAN['kat']} ", a + 0.2 + B, b - a - 0.3 - B, "t2", boyut=12.0, renk=BEYAZ, kalin=True, x=-0.28, y=-0.30,
     giris=cc.TextIntro.向右滑动, arka=kutu())
yazi(f" {ILAN['bina']} ", a + 0.2 + 2 * B, b - a - 0.3 - 2 * B, "t3", boyut=12.0, renk=BEYAZ, kalin=True, x=0.26,
     y=-0.30, giris=cc.TextIntro.向左滑动, arka=kutu())
yazi(ILAN["fiyat"], a + 0.2 + 3 * B, b - a - 0.3 - 3 * B, "t4", boyut=20.0, renk=ALTIN, font=cc.FontType.BebasNeue,
     y=-0.48, giris=cc.TextIntro.向上弹入)
yazi("— — —", a + 0.1, b - a - 0.2, "t5", boyut=8.0, renk=GRI, y=0.55, giris=cc.TextIntro.向右滑动)

# ---- 8. Kapanış: logo kartı + çağrı + telefon (büyük) ----
a, _ = T["kapanis"]
daire("kapanis", 0, 0.22)
lg = seg(LOGO, a, SON - a, "kart", scale_x=0.80, scale_y=0.80, transform_y=0.22)
lg.add_mask(cc.MaskType.矩形, size=0.62, rect_width=0.96, round_corner=12)
lg.add_animation(cc.IntroType.模糊渐显, duration="0.5s")
yazi("YERİNDE GÖRÜN", a + 0.4, SON - a - 0.5, "t1", boyut=18.0, font=cc.FontType.BebasNeue, y=-0.30,
     giris=cc.TextIntro.向上滑动, cikis=False)
yazi(f" {ILAN['tel']} ", a + 0.8, SON - a - 0.9, "t2", boyut=13.0, renk=BEYAZ, kalin=True, y=-0.44,
     giris=cc.TextIntro.打字机, giris_sure="0.6s", cikis=False, arka=kutu())

# ---- Ses: müzik + az efekt (minimal) ----
proje.add_segment(cc.AudioSegment(MUZIK, trange("0s", f"{SON:.3f}s"), source_timerange=trange("4s", f"{SON:.3f}s"),
                                  volume=0.8).add_fade("0.4s", "1.5s"), "muzik")
for ad_, dosya, ses in (("salon", "whoosh.wav", 0.3), ("oda", "whoosh.wav", 0.3), ("balkon", "whoosh.wav", 0.3),
                        ("bilgi", "impact.wav", 0.5), ("kapanis", "impact.wav", 0.7)):
    s0 = max(T[ad_][0] - 0.15, 0)
    proje.add_segment(cc.AudioSegment(os.path.join(SES, dosya), trange(f"{s0:.3f}s", "0.7s"), volume=ses), "sfx")

print(f"süre {SON:.1f} sn; " + ", ".join(f"{k} {v[0]:.1f}" for k, v in T.items()))
print("kaydedildi:", kaydet(proje, "ilan-minimal2", araya={"dev": "daire"}))   # dev kelime dairenin arkasında
