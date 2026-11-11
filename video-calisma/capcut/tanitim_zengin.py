# Zengin tanıtım kurgusu → CapCut projesi "ilan-tanitim-2"
# Kurslardan: hızlı kanca montajı (1 vuruş kesimler), gerçek hareketli görüntü + yavaş çekim (Cory),
# kelime kelime kinetik başlık (Matt Loui), geçişlerde ses efekti, ışık sızması overlay (Joey),
# her geçiş bir kez ve amacına göre, özne merkezde, emlakta yazılar okunacak kadar ekranda.
# Çalıştır: .venv-capcut\Scripts\python.exe -X utf8 capcut\tanitim_zengin.py
import os
import pycapcut as cc
from pycapcut import trange, SEC
from taslak import kaydet

KOK = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
VERI = os.path.join(KOK, "gerçek_test_veri")
FOTO = os.path.join(KOK, "hyperframes", "tanitim", "assets")     # 9:16 kırpılmış fotoğraflar
SES = os.path.join(KOK, "hyperframes", "ilan", "assets")          # whoosh.wav, impact.wav
MUZIK = os.path.join(KOK, "muzik", "luxury-real-estate.mp3")
# Telefon videoları yatay kaydedilip "döndürme" bilgisiyle dik gösteriliyor; pycapcut bu bilgiyi okumadığı için
# CapCut'a yatay gidiyor. Bu yüzden ffmpeg ile gerçekten dik (1080x1920) kopyalar kullanılır: capcut/medya/videoN.mp4
# (gerçek_test_veri'deki "...19.54.21 (N).mp4" dosyalarından; N yoksa 0)
V = lambda n: os.path.join(KOK, "capcut", "medya", f"video{n}.mp4")
LOBI, KAPI_ODA, ODA, LAVABO, ODA_PAN, CEPHE_PAN, KORIDOR = V(0), V(1), V(2), V(3), V(5), V(6), V(7)

B = 0.4497                      # 135 BPM vuruş aralığı (müzik 4. saniyeden)
vurus = lambda k: 0.045 + k * B
us = lambda s: int(round(s * SEC))
ALTIN = (0.91, 0.76, 0.48)

proje = cc.ScriptFile(1080, 1920)
proje.add_track(cc.TrackType.video)
proje.add_track(cc.TrackType.audio, "muzik").add_track(cc.TrackType.audio, "sfx")
for ad in ("kanca", "etiket", "sayac", "cta"):
    proje.add_track(cc.TrackType.text, ad)
proje.add_track(cc.TrackType.effect, "overlay").add_track(cc.TrackType.effect, "ton").add_track(cc.TrackType.filter)

# ---- Planlar: (kaynak, vuruş sayısı, kaynak başlangıcı, hız | foto için özne px,py, giriş animasyonu, sonraki geçiş) ----
# Kanca montajı: 1 vuruşluk hızlı detaylar, sonra başlık ve yavaş tur
planlar = [
    dict(src=LOBI,      n=2, bas=0.0, hiz=0.5,  anim=cc.IntroType.动感放大),        # ışıklı lobi koridoru
    dict(src=CEPHE_PAN, n=1, bas=9.8, hiz=1.0,  anim=cc.IntroType.向左上甩入),        # şehir manzarası
    dict(foto="cephe.jpg",  n=1, px=0.48, py=0.40, z=(1.25, 1.45)),                 # tuğla doku, punch-in
    dict(src=LAVABO,    n=1, bas=1.0, hiz=1.0,  anim=cc.IntroType.向右甩入),        # lavabo detayı
    dict(foto="mutfak.jpg", n=1, px=0.68, py=0.53, z=(1.3, 1.5), gecis=cc.TransitionType.White_Flash),
    dict(src=CEPHE_PAN, n=4, bas=0.0, hiz=0.5,  z=(1.0, 1.08)),                    # BAŞLIK: kapıdan geniş salona
    dict(src=CEPHE_PAN, n=4, bas=1.2, hiz=1.0,  z=(1.05, 1.05), gecis=cc.TransitionType.横向模糊),
    dict(src=CEPHE_PAN, n=4, bas=9.0, hiz=0.8,  z=(1.0, 1.06), gecis=cc.TransitionType.叠化),
    dict(src=ODA_PAN,   n=3, bas=5.0, hiz=0.7,  z=(1.0, 1.06), gecis=cc.TransitionType.推近),
    dict(src=KORIDOR,   n=3, bas=3.0, hiz=0.7,  z=(1.0, 1.1)),                     # düz kesme: aynı akış
    dict(src=LAVABO,    n=2, bas=1.2, hiz=0.5,  z=(1.0, 1.05), gecis=cc.TransitionType.竖向模糊),
    dict(foto="mutfak.jpg", n=3, px=0.68, py=0.53, z=(1.15, 1.05), gecis=cc.TransitionType.炫光),
    dict(src=KAPI_ODA,  n=8, bas=0.0, hiz=0.5,  z=(1.0, 1.15)),                    # kapanış: kapıdan aydınlık odaya
]

t = 0.0
sinirlar = []
for i, p in enumerate(planlar):
    bas_t = 0.0 if i == 0 else vurus(sum(q["n"] for q in planlar[:i]))
    bit_t = vurus(sum(q["n"] for q in planlar[:i + 1]))
    if i == len(planlar) - 1:
        bit_t += 0.4
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
    proje.add_segment(seg)
SON = vurus(sum(q["n"] for q in planlar)) + 0.4
BASLIK, GENIS, MANZARA, ODA_T, KOR_T, LAV_T, MUTF_T, KAPANIS = sinirlar[5:13]

# ---- Efektler ----
proje.add_effect(cc.VideoSceneEffectType.渐显开幕, trange("0s", "0.8s"), track_name="overlay")
proje.add_effect(cc.VideoSceneEffectType.胶片漏光, trange(f"{BASLIK:.3f}s", "1.6s"), track_name="overlay")
proje.add_effect(cc.VideoSceneEffectType.渐隐闭幕, trange(f"{SON - 1.0:.3f}s", "1.0s"), track_name="overlay")
proje.add_effect(cc.VideoSceneEffectType.暗角, trange("0s", f"{SON:.3f}s"), track_name="ton")
proje.add_filter(cc.FilterType.质感, trange("0s", f"{SON:.3f}s"), intensity=55)

# ---- Ses: müzik + geçişlerde whoosh + başlık/kapanışta vuruş ----
proje.add_segment(cc.AudioSegment(MUZIK, trange("0s", f"{SON:.3f}s"), source_timerange=trange("4s", f"{SON:.3f}s"),
                                  volume=0.85).add_fade("0.3s", "1.5s"), "muzik")
sfx = [(sinirlar[i] - 0.2, "whoosh.wav", 0.7) for i in (6, 7, 8, 10, 11)]
sfx += [(0.0, "impact.wav", 1.0), (BASLIK, "impact.wav", 1.0), (KAPANIS, "impact.wav", 0.8)]
for bas, dosya, ses in sorted(sfx):
    proje.add_segment(cc.AudioSegment(os.path.join(SES, dosya), trange(f"{max(bas, 0):.3f}s", "0.7s"), volume=ses), "sfx")

# ---- Yazılar ----
def yazi(metin, bas, sure, iz, *, boyut=9.0, renk=(1, 1, 1), x=0.0, y=-0.45, font=cc.FontType.Montserrat,
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

# Kanca: kelimeler vuruşlarda tek tek, her biri farklı animasyonla (Matt Loui)
b0 = BASLIK
yazi("YENİ İLAN", b0 + 0.1, GENIS - b0 - 0.3, "sayac", boyut=5.0, renk=ALTIN, y=-0.12, giris=cc.TextIntro.渐显)
yazi("GENİŞ", b0 + B * 1, GENIS - b0 - B * 1 - 0.1, "kanca", boyut=17.0, font=cc.FontType.BebasNeue, y=-0.28,
     giris=cc.TextIntro.向上弹入, giris_sure="0.3s")
yazi("OFİS", b0 + B * 2, GENIS - b0 - B * 2 - 0.1, "etiket", boyut=17.0, font=cc.FontType.BebasNeue, y=-0.44,
     renk=ALTIN, giris=cc.TextIntro.弹入, giris_sure="0.3s")
yazi("KATI", b0 + B * 3, GENIS - b0 - B * 3 - 0.1, "cta", boyut=17.0, font=cc.FontType.BebasNeue, y=-0.60,
     giris=cc.TextIntro.故障弹跳, giris_sure="0.3s")

# Özellik etiketleri: altın sayaç + metin, her biri farklı giriş
etiketler = [
    (GENIS,   MANZARA, "01", "Boydan boya cam cephe", cc.TextIntro.向右滑动, -0.25),
    (MANZARA, ODA_T,   "02", "Şehre bakan manzara",   cc.TextIntro.向左模糊, 0.25),
    (ODA_T,   KOR_T,   "03", "Geniş çalışma alanı",   cc.TextIntro.打字机, 0.0),
    (KOR_T,   LAV_T,   "04", "Aydınlık koridorlar",   cc.TextIntro.渐显, 0.0),
    (MUTF_T,  KAPANIS, "05", "Hazır mutfak",          cc.TextIntro.弹入, 0.0),
]
for bas, bit, no, metin, giris, x in etiketler:
    yazi(no, bas + 0.15, bit - bas - 0.35, "sayac", boyut=6.0, renk=ALTIN, x=x, y=-0.33,
         font=cc.FontType.BebasNeue, giris=cc.TextIntro.渐显)
    yazi(metin, bas + 0.25, bit - bas - 0.45, "etiket", boyut=8.5, x=x, y=-0.45, giris=giris)

# Kapanış kartı
yazi("TAŞINMAYA", KAPANIS + 0.3, SON - KAPANIS - 0.5, "kanca", boyut=15.0, font=cc.FontType.BebasNeue, y=-0.20,
     giris=cc.TextIntro.向上滑动, cikis=None)
yazi("HAZIR", KAPANIS + 0.3 + B, SON - KAPANIS - 0.5 - B, "etiket", boyut=15.0, font=cc.FontType.BebasNeue,
     renk=ALTIN, y=-0.36, giris=cc.TextIntro.向上滑动, cikis=None)
yazi("Detaylar için hemen yazın", KAPANIS + 1.4, SON - KAPANIS - 1.6, "cta", boyut=6.0, renk=(0.08, 0.08, 0.08),
     kalin=True, y=-0.55, giris=cc.TextIntro.向上弹入, cikis=None,
     arka=cc.TextBackground(color="#E8C27A", alpha=1.0, round_radius=0.3))

print(f"süre {SON:.1f} sn, {len(planlar)} plan")
print("kaydedildi:", kaydet(proje, "ilan-tanitim-2"))
