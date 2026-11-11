# Şablon 4 — "velocity tur" → CapCut projesi "ilan-velocity"
# v1 (2026-11-05): 2026 trendi velocity edit + 3D fotoğraf efektleri + ışık huzmesi, her video planında rampa.
# v2 (2026-11-05): Codex sanat yönetmeni eleştirisiyle sadeleştirildi:
#  - Açılış doğrudan salon (manzara/elektrik direği kancası ve tezgahsız mutfak çıktı); tur: salon → hol → oda →
#    banyo → balkon → kapanış (dış→iç→dış yerine akan bir keşif).
#  - Velocity (hızlı 2.5x → yavaş 0.5x → hızlı 2.5x) yalnızca 2 yerde: açılış salonu ve balkon çıkışı.
#    Diğerleri sabit/yavaş; aynı numaranın her planda tekrarı yok.
#  - Geçişler: düz kesim ağırlıklı; tek kısa çözülme (oda → banyo). Balkon → kapanış eşleşmeli kesim (flaş yok).
#  - 3D yalnızca salon fotoğrafında (3D运镜). Işık huzmesi yok. Kapanış fotoğrafı yalnızca 1.00→1.03 ölçek.
#  - Renk: sıcak-nötr, Soft_Grain 12, ek gren katmanı yok. Altın küçük vurgu; lacivert kapanış kartında.
#  - Yazı: Bebas yalnız ana başlıklarda, açıklamalar Montserrat, hepsi alt-solda tek giriş animasyonu.
#  - Ses: whoosh yalnızca iki velocity anında, düşük seviyede.
# Medya: capcut/medya5 (gerçek_veri_2 videoları, 1080x1920) + capcut/medya2 (9:16 fotoğraflar).
# Çalıştır: .venv-capcut\Scripts\python.exe -X utf8 capcut\tanitim_velocity.py
import os
import pycapcut as cc
from pycapcut import trange, SEC
from taslak import kaydet

ILAN = {"tel": "0 (5XX) XXX XX XX"}      # MOCK — gerçek ilanla değiştir

KOK = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
V = lambda n: os.path.join(KOK, "capcut", "medya5", f"video{n}.mp4")
F = lambda ad: os.path.join(KOK, "capcut", "medya2", ad)
SES = os.path.join(KOK, "hyperframes", "ilan", "assets")
MUZIK = os.path.join(KOK, "muzik", "luxury-real-estate.mp3")
LOGO = os.path.join(KOK, "marka", "inza-logo.jpg")

B = 0.4497                       # ölçülmüş vuruş aralığı (müzik 4. saniyeden; diğer şablonlarla aynı)
ALTIN = (0.95, 0.71, 0.15)
LACIVERT = "#16213E"
BEYAZ = (1, 1, 1)
us = lambda s: int(round(s * SEC))

proje = cc.ScriptFile(1080, 1920)
for ad in ("ana", "logo"):
    proje.add_track(cc.TrackType.video, ad)
proje.add_track(cc.TrackType.audio, "muzik").add_track(cc.TrackType.audio, "sfx")
for ad in ("t1", "t2", "t3"):
    proje.add_track(cc.TrackType.text, ad)
proje.add_track(cc.TrackType.effect, "fx").add_track(cc.TrackType.effect, "ton").add_track(cc.TrackType.filter)

# tur: "ramp" = velocity, "sabit" = normal hız, "yavas" = 0.6x, "foto" = fotoğraf (ölçek z0→z1)
planlar = [
    dict(tur="ramp",  src=V(1), n=4, bas=0.2),                                                  # AÇILIŞ salon
    dict(tur="foto",  src=F("salon.jpg"), n=4, z=(1.0, 1.05), fx=cc.VideoSceneEffectType._3D运镜),
    dict(tur="sabit", src=V(5), n=4, bas=0.8, yazi="Odaları bağlayan hol"),
    dict(tur="yavas", src=V(3), n=6, bas=0.5, gecis=cc.TransitionType.叠化, yazi="Gün ışığı alan oda"),
    dict(tur="yavas", src=V(9), n=4, bas=0.8, yazi="Şık banyo"),
    dict(tur="ramp",  src=V(6), n=6, bas=0.0, yazi="Şehre bakan manzara"),   # balkon çıkışı (klip 3.8 sn → en çok 6 vuruş)
    dict(tur="foto",  src=F("balkon.jpg"), n=13, z=(1.0, 1.03)),                                # KAPANIŞ
]

t = 0.0
sinirlar = []
for p in planlar:
    sure = p["n"] * B
    sinirlar.append(t)
    hedef_tr = cc.Timerange(us(t), us(t + sure) - us(t))
    if p["tur"] == "foto":
        son_seg = cc.VideoSegment(p["src"], hedef_tr)
        z0, z1 = p["z"]
        son_seg.add_keyframe(cc.KeyframeProperty.uniform_scale, 0, z0)
        son_seg.add_keyframe(cc.KeyframeProperty.uniform_scale, hedef_tr.duration, z1)
        proje.add_segment(son_seg, "ana")
    elif p["tur"] in ("sabit", "yavas"):
        hiz = 1.0 if p["tur"] == "sabit" else 0.6
        son_seg = cc.VideoSegment(p["src"], hedef_tr,
                                  source_timerange=cc.Timerange(us(p["bas"]), int(hedef_tr.duration * hiz)),
                                  speed=hiz, volume=0)
        son_seg.add_keyframe(cc.KeyframeProperty.uniform_scale, 0, 1.0)
        son_seg.add_keyframe(cc.KeyframeProperty.uniform_scale, hedef_tr.duration, 1.04)
        proje.add_segment(son_seg, "ana")
    else:                                    # velocity: hızlı → yavaş → hızlı, tam sayı µs sınırlar
        kaynak = us(p["bas"])
        sinir = [us(t), us(t + sure * 0.2), us(t + sure * 0.8), us(t + sure)]
        for j, hiz in enumerate((2.5, 0.5, 2.5)):
            d = sinir[j + 1] - sinir[j]
            ks = int(d * hiz)
            son_seg = cc.VideoSegment(p["src"], cc.Timerange(sinir[j], d),
                                      source_timerange=cc.Timerange(kaynak, ks), speed=hiz, volume=0)
            proje.add_segment(son_seg, "ana")
            kaynak += ks
    if p.get("gecis"):                       # bu planın çıkışına uygulanır
        son_seg.add_transition(p["gecis"], duration="0.2s")
    if p.get("fx"):
        proje.add_effect(p["fx"], trange(f"{t:.4f}s", f"{sure:.4f}s"), track_name="fx")
    t += sure
SON = t
KAPANIS = sinirlar[-1]

# Logo: baştan küçük imza (sağ üst), kapanışta büyük (滤色 = siyah zemin kaybolur)
def logo(bas, sure, olcek, x, y, giris=None, saydam=1.0):
    s = cc.VideoSegment(LOGO, trange(f"{bas:.3f}s", f"{sure:.3f}s"),
                        clip_settings=cc.ClipSettings(scale_x=olcek, scale_y=olcek, transform_x=x, transform_y=y,
                                                      alpha=saydam))
    s.set_mix_mode(cc.MixModeType.滤色)
    if giris:
        s.add_animation(giris, duration="0.5s")
    proje.add_segment(s, "logo")

logo(0.0, KAPANIS, 0.22, 0.68, 0.82, saydam=0.85)
logo(KAPANIS, SON - KAPANIS, 0.75, 0, 0.32, cc.IntroType.渐显)

# Ton: sıcak-nötr, hafif gren; açılış/kapanış
proje.add_effect(cc.VideoSceneEffectType.渐显开幕, trange("0s", "0.5s"), track_name="ton")
proje.add_effect(cc.VideoSceneEffectType.渐隐闭幕, trange(f"{SON - 1.0:.3f}s", "1.0s"), track_name="ton")
proje.add_filter(cc.FilterType.Soft_Grain, trange("0s", f"{SON:.3f}s"), intensity=12)

# Ses: müzik; whoosh yalnızca iki velocity anında (açılış salonu, balkon çıkışı), kısık
proje.add_segment(cc.AudioSegment(MUZIK, trange("0s", f"{SON:.3f}s"), source_timerange=trange("4s", f"{SON:.3f}s"),
                                  volume=0.85).add_fade("0.3s", "1.5s"), "muzik")
for s0 in (0.0, sinirlar[5] + 0.3):
    proje.add_segment(cc.AudioSegment(os.path.join(SES, "whoosh.wav"), trange(f"{s0:.3f}s", "0.7s"), volume=0.4), "sfx")

# Yazılar: alt-sol güvenli alan, tek giriş animasyonu
def yazi(metin, bas, sure, iz, *, boyut=12.0, renk=BEYAZ, x=-0.30, y=-0.55, font=cc.FontType.Montserrat,
         kalin=False, arka=None):
    ts = cc.TextSegment(metin, trange(f"{bas:.3f}s", f"{sure:.3f}s"), font=font,
                        style=cc.TextStyle(size=boyut, bold=kalin, color=renk, align=0),
                        clip_settings=cc.ClipSettings(transform_x=x, transform_y=y),
                        shadow=cc.TextShadow(alpha=0.6, color=(0, 0, 0)), background=arka)
    ts.add_animation(cc.TextIntro.向右滑动, duration="0.35s")
    ts.add_animation(cc.TextOutro.渐隐, duration="0.25s")
    proje.add_segment(ts, iz)

# Açılış başlığı ilk 0.15 sn'de; altın vurgu
yazi("BALKONA AÇILAN", 0.15, sinirlar[1] - 0.3, "t1", boyut=19, font=cc.FontType.BebasNeue, y=-0.38)
yazi("SALON", 0.15, sinirlar[1] - 0.3, "t2", boyut=19, font=cc.FontType.BebasNeue, y=-0.56, renk=ALTIN)
for i, p in enumerate(planlar):
    if p.get("yazi"):
        bas = sinirlar[i] + 0.2
        bit = sinirlar[i + 1]
        yazi(p["yazi"], bas, bit - bas - 0.15, "t1")

# Kapanış: logo + çağrı + telefon birlikte, lacivert kart üzerinde
kart = lambda: cc.TextBackground(color=LACIVERT, alpha=0.85, round_radius=0.3)
yazi("YERİNDE GÖRÜN", KAPANIS + 0.2, SON - KAPANIS - 0.3, "t1", boyut=17, font=cc.FontType.BebasNeue,
     x=0, y=-0.15, arka=kart())
yazi(ILAN["tel"], KAPANIS + 0.2, SON - KAPANIS - 0.3, "t2", boyut=11, kalin=True, renk=ALTIN,
     x=0, y=-0.34, arka=kart())

print(f"süre {SON:.1f} sn, {len(planlar)} plan")
print("kaydedildi:", kaydet(proje, "ilan-velocity"))
