# Şablon 4 — "Mesajlaşma hikâyesi" → CapCut projesi "ilan-sohbet"
# Video bir sohbet gibi akar: müşteri ev arıyor → İNZA "yazıyor…" → cevap + fotoğraf mesajı →
# fotoğraf büyüyüp tam ekrana açılır ve vuruşlu bir tura dönüşür (etiketler de mesaj balonu) →
# sohbete dönülür, bilgi/fiyat mesaj olarak gelir → randevu → logo kartı.
# Platform ilanları mesajlaşma gruplarından topladığı için bu kurgu markaya da uygun.
# Arayüz belirli bir uygulamayı taklit etmez; İNZA renklerinde genel bir sohbet ekranıdır.
# Kaynak: Trevor Jones — "How To Make Text Messages in CapCut" (https://www.youtube.com/watch?v=Z4KPh-aAzsU):
#   gelen mesaj solda / giden sağda, her balon ~0.2 sn aşağıdan kayarak açılır, her mesajda mesaj sesi.
# Medya: capcut/medya4/ (sohbet ekranı, lacivert zemin, mesaj sesleri) + medya2/medya3 — kaynak gerçek_veri_2/
# Çalıştır: .venv-capcut\Scripts\python.exe -X utf8 capcut\tanitim_sohbet.py
import os
import pycapcut as cc
from pycapcut import trange, SEC
from taslak import kaydet

# ---- İlan bilgileri (MOCK — gerçek ilanla değiştir) ----
ILAN = {
    "oda": "3+1",
    "m2": "145 m²",
    "kat": "5. Kat",
    "bina": "Sıfır bina",
    "konum": "Konum: XXXXX",
    "fiyat": "X.XXX.XXX TL",
    "tel": "0 (5XX) XXX XX XX",
}

KOK = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
M2 = lambda ad: os.path.join(KOK, "capcut", "medya2", ad)
M3 = lambda ad: os.path.join(KOK, "capcut", "medya3", ad)
M4 = lambda ad: os.path.join(KOK, "capcut", "medya4", ad)
SES = os.path.join(KOK, "hyperframes", "ilan", "assets")
MUZIK = os.path.join(KOK, "muzik", "luxury-real-estate.mp3")
LOGO = os.path.join(KOK, "marka", "inza-logo.jpg")

B = 0.4497
vurus = lambda k: 0.045 + k * B
us = lambda s: int(round(s * SEC))
KOMUR = (0.13, 0.13, 0.15)
ALTIN = (0.95, 0.71, 0.15)
BEYAZ = (1, 1, 1)
GRI = (0.55, 0.55, 0.58)

proje = cc.ScriptFile(1080, 1920)
for ad in ("ana", "foto", "avatar"):
    proje.add_track(cc.TrackType.video, ad)
for ad in ("muzik", "sfx", "sfx2"):
    proje.add_track(cc.TrackType.audio, ad)
for ad in ("baslik", "durum", "giris", "m1", "m2", "m3", "m4", "m5", "m6"):
    proje.add_track(cc.TrackType.text, ad)

# ---- Zaman çizelgesi ----
TUR_BAS = vurus(15)                       # ≈6.79: fotoğraf tam ekrana açılır, tur başlar
tur = [  # (dosya, vuruş, kaynak, hız, etiket, sonraki geçiş)
    (M2("manzara.jpg"), 3, None, 1.0, "İşte manzaramız", cc.TransitionType.推近),
    (M2("video5.mp4"),  3, 0.0, 0.7,  "Ferah salon",     cc.TransitionType.左移),
    (M3("mutfak.jpg"),  3, None, 1.0, "Salona açılan mutfak", cc.TransitionType.叠化),
    (M3("oda.jpg"),     3, None, 1.0, "Geniş pencereli oda",  cc.TransitionType.竖向模糊),
    (M2("banyo.jpg"),   3, None, 1.0, "Cam duşakabinli banyo", cc.TransitionType.横向模糊),
    (M2("video6.mp4"),  4, 0.0, 0.8,  "Balkondan açık manzara", cc.TransitionType.拉远),
]
TUR_SON = vurus(15 + sum(t[1] for t in tur))   # ≈15.33
KAPANIS = TUR_SON + 4.6                       # sohbet B ≈4.6 sn
SON = KAPANIS + 2.6


def gorsel(dosya, bas, bit, iz="ana", *, kaynak=None, hiz=1.0, z=(1.0, 1.0), gecis=None, **ayar):
    sure = bit - bas
    st = trange(f"{kaynak}s", f"{sure * hiz:.4f}s") if kaynak is not None else None
    s = cc.VideoSegment(dosya, trange(f"{bas:.4f}s", f"{sure:.4f}s"), source_timerange=st,
                        clip_settings=cc.ClipSettings(**ayar) if ayar else None)
    if z != (1.0, 1.0):
        for tt, zz in ((0, z[0]), (sure, z[1])):
            s.add_keyframe(cc.KeyframeProperty.uniform_scale, us(tt), zz)
    if gecis:
        s.add_transition(gecis, duration="0.4s")
    proje.add_segment(s, iz)
    return s


def yazi(metin, bas, bit, iz, *, boyut=5.5, renk=KOMUR, x=0.0, y=0.0, font=cc.FontType.Montserrat, kalin=False,
         hiza=1, giris=None, giris_sure="0.2s", arka=None, cikis=None):
    t = cc.TextSegment(metin, trange(f"{bas:.3f}s", f"{bit - bas:.3f}s"), font=font,
                       style=cc.TextStyle(size=boyut, bold=kalin, color=renk, align=hiza),
                       clip_settings=cc.ClipSettings(transform_x=x, transform_y=y), background=arka)
    if giris:
        t.add_animation(giris, duration=giris_sure)
    if cikis:
        t.add_animation(cikis, duration="0.2s")
    proje.add_segment(t, iz)


sesler = []
def mesaj(metin, bas, bit, iz, y, *, giden=False, boyut=5.5, font=cc.FontType.Montserrat, renk=KOMUR, zemin=None):
    """Sohbet balonu: gelen solda beyaz, giden sağda açık altın; aşağıdan kayarak 0.2 sn'de açılır."""
    zemin = zemin or ("#F6E3B4" if giden else "#FFFFFF")
    yazi(metin, bas, bit, iz, boyut=boyut, renk=renk, font=font, x=0.38 if giden else -0.38, y=y,
         hiza=2 if giden else 0, giris=cc.TextIntro.向上滑动,
         arka=cc.TextBackground(color=zemin, alpha=1.0, round_radius=0.45, height=0.16, width=0.18))
    sesler.append((bas, "giden" if giden else "gelen"))


def sohbet_basligi(bas, bit, durumlar):
    """Lacivert başlık: yuvarlak logo avatarı, ad, çevrimiçi/yazıyor durumu."""
    av = cc.VideoSegment(LOGO, trange(f"{bas:.3f}s", f"{bit - bas:.3f}s"),
                         clip_settings=cc.ClipSettings(scale_x=0.15, scale_y=0.15, transform_x=-0.82, transform_y=0.875))
    av.add_mask(cc.MaskType.圆形, size=0.62)
    proje.add_segment(av, "avatar")
    yazi("İNZA Gayrimenkul", bas, bit, "baslik", boyut=5.5, renk=BEYAZ, kalin=True, x=-0.30, y=0.90, hiza=0)
    for d_bas, d_bit, metin in durumlar:
        yazi(metin, d_bas, d_bit, "durum", boyut=3.8, renk=ALTIN, x=-0.45, y=0.845, hiza=0)
    yazi("Mesaj yazın…", bas, bit, "giris", boyut=4.5, renk=GRI, x=-0.55, y=-0.905, hiza=0)


# ---- Sohbet A (0 → tur) ----
gorsel(M4("sohbet.png"), 0, TUR_BAS)
sohbet_basligi(0, TUR_BAS, [(0, 2.2, "çevrimiçi"), (2.2, 3.2, "yazıyor…"), (3.2, TUR_BAS, "çevrimiçi")])
mesaj("Merhaba", 0.6, TUR_BAS, "m1", 0.66, giden=True)
mesaj("3+1 sıfır bir daire\narıyorum", 1.4, TUR_BAS, "m2", 0.52, giden=True)
yazi("•  •  •", 2.2, 3.2, "m3", boyut=6.0, renk=GRI, x=-0.62, y=0.36, giris=cc.TextIntro.渐显,
     arka=cc.TextBackground(color="#FFFFFF", alpha=1.0, round_radius=0.45, height=0.16, width=0.18))
mesaj("Tam aradığınız gibi\nbir ilanımız var", 3.2, TUR_BAS, "m3", 0.36)
mesaj("Manzara harika!\nİçini görebilir miyim?", 4.9, TUR_BAS, "m4", -0.53, giden=True)
mesaj("Tabii, buyurun", 5.7, TUR_BAS, "m5", -0.69)

# Fotoğraf mesajı: 4.0'da gelir, tura girerken büyüyüp tam ekrana açılır
FX, FY, FO = -0.526, 0.0, 0.40
foto = cc.VideoSegment(M2("manzara.jpg"), trange("4.0s", f"{TUR_BAS - 4.0:.4f}s"))
foto.add_mask(cc.MaskType.矩形, size=1.0, rect_width=1.0, round_corner=6)
for tt, o, x, y in ((0, FO, FX, FY), (TUR_BAS - 4.0 - 0.45, FO, FX, FY), (TUR_BAS - 4.0, 1.0, 0.0, 0.0)):
    foto.add_keyframe(cc.KeyframeProperty.uniform_scale, us(tt), o)
    foto.add_keyframe(cc.KeyframeProperty.position_x, us(tt), x)
    foto.add_keyframe(cc.KeyframeProperty.position_y, us(tt), y)
foto.add_animation(cc.IntroType.向上滑动, duration="0.25s")
proje.add_segment(foto, "foto")
sesler.append((4.0, "gelen"))

# ---- Tur: vuruşlarda kesilen tam ekran planlar, etiketler mesaj balonu ----
k = 15
for i, (dosya, n, kaynak, hiz, etiket, gecis) in enumerate(tur):
    bas, bit = vurus(k), vurus(k + n)
    gorsel(dosya, bas, bit, kaynak=kaynak, hiz=hiz, z=(1.0, 1.08), gecis=gecis)
    yazi(etiket, bas + 0.25, bit - 0.1, ("m1", "m2")[i % 2], boyut=6.0, x=-0.30, y=-0.62, hiza=0,
         giris=cc.TextIntro.向上滑动, arka=cc.TextBackground(color="#FFFFFF", alpha=0.95, round_radius=0.45,
                                                          height=0.16, width=0.18))
    sesler.append((bas + 0.25, "gelen"))
    k += n

# ---- Sohbet B (tur → kapanış) ----
gorsel(M4("sohbet.png"), TUR_SON, KAPANIS)
c = TUR_SON
sohbet_basligi(c, KAPANIS, [(c, c + 3.0, "çevrimiçi"), (c + 3.0, c + 3.7, "yazıyor…"), (c + 3.7, KAPANIS, "çevrimiçi")])
mesaj(f"{ILAN['m2']}  ·  {ILAN['oda']}\n{ILAN['kat']}  ·  {ILAN['bina']}\n{ILAN['konum']}", c + 0.4, KAPANIS, "m1", 0.48)
mesaj(ILAN["fiyat"], c + 1.3, KAPANIS, "m2", 0.22, boyut=8.0, font=cc.FontType.BebasNeue, zemin="#16213E",
      renk=ALTIN)
mesaj("Hemen görmek istiyorum!", c + 2.2, KAPANIS, "m3", 0.02, giden=True)
yazi("•  •  •", c + 3.0, c + 3.7, "m4", boyut=6.0, renk=GRI, x=-0.62, y=-0.18, giris=cc.TextIntro.渐显,
     arka=cc.TextBackground(color="#FFFFFF", alpha=1.0, round_radius=0.45, height=0.16, width=0.18))
mesaj(f"Randevu için arayın:\n{ILAN['tel']}", c + 3.7, KAPANIS, "m4", -0.20)

# ---- Kapanış: lacivert zemin + logo kartı + çağrı ----
gorsel(M4("lacivert.png"), KAPANIS, SON)
lg = cc.VideoSegment(LOGO, trange(f"{KAPANIS:.4f}s", f"{SON - KAPANIS:.4f}s"),
                     clip_settings=cc.ClipSettings(scale_x=0.85, scale_y=0.85, transform_y=0.22))
lg.add_mask(cc.MaskType.矩形, size=0.62, rect_width=0.96, round_corner=10)
lg.add_animation(cc.IntroType.模糊渐显, duration="0.5s")
proje.add_segment(lg, "foto")
yazi("Yeni eviniz\nbir mesaj uzağınızda", KAPANIS + 0.4, SON, "m1", boyut=8.5, renk=BEYAZ,
     font=cc.FontType.BebasNeue, y=-0.28, giris=cc.TextIntro.向上滑动, giris_sure="0.4s")
yazi("  Hemen yazın  ", KAPANIS + 0.9, SON, "m2", boyut=5.5, renk=KOMUR, kalin=True, y=-0.50,
     giris=cc.TextIntro.向上弹入, giris_sure="0.4s",
     arka=cc.TextBackground(color="#F2B526", alpha=1.0, round_radius=0.5))

# ---- Ses: müzik sohbette kısık, turda açık; mesaj sesleri; geçişlerde whoosh ----
for bas, bit, ses in ((0, TUR_BAS, 0.35), (TUR_BAS, TUR_SON, 0.9), (TUR_SON, KAPANIS, 0.35), (KAPANIS, SON, 0.8)):
    a = cc.AudioSegment(MUZIK, trange(f"{bas:.4f}s", f"{bit - bas:.4f}s"),
                        source_timerange=trange(f"{4 + bas:.4f}s", f"{bit - bas:.4f}s"), volume=ses)
    if bit == SON:
        a.add_fade("0s", "1.5s")
    proje.add_segment(a, "muzik")
efekt = [(b_, M4(f"{tur_}.wav"), 0.9) for b_, tur_ in sesler]
efekt += [(TUR_BAS - 0.45, os.path.join(SES, "whoosh.wav"), 0.6), (TUR_SON - 0.3, os.path.join(SES, "whoosh.wav"), 0.5),
          (KAPANIS, os.path.join(SES, "impact.wav"), 0.8)]
son_bit = {"sfx": -1.0, "sfx2": -1.0}
for bas, dosya, ses in sorted(efekt):
    sure = {"gelen.wav": 0.25, "giden.wav": 0.13}.get(os.path.basename(dosya), 0.7)   # dosya süreleri
    iz = "sfx" if son_bit["sfx"] <= bas else "sfx2"
    proje.add_segment(cc.AudioSegment(dosya, trange(f"{bas:.3f}s", f"{sure}s"), volume=ses), iz)
    son_bit[iz] = bas + sure

print(f"süre {SON:.1f} sn; tur {TUR_BAS:.2f}–{TUR_SON:.2f}, kapanış {KAPANIS:.2f}")
print("kaydedildi:", kaydet(proje, "ilan-sohbet"))
