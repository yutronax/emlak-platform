# Markalı tanıtım kurgusu → CapCut projesi "ilan-tanitim-3"
# Temel: tanitim_zengin.py (kullanıcının beğendiği kurgu). Eklenenler:
#  - İNZA Gayrimenkul & Yatırım logosu: açılış logosu, köşe filigranı, kapanış logosu
#    (logo siyah zeminli JPG; CapCut "ekran/滤色" karışım moduyla siyah zemin kaybolur)
#  - Marka renkleri (logodan): altın #F2B526, lacivert #16213E
#  - İlan bilgi kartları (ILAN sözlüğü; şu an MOCK değerler — gerçek ilanla değiştir)
#  - Yeni efektler: kelime kelime kinetik etiket, ikinci ışık sızması overlay, bilgi listesi animasyonu
# Çalıştır: .venv-capcut\Scripts\python.exe -X utf8 capcut\tanitim_marka.py
import os
import pycapcut as cc
from pycapcut import trange, SEC
from taslak import kaydet

# ---- İlan bilgileri (MOCK) ----
ILAN = {
    "tur": "KİRALIK OFİS",
    "m2": "320 m²",
    "kat": "8. Kat",
    "konum": "Bornova / İzmir",
    "fiyat": "85.000 TL / ay",
    "tel": "0 (5XX) XXX XX XX",
}

KOK = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FOTO = os.path.join(KOK, "hyperframes", "tanitim", "assets")     # 9:16 kırpılmış fotoğraflar
SES = os.path.join(KOK, "hyperframes", "ilan", "assets")          # whoosh.wav, impact.wav
MUZIK = os.path.join(KOK, "muzik", "luxury-real-estate.mp3")
LOGO = os.path.join(KOK, "marka", "inza-logo.jpg")
# Telefon videolarının gerçekten dik (1080x1920) kopyaları (bkz. tanitim_zengin.py)
V = lambda n: os.path.join(KOK, "capcut", "medya", f"video{n}.mp4")
LOBI, KAPI_ODA, LAVABO, ODA_PAN, CEPHE_PAN, KORIDOR = V(0), V(1), V(3), V(5), V(6), V(7)

B = 0.4497                      # 135 BPM vuruş aralığı (müzik 4. saniyeden)
vurus = lambda k: 0.045 + k * B
us = lambda s: int(round(s * SEC))
ALTIN = (0.95, 0.71, 0.15)      # #F2B526
LACIVERT = "#16213E"
BEYAZ = (1, 1, 1)

proje = cc.ScriptFile(1080, 1920)
proje.add_track(cc.TrackType.video, "ana")
proje.add_track(cc.TrackType.video, "logo")
proje.add_track(cc.TrackType.video, "isik")      # kendi ürettiğimiz ışık overlay'leri (ekran modu)
proje.add_track(cc.TrackType.video, "gren")      # film greni (kaplama modu), en üstte
proje.add_track(cc.TrackType.audio, "muzik").add_track(cc.TrackType.audio, "sfx")
for ad in ("t1", "t2", "t3", "t4", "t5"):
    proje.add_track(cc.TrackType.text, ad)
proje.add_track(cc.TrackType.effect, "overlay").add_track(cc.TrackType.effect, "ton").add_track(cc.TrackType.filter)

# ---- Planlar ----
planlar = [
    dict(src=LOBI,      n=3, bas=0.0, hiz=0.5,  anim=cc.IntroType.动感放大),         # AÇILIŞ LOGOSU üstünde
    dict(src=CEPHE_PAN, n=1, bas=9.8, hiz=1.0,  anim=cc.IntroType.向左上甩入),
    dict(foto="cephe.jpg",  n=1, px=0.48, py=0.40, z=(1.25, 1.45)),
    dict(src=LAVABO,    n=1, bas=1.0, hiz=1.0,  anim=cc.IntroType.向右甩入),
    dict(foto="mutfak.jpg", n=1, px=0.68, py=0.53, z=(1.3, 1.5), gecis=cc.TransitionType.White_Flash),
    dict(src=CEPHE_PAN, n=4, bas=0.0, hiz=0.5,  z=(1.0, 1.08)),                     # BAŞLIK
    dict(src=CEPHE_PAN, n=4, bas=1.2, hiz=1.0,  z=(1.05, 1.05), gecis=cc.TransitionType.横向模糊),
    dict(src=CEPHE_PAN, n=4, bas=9.0, hiz=0.8,  z=(1.0, 1.06), gecis=cc.TransitionType.叠化),
    dict(src=ODA_PAN,   n=3, bas=5.0, hiz=0.7,  z=(1.0, 1.06), gecis=cc.TransitionType.推近),
    dict(src=KORIDOR,   n=3, bas=3.0, hiz=0.7,  z=(1.0, 1.1)),
    dict(src=LAVABO,    n=2, bas=1.2, hiz=0.5,  z=(1.0, 1.05), gecis=cc.TransitionType.竖向模糊),
    dict(foto="mutfak.jpg", n=3, px=0.68, py=0.53, z=(1.15, 1.05), gecis=cc.TransitionType.炫光),
    dict(src=KAPI_ODA,  n=12, bas=0.0, hiz=0.5, z=(1.0, 1.2)),                      # BİLGİ KARTLARI + KAPANIŞ
]

sinirlar = []
for i, p in enumerate(planlar):
    bas_t = 0.0 if i == 0 else vurus(sum(q["n"] for q in planlar[:i]))
    bit_t = vurus(sum(q["n"] for q in planlar[:i + 1])) + (0.4 if i == len(planlar) - 1 else 0)
    sure = bit_t - bas_t
    sinirlar.append(bas_t)
    if "foto" in p:
        seg = cc.VideoSegment(os.path.join(FOTO, p["foto"]), trange(f"{bas_t:.4f}s", f"{sure:.4f}s"))
        px, py = p["px"], p["py"]
        taban = 1.05 * max(0.5 / px, 0.5 / (1 - px), 0.5 / py, 0.5 / (1 - py))
    else:
        seg = cc.VideoSegment(p["src"], trange(f"{bas_t:.4f}s", f"{sure:.4f}s"),
                              source_timerange=trange(f"{p['bas']}s", f"{sure * p['hiz']:.4f}s"))
        px = py = 0.5
        taban = 1.0
    z0, z1 = p.get("z", (1.0, 1.0))
    for tt, z in ((0, z0), (sure, z1)):      # özne merkezde kalarak yaklaşma
        s = taban * z
        seg.add_keyframe(cc.KeyframeProperty.uniform_scale, us(tt), s)
        seg.add_keyframe(cc.KeyframeProperty.position_x, us(tt), (0.5 - px) * 2 * s)
        seg.add_keyframe(cc.KeyframeProperty.position_y, us(tt), (py - 0.5) * 2 * s)
    if p.get("anim"):
        seg.add_animation(p["anim"], duration="0.3s")
    if p.get("gecis"):
        seg.add_transition(p["gecis"], duration="0.45s")
    proje.add_segment(seg, "ana")
SON = vurus(sum(q["n"] for q in planlar)) + 0.4
BASLIK, GENIS, MANZARA, ODA_T, KOR_T, LAV_T, MUTF_T, KAPANIS = sinirlar[5:13]
LOGO_SON = KAPANIS + 6 * B          # kapanışta önce bilgi listesi (6 vuruş), sonra logo + iletişim

# ---- Logo: açılış (büyük, merkez) → filigran (sağ üst) → kapanış (büyük) ----
def logo(bas, sure, olcek, x, y, *, giris=None, cikis=None, saydam=1.0):
    s = cc.VideoSegment(LOGO, trange(f"{bas:.3f}s", f"{sure:.3f}s"),
                        clip_settings=cc.ClipSettings(scale_x=olcek, scale_y=olcek, transform_x=x, transform_y=y,
                                                      alpha=saydam))
    s.set_mix_mode(cc.MixModeType.滤色)       # siyah zemini kaldırır
    if giris:
        s.add_animation(giris, duration="0.5s")
    if cikis:
        s.add_animation(cikis, duration="0.35s")
    proje.add_segment(s, "logo")

logo(0.15, vurus(3) - 0.15, 0.9, 0, 0.05, giris=cc.IntroType.模糊渐显, cikis=cc.OutroType.缩小)
logo(BASLIK, KAPANIS - BASLIK, 0.24, 0.66, 0.80, saydam=0.85)
logo(LOGO_SON, SON - LOGO_SON, 0.85, 0, 0.30, giris=cc.IntroType.动感缩小)

# ---- Efektler ----
proje.add_effect(cc.VideoSceneEffectType.渐显开幕, trange("0s", "0.8s"), track_name="overlay")
proje.add_effect(cc.VideoSceneEffectType.胶片漏光, trange(f"{BASLIK:.3f}s", "1.6s"), track_name="overlay")
proje.add_effect(cc.VideoSceneEffectType.渐隐闭幕, trange(f"{SON - 1.0:.3f}s", "1.0s"), track_name="overlay")
proje.add_effect(cc.VideoSceneEffectType.暗角, trange("0s", f"{SON:.3f}s"), track_name="ton")
proje.add_filter(cc.FilterType.Soft_Grain,trange("0s", f"{SON:.3f}s"), intensity=55)

# ---- Kendi overlay'lerimiz (video-calisma/varliklar/overlay, ffmpeg ile üretildi) ----
OVERLAY = os.path.join(KOK, "varliklar", "overlay")

def overlay(dosya, bas, sure, iz, mod, saydam=1.0):
    s = cc.VideoSegment(os.path.join(OVERLAY, dosya), trange(f"{bas:.3f}s", f"{sure:.3f}s"),
                        clip_settings=cc.ClipSettings(alpha=saydam))
    s.set_mix_mode(mod)
    proje.add_segment(s, iz)

overlay("isik_sizmasi_sicak.mp4", BASLIK - 0.2, 2.8, "isik", cc.MixModeType.滤色, 0.9)    # başlık açılışı
overlay("isik_supurme_altin.mp4", MANZARA - 0.6, 1.2, "isik", cc.MixModeType.滤色, 0.7)   # manzara kesimi (Pro 散景漏光 yerine)
overlay("isik_supurme_altin.mp4", ODA_T - 0.5, 1.4, "isik", cc.MixModeType.滤色, 0.8)     # ışıkla kesim
overlay("lens_parlamasi.mp4", LOGO_SON - 0.3, 2.0, "isik", cc.MixModeType.滤色)             # kapanış logosu
t = 0.0
while t < SON - 0.05:                                                                      # gren tüm video boyunca
    sure = min(3.0, SON - t)
    overlay("film_greni.mp4", t, sure, "gren", cc.MixModeType.叠加, 0.35)
    t += sure

# ---- Ses ----
proje.add_segment(cc.AudioSegment(MUZIK, trange("0s", f"{SON:.3f}s"), source_timerange=trange("4s", f"{SON:.3f}s"),
                                  volume=0.85).add_fade("0.3s", "1.5s"), "muzik")
sfx = [(sinirlar[i] - 0.2, "whoosh.wav", 0.7) for i in (6, 7, 8, 10, 11)]
sfx += [(0.0, "impact.wav", 1.0), (BASLIK, "impact.wav", 1.0), (KAPANIS, "whoosh.wav", 0.6), (LOGO_SON, "impact.wav", 0.9)]
for bas, dosya, ses in sorted(sfx):
    proje.add_segment(cc.AudioSegment(os.path.join(SES, dosya), trange(f"{max(bas, 0):.3f}s", "0.7s"), volume=ses), "sfx")

# ---- Yazılar ----
def yazi(metin, bas, sure, iz, *, boyut=9.0, renk=BEYAZ, x=0.0, y=-0.45, font=cc.FontType.Montserrat,
         kalin=False, giris=None, cikis=cc.TextOutro.渐隐, arka=None, giris_sure="0.5s"):
    t = cc.TextSegment(metin, trange(f"{bas:.3f}s", f"{sure:.3f}s"), font=font,
                       style=cc.TextStyle(size=boyut, bold=kalin, color=renk, align=1),
                       clip_settings=cc.ClipSettings(transform_x=x, transform_y=y),
                       shadow=cc.TextShadow(alpha=0.7, color=(0, 0, 0)), background=arka)
    if giris:
        t.add_animation(giris, duration=giris_sure)
    if cikis:
        t.add_animation(cikis, duration="0.25s")
    proje.add_segment(t, iz)

lacivert_kart = lambda saydam=0.85: cc.TextBackground(color=LACIVERT, alpha=saydam, round_radius=0.35)

# Kanca başlığı: kelimeler vuruşlarda, her biri farklı animasyon; altında ilan türü ve m²
b0 = BASLIK
yazi(ILAN["tur"], b0 + 0.1, GENIS - b0 - 0.3, "t5", boyut=5.0, renk=ALTIN, y=-0.12, giris=cc.TextIntro.渐显)
yazi("GENİŞ", b0 + B, GENIS - b0 - B - 0.1, "t1", boyut=17.0, font=cc.FontType.BebasNeue, y=-0.28,
     giris=cc.TextIntro.向上弹入, giris_sure="0.3s")
yazi("OFİS", b0 + 2 * B, GENIS - b0 - 2 * B - 0.1, "t2", boyut=17.0, font=cc.FontType.BebasNeue, y=-0.44,
     renk=ALTIN, giris=cc.TextIntro.弹出, giris_sure="0.3s")
yazi("KATI", b0 + 3 * B, GENIS - b0 - 3 * B - 0.1, "t3", boyut=17.0, font=cc.FontType.BebasNeue, y=-0.60,
     giris=cc.TextIntro.故障弹跳, giris_sure="0.3s")

# Özellik etiketleri: altın sayaç + metin; "Şehre bakan manzara" kelime kelime (kinetik)
etiketler = [
    (GENIS, MANZARA, "01", "Boydan boya cam cephe", cc.TextIntro.向右滑动, -0.25),
    (ODA_T, KOR_T,   "03", "Geniş çalışma alanı",   cc.TextIntro.打字机, 0.0),
    (KOR_T, LAV_T,   "04", "Aydınlık koridorlar",   cc.TextIntro.渐显, 0.0),
    (MUTF_T, KAPANIS, "05", "Hazır mutfak",         cc.TextIntro.弹出, 0.0),
]
for bas, bit, no, metin, giris, x in etiketler:
    yazi(no, bas + 0.15, bit - bas - 0.35, "t4", boyut=6.0, renk=ALTIN, x=x, y=-0.33,
         font=cc.FontType.BebasNeue, giris=cc.TextIntro.渐显)
    yazi(metin, bas + 0.25, bit - bas - 0.45, "t1", boyut=8.5, x=x, y=-0.45, giris=giris)
yazi("02", MANZARA + 0.15, ODA_T - MANZARA - 0.35, "t4", boyut=6.0, renk=ALTIN, x=0.3, y=-0.30,
     font=cc.FontType.BebasNeue, giris=cc.TextIntro.渐显)
for k, (kelime, giris) in enumerate([("Şehre", cc.TextIntro.向左模糊), ("bakan", cc.TextIntro.向左模糊),
                                     ("manzara", cc.TextIntro.弹出)]):
    yazi(kelime, MANZARA + 0.25 + k * B, ODA_T - MANZARA - 0.45 - k * B, ("t1", "t2", "t3")[k], boyut=9.5,
         x=0.3, y=-0.40 - k * 0.09, renk=ALTIN if k == 2 else BEYAZ, kalin=(k == 2), giris=giris, giris_sure="0.3s")

# Bilgi kartları: kapanışın ilk 6 vuruşu, her vuruşta bir satır, lacivert kart üzerinde
bilgiler = [("m2", cc.TextIntro.向右滑动), ("kat", cc.TextIntro.向右滑动), ("konum", cc.TextIntro.向右滑动)]
for k, (anahtar, giris) in enumerate(bilgiler):
    bas = KAPANIS + 0.3 + k * B
    yazi(ILAN[anahtar], bas, LOGO_SON - bas - 0.1, ("t1", "t2", "t3")[k], boyut=8.0, x=-0.25, y=0.05 - k * 0.13,
         kalin=True, giris=giris, giris_sure="0.35s", arka=lacivert_kart())
fbas = KAPANIS + 0.3 + 3 * B
yazi(ILAN["fiyat"], fbas, LOGO_SON - fbas - 0.1, "t4", boyut=11.0, renk=ALTIN, font=cc.FontType.BebasNeue,
     x=-0.15, y=-0.40, giris=cc.TextIntro.弹出, giris_sure="0.4s", arka=lacivert_kart(0.9))

# Kapanış: logo + çağrı + telefon
yazi("TAŞINMAYA HAZIR", LOGO_SON + 0.3, SON - LOGO_SON - 0.5, "t1", boyut=12.0, font=cc.FontType.BebasNeue,
     y=-0.12, giris=cc.TextIntro.向上滑动, cikis=None)
yazi("Hemen arayın", LOGO_SON + 0.8, SON - LOGO_SON - 1.0, "t2", boyut=6.0, renk=(0.08, 0.08, 0.08), kalin=True,
     y=-0.30, giris=cc.TextIntro.向上弹入, cikis=None,
     arka=cc.TextBackground(color="#F2B526", alpha=1.0, round_radius=0.3))
yazi(ILAN["tel"], LOGO_SON + 1.1, SON - LOGO_SON - 1.3, "t3", boyut=8.0, kalin=True, y=-0.44,
     giris=cc.TextIntro.打字机, cikis=None)

print(f"süre {SON:.1f} sn, {len(planlar)} plan")
print("kaydedildi:", kaydet(proje, "ilan-tanitim-3"))
