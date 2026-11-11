# Şablon 3 — "Minimal editoryal" → CapCut projesi "ilan-minimal"
# Şablon 1 (sinematik, karanlık, tam ekran video) ve şablon 2'den (aydınlık oda turu, tam ekran kolaj)
# tamamen farklı: kırık beyaz zemin, ortada tek nesne (yuvarlak köşeli foto/video kartı + yumuşak gölge),
# arkada dev ve silik oda kelimesi, koyu kalın ana yazı + italik vurgu + küçük dekoratif yazılar,
# polaroid yığını, son bölümde yazı merkezli kompozisyon (dev "3+1" etrafında bilgiler).
# Kaynak: Zeven 7 — "How to Make Viral Minimal Reel Edits in CapCut"
#   (https://www.youtube.com/watch?v=MJHpo7pOaLg): beyaz zemin + hafif gölge/ızgara, nesne/yazı merkezli
#   kompozisyon, büyük silik arka yazı, bulanıktan netleşen yumuşak girişler, "abartma".
# Medya: capcut/medya3/ (zemin, gölge, polaroidler, 9:16 kadrajlar) + capcut/medya2/ — kaynak gerçek_veri_2/
# Çalıştır: .venv-capcut\Scripts\python.exe -X utf8 capcut\tanitim_minimal.py
import os
import pycapcut as cc
from pycapcut import trange, SEC
from taslak import kaydet

# ---- İlan bilgileri (MOCK — gerçek ilanla değiştir) ----
ILAN = {
    "tur": "SATILIK",
    "oda": "3+1",
    "m2": "145 m²",
    "kat": "5. KAT",
    "bina": "SIFIR BİNA",
    "konum": "Konum: XXXXX",
    "fiyat": "X.XXX.XXX TL",
    "tel": "0 (5XX) XXX XX XX",
}

KOK = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
M2 = lambda ad: os.path.join(KOK, "capcut", "medya2", ad)
M3 = lambda ad: os.path.join(KOK, "capcut", "medya3", ad)
SES = os.path.join(KOK, "hyperframes", "ilan", "assets")
MUZIK = os.path.join(KOK, "muzik", "luxury-real-estate.mp3")
LOGO = os.path.join(KOK, "marka", "inza-logo.jpg")

B = 0.4497
vurus = lambda k: 0.045 + k * B
us = lambda s: int(round(s * SEC))
KOMUR = (0.13, 0.13, 0.15)
ALTIN = (0.78, 0.57, 0.12)       # beyaz zeminde okunan koyu altın
BEYAZ = (1, 1, 1)

proje = cc.ScriptFile(1080, 1920)
for ad in ("zemin", "golge", "kart", "p1", "p2", "p3", "p4"):
    proje.add_track(cc.TrackType.video, ad)
proje.add_track(cc.TrackType.audio, "muzik").add_track(cc.TrackType.audio, "sfx").add_track(cc.TrackType.audio, "sfx2")
for ad in ("dev", "t1", "t2", "t3", "t4", "t5", "t6"):
    proje.add_track(cc.TrackType.text, ad)

bolum_vurus = [("kanca", 5), ("polaroid", 6), ("salon", 3), ("mutfak", 3), ("oda", 3), ("banyo", 3),
               ("balkon", 4), ("bilgi", 6), ("kapanis", 5)]
T, k = {}, 0
for ad, n in bolum_vurus:
    T[ad] = (0.0 if k == 0 else vurus(k), vurus(k + n))
    k += n
SON = T["kapanis"][1] + 0.4
T["kapanis"] = (T["kapanis"][0], SON)

# Zemin tüm video boyunca
proje.add_segment(cc.VideoSegment(M3("zemin.png"), trange("0s", f"{SON:.3f}s")), "zemin")


def kart(dosya, ad_, *, kaynak=None, hiz=1.0, giris=None, rot=(0.0, 0.0), y=0.08, olcek=0.62):
    """Ortada yuvarlak köşeli kart + altında yumuşak gölge; hafif yaklaşma ve dönme."""
    a, b = T[ad_]
    sure = b - a
    st = trange(f"{kaynak}s", f"{sure * hiz:.4f}s") if kaynak is not None else None
    g = cc.VideoSegment(M3("golge.png"), trange(f"{a:.4f}s", f"{sure:.4f}s"),
                        clip_settings=cc.ClipSettings(scale_x=0.8, scale_y=0.8, transform_y=y - 0.03, alpha=0.6))
    if giris:
        g.add_animation(cc.IntroType.渐显, duration="0.4s")
    proje.add_segment(g, "golge")
    s = cc.VideoSegment(dosya, trange(f"{a:.4f}s", f"{sure:.4f}s"), source_timerange=st,
                        clip_settings=cc.ClipSettings(transform_y=y))
    s.add_mask(cc.MaskType.矩形, size=0.9, rect_width=0.9, round_corner=12)
    for tt, z, r in ((0, 1.0, rot[0]), (sure, 1.05, rot[1])):
        s.add_keyframe(cc.KeyframeProperty.uniform_scale, us(tt), olcek * z)
        s.add_keyframe(cc.KeyframeProperty.rotation, us(tt), r)
    if giris:
        s.add_animation(giris, duration="0.45s")
    proje.add_segment(s, "kart")


def yazi(metin, bas, sure, iz, *, boyut=9.0, renk=KOMUR, x=0.0, y=-0.6, font=cc.FontType.Montserrat,
         kalin=False, italik=False, saydam=1.0, giris=None, cikis=cc.TextOutro.渐隐, arka=None, giris_sure="0.45s"):
    t = cc.TextSegment(metin, trange(f"{bas:.3f}s", f"{sure:.3f}s"), font=font,
                       style=cc.TextStyle(size=boyut, bold=kalin, italic=italik, color=renk, alpha=saydam, align=1),
                       clip_settings=cc.ClipSettings(transform_x=x, transform_y=y), background=arka)
    if giris:
        t.add_animation(giris, duration=giris_sure)
    if cikis:
        t.add_animation(cikis, duration="0.25s")
    proje.add_segment(t, iz)


def dev_kelime(metin, ad_, y=0.80):
    """Kartın arkasında/üstünde dev, silik oda kelimesi."""
    a, b = T[ad_]
    yazi(metin, a, b - a, "dev", boyut=34.0, font=cc.FontType.BebasNeue, y=y, saydam=0.08,
         giris=cc.TextIntro.渐显, giris_sure="0.6s", cikis=None)


def bolum_yazisi(ad_, ana, alt, giris):
    a, b = T[ad_]
    yazi(ana, a + 0.2, b - a - 0.35, "t1", boyut=11.0, font=cc.FontType.BebasNeue, y=-0.64, giris=giris)
    yazi(alt, a + 0.2 + B, b - a - 0.35 - B, "t2", boyut=5.0, renk=ALTIN, italik=True, y=-0.75,
         font=cc.FontType.PlayfairDisplay_Italic, giris=cc.TextIntro.渐显)


# ---- 1. Kanca: manzara kartı bulanıktan netleşir ----
kart(M2("manzara.jpg"), "kanca", giris=cc.IntroType.模糊渐显, rot=(-2.0, 0.0))
dev_kelime("YENİ", "kanca")
a, b = T["kanca"]
yazi("ŞEHRE BAKAN", a + B, b - a - B - 0.1, "t1", boyut=12.0, font=cc.FontType.BebasNeue, y=-0.62,
     giris=cc.TextIntro.向上滑动)
yazi("yeni eviniz", a + 2 * B, b - a - 2 * B - 0.1, "t2", boyut=8.0, renk=ALTIN, italik=True,
     font=cc.FontType.PlayfairDisplay_Italic, y=-0.74, giris=cc.TextIntro.渐显)
yazi(f"{ILAN['tur']}  ·  {ILAN['oda']}  ·  {ILAN['bina']}", a + 0.3, b - a - 0.4, "t3", boyut=3.6,
     y=0.90, giris=cc.TextIntro.打字机, giris_sure="0.8s")

# ---- 2. Polaroid yığını: her vuruşta bir fotoğraf düşer, farklı açılarla üst üste ----
a, b = T["polaroid"]
dev_kelime("HER KÖŞE", "polaroid", y=0.82)
polaroidler = [("pol_salon.png", "p1", -0.18, 0.30, -8, cc.IntroType.向下滑动),
               ("pol_mutfak.png", "p2", 0.16, 0.12, 6, cc.IntroType.向下滑动),
               ("pol_oda.png", "p3", -0.12, -0.08, -3, cc.IntroType.放大),
               ("pol_banyo.png", "p4", 0.14, -0.26, 5, cc.IntroType.向下滑动)]
for i, (dosya, iz, x, y, r, anim) in enumerate(polaroidler):
    bas = a + 0.1 + i * B
    s = cc.VideoSegment(M3(dosya), trange(f"{bas:.4f}s", f"{b - bas:.4f}s"),
                        clip_settings=cc.ClipSettings(scale_x=0.58, scale_y=0.58, transform_x=x, transform_y=y,
                                                      rotation=r))
    s.add_animation(anim, duration="0.3s")
    proje.add_segment(s, iz)
yazi("her köşesi yepyeni", a + 4 * B + 0.1, b - a - 4 * B - 0.2, "t2", boyut=8.0, renk=ALTIN, italik=True,
     font=cc.FontType.PlayfairDisplay_Italic, y=-0.80, giris=cc.TextIntro.渐显)

# ---- 3–7. Oda kartları: her biri farklı giriş, arkada dev oda kelimesi ----
oda_kartlari = [
    ("salon",  M2("video5.mp4"), 0.0, 0.7, cc.IntroType.模糊渐显,  (-1.5, 0.5), "SALON",  "Gün ışığı alan yaşam alanı", cc.TextIntro.向上滑动),
    ("mutfak", M3("mutfak.jpg"), None, 1.0, cc.IntroType.向上滑动, (1.0, -0.5), "MUTFAK", "Salona açılan mutfak",        cc.TextIntro.向右滑动),
    ("oda",    M3("oda.jpg"),    None, 1.0, cc.IntroType.向右转入, (-1.0, 0.8), "YATAK ODASI", "Geniş pencereli",         cc.TextIntro.打字机),
    ("banyo",  M2("banyo.jpg"),  None, 1.0, cc.IntroType.放大,     (0.5, -1.0), "BANYO",  "Cam duşakabin",              cc.TextIntro.弹出),
    ("balkon", M2("video6.mp4"), 0.0, 0.8, cc.IntroType.向左滑动, (-1.0, 1.0), "BALKON", "Açık manzara",               cc.TextIntro.向左模糊),
]
for ad_, dosya, kaynak, hiz, giris, rot, ana, alt, ygiris in oda_kartlari:
    kart(dosya, ad_, kaynak=kaynak, hiz=hiz, giris=giris, rot=rot)
    dev_kelime(ana, ad_)
    bolum_yazisi(ad_, ana, alt, ygiris)

# ---- 8. Yazı merkezli bilgi kompozisyonu (kart yok) ----
a, b = T["bilgi"]
yazi(ILAN["oda"], a, b - a, "dev", boyut=60.0, font=cc.FontType.BebasNeue, y=0.15, saydam=0.08,
     giris=cc.TextIntro.渐显, giris_sure="0.6s", cikis=None)
yazi(ILAN["m2"], a + 0.2, b - a - 0.3, "t1", boyut=24.0, font=cc.FontType.BebasNeue, y=0.12, kalin=True,
     giris=cc.TextIntro.弹出, giris_sure="0.4s")
yazi(ILAN["kat"], a + 0.2 + B, b - a - 0.3 - B, "t2", boyut=6.0, x=-0.32, y=0.42, kalin=True,
     giris=cc.TextIntro.向右滑动)
yazi(ILAN["bina"], a + 0.2 + 2 * B, b - a - 0.3 - 2 * B, "t3", boyut=6.0, x=0.30, y=0.42, kalin=True,
     giris=cc.TextIntro.向左滑动)
yazi(ILAN["konum"], a + 0.2 + 3 * B, b - a - 0.3 - 3 * B, "t4", boyut=6.0, renk=ALTIN, italik=True,
     font=cc.FontType.PlayfairDisplay_Italic, y=-0.12, giris=cc.TextIntro.渐显)
yazi(f"  {ILAN['fiyat']}  ", a + 0.2 + 4 * B, b - a - 0.3 - 4 * B, "t5", boyut=9.0, renk=BEYAZ,
     font=cc.FontType.BebasNeue, y=-0.34, giris=cc.TextIntro.向上弹入,
     arka=cc.TextBackground(color="#212126", alpha=1.0, round_radius=0.5))

# ---- 9. Kapanış: logo kartı (siyah zeminli logo yuvarlak köşeli kart olur) + çağrı ----
a, _ = T["kapanis"]
lg = cc.VideoSegment(LOGO, trange(f"{a:.4f}s", f"{SON - a:.4f}s"),
                     clip_settings=cc.ClipSettings(scale_x=0.78, scale_y=0.78, transform_y=0.22))
lg.add_mask(cc.MaskType.矩形, size=0.62, rect_width=0.96, round_corner=10)
lg.add_animation(cc.IntroType.模糊渐显, duration="0.5s")
proje.add_segment(lg, "kart")
yazi("Randevu için", a + 0.6, SON - a - 0.8, "t1", boyut=7.0, renk=ALTIN, italik=True,
     font=cc.FontType.PlayfairDisplay_Italic, y=-0.30, giris=cc.TextIntro.渐显, cikis=None)
yazi(ILAN["tel"], a + 0.9, SON - a - 1.1, "t2", boyut=9.0, font=cc.FontType.BebasNeue, y=-0.42,
     giris=cc.TextIntro.打字机, cikis=None)
yazi("  HEMEN ARAYIN  ", a + 1.3, SON - a - 1.5, "t3", boyut=5.5, renk=BEYAZ, kalin=True, y=-0.56,
     giris=cc.TextIntro.向上弹入, cikis=None, arka=cc.TextBackground(color="#212126", alpha=1.0, round_radius=0.5))

# ---- Ses: müzik + hafif efektler (minimal: abartma) ----
proje.add_segment(cc.AudioSegment(MUZIK, trange("0s", f"{SON:.3f}s"), source_timerange=trange("4s", f"{SON:.3f}s"),
                                  volume=0.8).add_fade("0.5s", "1.5s"), "muzik")
sfx = [(T["polaroid"][0] + 0.1 + i * B - 0.1, "whoosh.wav", 0.35) for i in range(4)]
sfx += [(T[ad_][0] - 0.15, "whoosh.wav", 0.3) for ad_ in ("salon", "oda", "balkon")]
sfx += [(T["bilgi"][0], "impact.wav", 0.6), (T["kapanis"][0], "impact.wav", 0.8)]
for i, (bas, dosya, ses) in enumerate(sorted(sfx)):
    proje.add_segment(cc.AudioSegment(os.path.join(SES, dosya), trange(f"{max(bas, 0):.3f}s", "0.7s"), volume=ses),
                      ("sfx", "sfx2")[i % 2])

print(f"süre {SON:.1f} sn; bölümler: " + ", ".join(f"{k} {v[0]:.1f}" for k, v in T.items()))
print("kaydedildi:", kaydet(proje, "ilan-minimal", araya={"dev": "golge"}))   # dev kelime kartın ve gölgenin arkasında
