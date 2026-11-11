# Şablon 2 — "Aydınlık daire turu" → CapCut projesi "ilan-daire"
# Şablon 1'den (tanitim_marka.py: karanlık, sinematik, video ağırlıklı) farkı:
#  - Aydınlık, sıcak görünüm; yeni/boş daireler ve fotoğraf ağırlıklı çekimler için
#  - Oda oda bölümler (GİRİŞ / SALON / MUTFAK / YATAK ODALARI / BANYO / BALKON), büyük oda başlıkları
#  - Kolaj sahneleri: 3 yatay fotoğraf şerit halinde vuruşlarla kayarak gelir; yatak odaları bölünmüş ekran
#  - Işık sızmasıyla kesim (Davinci: "kesimi ışık ekranı kapladığında yap"), yumuşak yaklaşmalar
# Kaynak: Davinci — "How I Turned Simple Images Into Cinematic Scenes with CapCut"
#   (https://www.youtube.com/watch?v=c_-rCfqk2vk): ışık katmanları ekran modunda, ışıkla kesim,
#   katmanların ayrı ayrı canlandırılması, sıcak ton ayarı.
# Medya hazırlığı: capcut/medya2/ (fotoğraflardan 9:16 tam kadraj, 1080x640 şerit, 1080x960 yarım;
#   videolar gerçek dik 1080x1920 kopya) — kaynak: gerçek_veri_2/
# Çalıştır: .venv-capcut\Scripts\python.exe -X utf8 capcut\tanitim_daire.py
import os
import pycapcut as cc
from pycapcut import trange, SEC
from taslak import kaydet

# ---- İlan bilgileri (MOCK — gerçek ilanla değiştir) ----
ILAN = {
    "tur": "SATILIK 3+1",
    "m2": "145 m²",
    "kat": "5. Kat",
    "bina": "Sıfır bina",
    "konum": "Konum: XXXXX",
    "fiyat": "X.XXX.XXX TL",
    "tel": "0 (5XX) XXX XX XX",
}

KOK = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
M = lambda ad: os.path.join(KOK, "capcut", "medya2", ad)
SES = os.path.join(KOK, "hyperframes", "ilan", "assets")
MUZIK = os.path.join(KOK, "muzik", "luxury-real-estate.mp3")
LOGO = os.path.join(KOK, "marka", "inza-logo.jpg")

B = 0.4497
vurus = lambda k: 0.045 + k * B
us = lambda s: int(round(s * SEC))
ALTIN = (0.95, 0.71, 0.15)
LACIVERT = "#16213E"
BEYAZ = (1, 1, 1)

proje = cc.ScriptFile(1080, 1920)
for ad in ("ana", "k1", "k2", "k3", "logo", "isik"):
    proje.add_track(cc.TrackType.video, ad)
proje.add_track(cc.TrackType.audio, "muzik").add_track(cc.TrackType.audio, "sfx").add_track(cc.TrackType.audio, "sfx2")
for ad in ("t1", "t2", "t3", "t4", "t5"):
    proje.add_track(cc.TrackType.text, ad)
proje.add_track(cc.TrackType.effect, "overlay").add_track(cc.TrackType.filter)

# ---- Bölümler (vuruş sayıları) ----
bolum_vurus = [("acilis", 6), ("giris", 3), ("salon", 5), ("mutfak", 6), ("odalar", 4), ("banyo", 3),
               ("balkon", 5), ("bilgi", 6), ("kapanis", 6)]
T = {}
k = 0
for ad, n in bolum_vurus:
    T[ad] = (0.0 if k == 0 else vurus(k), vurus(k + n))
    k += n
SON = T["kapanis"][1] + 0.4
T["kapanis"] = (T["kapanis"][0], SON)


def klip(dosya, bas, bit, iz="ana", *, kaynak=None, hiz=1.0, z=(1.0, 1.0), olcek=1.0, y=0.0, x=0.0,
         giris=None, cikis=None, gecis=None):
    """Görsel/video klip; z: başlangıç→bitiş yaklaşma çarpanı (merkezde)."""
    sure = bit - bas
    st = trange(f"{kaynak}s", f"{sure * hiz:.4f}s") if kaynak is not None else None
    seg = cc.VideoSegment(dosya, trange(f"{bas:.4f}s", f"{sure:.4f}s"), source_timerange=st,
                          clip_settings=cc.ClipSettings(transform_x=x, transform_y=y))
    for tt, zz in ((0, z[0]), (sure, z[1])):
        seg.add_keyframe(cc.KeyframeProperty.uniform_scale, us(tt), olcek * zz)
    if giris:
        seg.add_animation(giris, duration="0.4s")
    if cikis:
        seg.add_animation(cikis, duration="0.3s")
    if gecis:
        seg.add_transition(gecis, duration="0.45s")
    proje.add_segment(seg, iz)
    return seg


# ---- Ana iz ----
a, b = T["acilis"];  klip(M("video11.mp4"), a, b, kaynak=0.0, hiz=0.6, z=(1.0, 1.1), gecis=cc.TransitionType.推近)
a, b = T["giris"];   klip(M("koridor.jpg"), a, b, z=(1.0, 1.25), gecis=cc.TransitionType.左移)
a, b = T["salon"];   klip(M("video5.mp4"), a, b, kaynak=0.0, hiz=0.7, z=(1.0, 1.05))
a, b = T["mutfak"];  klip(M("mutfak2.jpg"), a, b, olcek=3.0)                     # kolajın arkası
a, b = T["odalar"];  klip(M("oda1.jpg"), a, b, olcek=2.0, gecis=cc.TransitionType.叠化)
a, b = T["banyo"];   klip(M("banyo.jpg"), a, b, z=(1.0, 1.12))
a, b = T["balkon"];  klip(M("video6.mp4"), a, b, kaynak=0.0, hiz=0.8, z=(1.0, 1.05), gecis=cc.TransitionType.渐变擦除)
a, _ = T["bilgi"];   klip(M("manzara.jpg"), a, SON, z=(1.0, 1.18))

# ---- Kolaj: mutfak şeritleri vuruşlarla soldan/sağdan kayar (3 x 1080x640 = tam ekran) ----
a, b = T["mutfak"]
for i, (dosya, iz, y, anim) in enumerate([("mutfak1.jpg", "k1", 0.6667, cc.IntroType.向右滑动),
                                          ("mutfak2.jpg", "k2", 0.0, cc.IntroType.向左滑动),
                                          ("mutfak3.jpg", "k3", -0.6667, cc.IntroType.向右滑动)]):
    klip(M(dosya), a + i * B, b, iz, y=y, z=(1.0, 1.04), giris=anim)

# ---- Bölünmüş ekran: yatak odaları (2 x 1080x960) ----
a, b = T["odalar"]
klip(M("oda1.jpg"), a, b, "k1", y=0.5, z=(1.0, 1.05), giris=cc.IntroType.向下滑动)
klip(M("oda2.jpg"), a + B, b, "k2", y=-0.5, z=(1.05, 1.0), giris=cc.IntroType.向上滑动)

# ---- Logo: açılışta büyük, turda köşe filigranı, kapanışta büyük (siyah zemin ekran moduyla kalkar) ----
def logo(bas, sure, olcek, x, y, *, giris=None, cikis=None, saydam=1.0):
    s = cc.VideoSegment(LOGO, trange(f"{bas:.3f}s", f"{sure:.3f}s"),
                        clip_settings=cc.ClipSettings(scale_x=olcek, scale_y=olcek, transform_x=x, transform_y=y,
                                                      alpha=saydam))
    s.set_mix_mode(cc.MixModeType.滤色)
    if giris:
        s.add_animation(giris, duration="0.5s")
    if cikis:
        s.add_animation(cikis, duration="0.35s")
    proje.add_segment(s, "logo")

a, b = T["acilis"]
logo(0.2, b - 0.2, 0.85, 0, 0.35, giris=cc.IntroType.模糊渐显, cikis=cc.OutroType.渐隐)
logo(T["giris"][0], T["bilgi"][0] - T["giris"][0], 0.24, 0.66, 0.80, saydam=0.9)
a, _ = T["kapanis"]
logo(a, SON - a, 0.85, 0, 0.32, giris=cc.IntroType.动感缩小)

# ---- Efektler: aydınlık/sıcak görünüm, ışık sızmasıyla balkon kesimi ----
proje.add_effect(cc.VideoSceneEffectType.渐显开幕, trange("0s", "0.8s"), track_name="overlay")
# Balkon kesimi ışıkla (Pro 散景漏光 yerine kendi overlay'imiz, ekran modunda)
_isik = cc.VideoSegment(os.path.join(KOK, "varliklar", "overlay", "isik_supurme_altin.mp4"),
                        trange(f"{T['banyo'][1] - 0.6:.3f}s", "1.6s"), clip_settings=cc.ClipSettings(alpha=0.8))
_isik.set_mix_mode(cc.MixModeType.滤色)
proje.add_segment(_isik, "isik")
proje.add_effect(cc.VideoSceneEffectType.渐隐闭幕, trange(f"{SON - 1.0:.3f}s", "1.0s"), track_name="overlay")
proje.add_filter(cc.FilterType.暖黄,trange("0s", f"{SON:.3f}s"), intensity=50)

# ---- Ses ----
proje.add_segment(cc.AudioSegment(MUZIK, trange("0s", f"{SON:.3f}s"), source_timerange=trange("4s", f"{SON:.3f}s"),
                                  volume=0.85).add_fade("0.3s", "1.5s"), "muzik")
sfx = [(T["giris"][0] - 0.2, "whoosh.wav", 0.6), (T["salon"][0] - 0.2, "whoosh.wav", 0.5),
       (T["odalar"][0] - 0.15, "whoosh.wav", 0.6), (T["balkon"][0] - 0.3, "whoosh.wav", 0.5),
       (T["bilgi"][0] - 0.2, "whoosh.wav", 0.5),
       (0.0, "impact.wav", 0.9), (T["kapanis"][0], "impact.wav", 0.9)]
sfx += [(T["mutfak"][0] + i * B - 0.15, "whoosh.wav", 0.45) for i in range(3)]
for i, (bas, dosya, ses) in enumerate(sorted(sfx)):    # art arda gelenler iki iz arasında dönüşümlü (üst üste binmesin)
    proje.add_segment(cc.AudioSegment(os.path.join(SES, dosya), trange(f"{max(bas, 0):.3f}s", "0.7s"), volume=ses),
                      ("sfx", "sfx2")[i % 2])

# ---- Yazılar ----
def yazi(metin, bas, sure, iz, *, boyut=9.0, renk=BEYAZ, x=0.0, y=-0.45, font=cc.FontType.Montserrat,
         kalin=False, giris=None, cikis=cc.TextOutro.渐隐, arka=None, giris_sure="0.45s"):
    t = cc.TextSegment(metin, trange(f"{bas:.3f}s", f"{sure:.3f}s"), font=font,
                       style=cc.TextStyle(size=boyut, bold=kalin, color=renk, align=1),
                       clip_settings=cc.ClipSettings(transform_x=x, transform_y=y),
                       shadow=cc.TextShadow(alpha=0.6, color=(0, 0, 0)), background=arka)
    if giris:
        t.add_animation(giris, duration=giris_sure)
    if cikis:
        t.add_animation(cikis, duration="0.25s")
    proje.add_segment(t, iz)

kart = lambda saydam=0.85: cc.TextBackground(color=LACIVERT, alpha=saydam, round_radius=0.35)

def oda_basligi(ad_, baslik, alt, y=0.55, giris=cc.TextIntro.向上滑动, alt_giris=cc.TextIntro.渐显):
    a, b = T[ad_]
    yazi(baslik, a + 0.15, b - a - 0.3, "t1", boyut=13.0, font=cc.FontType.BebasNeue, y=y, giris=giris)
    if alt:
        yazi(alt, a + 0.15 + B, b - a - 0.3 - B, "t2", boyut=5.5, renk=ALTIN, kalin=True, y=y - 0.09,
             giris=alt_giris)

# Açılış: tür + başlık
a, b = T["acilis"]
yazi(ILAN["tur"], a + 2 * B, b - a - 2 * B - 0.1, "t1", boyut=12.0, font=cc.FontType.BebasNeue, y=-0.30,
     giris=cc.TextIntro.逐字)
yazi(ILAN["bina"], a + 3 * B, b - a - 3 * B - 0.1, "t2", boyut=6.0, renk=ALTIN, kalin=True, y=-0.42,
     giris=cc.TextIntro.渐显)

oda_basligi("giris", "HOŞ GELDİNİZ", None, y=-0.40, giris=cc.TextIntro.打字机)
oda_basligi("salon", "SALON", "Gün ışığı alan ferah yaşam alanı", y=-0.40, giris=cc.TextIntro.向右滑动)
# Kolajda başlık ortadaki şeridin üstünde, lacivert kartla
a, b = T["mutfak"]
yazi("MUTFAK", a + 3 * B, b - a - 3 * B - 0.1, "t1", boyut=11.0, font=cc.FontType.BebasNeue, y=0.0,
     giris=cc.TextIntro.弹出, arka=kart())
a, b = T["odalar"]
yazi("YATAK ODALARI", a + 2 * B, b - a - 2 * B - 0.1, "t1", boyut=10.0, font=cc.FontType.BebasNeue, y=0.0,
     giris=cc.TextIntro.向左模糊, arka=kart())
oda_basligi("banyo", "BANYO", "Cam duşakabin", y=0.55, giris=cc.TextIntro.渐显)
oda_basligi("balkon", "BALKON", "Açık manzara", y=-0.40, giris=cc.TextIntro.向上弹入)

# Bilgi kartları: vuruşlarla tek tek, sağdan
a, b = T["bilgi"]
for i, anahtar in enumerate(("m2", "kat", "konum")):
    bas = a + 0.3 + i * B
    yazi(ILAN[anahtar], bas, b - bas - 0.1, ("t1", "t2", "t3")[i], boyut=8.0, x=0.2, y=0.15 - i * 0.13,
         kalin=True, giris=cc.TextIntro.向左滑动, giris_sure="0.35s", arka=kart())
bas = a + 0.3 + 3 * B
yazi(ILAN["fiyat"], bas, b - bas - 0.1, "t4", boyut=11.0, renk=ALTIN, font=cc.FontType.BebasNeue, x=0.15, y=-0.30,
     giris=cc.TextIntro.弹出, giris_sure="0.4s", arka=kart(0.9))

# Kapanış: logo + çağrı + telefon
a, _ = T["kapanis"]
yazi("YENİ EVİNİZ HAZIR", a + 0.3, SON - a - 0.5, "t1", boyut=11.0, font=cc.FontType.BebasNeue, y=-0.12,
     giris=cc.TextIntro.向上滑动, cikis=None)
yazi("Hemen arayın", a + 0.8, SON - a - 1.0, "t2", boyut=6.0, renk=(0.08, 0.08, 0.08), kalin=True, y=-0.28,
     giris=cc.TextIntro.向上弹入, cikis=None, arka=cc.TextBackground(color="#F2B526", alpha=1.0, round_radius=0.3))
yazi(ILAN["tel"], a + 1.1, SON - a - 1.3, "t3", boyut=8.0, kalin=True, y=-0.42, giris=cc.TextIntro.打字机, cikis=None)

print(f"süre {SON:.1f} sn; bölümler: " + ", ".join(f"{k} {v[0]:.1f}" for k, v in T.items()))
print("kaydedildi:", kaydet(proje, "ilan-daire"))
