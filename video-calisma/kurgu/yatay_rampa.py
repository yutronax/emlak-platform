# Yatay (16:9) hız rampalı ilan denemesi — mevcut dikey kliplerle (kurgu araştırması: arastirma/HIZ-RAMPASI-VE-GECISLER.md).
# Formül: kesimler müzik vuruşunda; giden klibin son 0.15 sn'si 4x hızlanır + yakınlaşır (1→1.3) + bulanıklaşır,
# gelen klibin ilk 0.15 sn'si 4x hızla başlar + uzaklaşır (1.3→1) + netleşir; gövde 0.6x yavaş. Tepe anında whoosh.
# Yazı minimal: açılışta küçük alt bant, sonda kapanış kartı (kullanıcı: "yazılar görüntüyü çok kapatıyor").
# KISIT: kaynak dikey 464x832 → yatay kadraj ~464x261'den büyütülüyor; yumuşak/düşük ayrıntılı. Gerçek kalite için
# yatay 4K60 çekim gerekir (arastirma/CEKIM-LISTESI-yatay.md).
# Çalıştır: .venv-capcut\Scripts\python.exe -X utf8 kurgu\yatay_rampa.py
import json
import os
import shutil
import subprocess
import sys

KOK = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
# Ayar: python yatay_rampa.py [ayar.json]  → {"ad": "...", "planlar": [[yol, bas, yc|null], ...], "hizli": 4, "yavas": 0.6}
AYAR = json.load(open(sys.argv[1], encoding="utf-8")) if len(sys.argv) > 1 else {}
AD = AYAR.get("ad", "yatay-rampa")
GECICI = os.path.join(KOK, "kurgu", "projeler", "yatay", AD)
CIKTI = os.path.join(KOK, "cikti", f"{AD}.mp4")
os.makedirs(GECICI, exist_ok=True)

W, H, FPS = 1920, 1080, 30
B = 0.4497                    # 135 BPM vuruş
D = 4 * B                     # her plan 4 vuruş → kesim vuruşta
R = 0.15                      # rampa süresi (çıktıda)
HIZLI, YAVAS = AYAR.get("hizli", 4.0), AYAR.get("yavas", 0.6)
R = AYAR.get("rampa", R)
RENK = "curves=all='0/0 0.12/0.14 0.5/0.53 0.85/0.84 1/0.97',eq=saturation=1.06,colorbalance=rs=0.05:bs=-0.05"

# (klip, kaynak başlangıç sn, kadraj merkezi y oranı) — tezgahsız mutfak (video0/2/4/10) ve hortumlu (video8) yok
PLANLAR = [(os.path.join(KOK, "capcut", "medya5", f"{a}.mp4"), b, y) for a, b, y in
           [("video11", 0.2, 0.45), ("video6", 0.1, 0.55), ("video1", 0.3, 0.50), ("video7", 0.4, 0.50),
            ("video5", 0.3, 0.50), ("video3", 0.3, 0.45), ("video9", 0.2, 0.55)]]
if AYAR.get("planlar"):
    PLANLAR = [(os.path.join(KOK, a), b, y) for a, b, y in AYAR["planlar"]]
ALT_BANT = AYAR.get("alt_bant", "İNZA · ŞEHRE BAKAN 3+1")
# Kesim başına geçiş (planlar arası, len = plan sayısı - 1). Verilmezse çeşitli bir sıra döngüsü kullanılır.
GECISLER = AYAR.get("gecisler") or [("itme", "whip_sag", "flas", "donme", "whip_yukari", "kesme")[k % 6]
                                    for k in range(len(PLANLAR) - 1)]
assert len(GECISLER) == len(PLANLAR) - 1, "gecisler sayısı = plan sayısı - 1 olmalı"
for _g in GECISLER:
    assert _g in ("itme", "whip_sag", "whip_yukari", "donme", "flas", "kesme"), _g
for _a, _b in zip(GECISLER, GECISLER[1:]):   # KURAL: aynı efekt arka arkaya YOK
    assert _a != _b, f"Kural ihlali: '{_a}' geçişi arka arkaya kullanılamaz"


def ff(*a):
    subprocess.run(["ffmpeg", "-v", "error", "-y", *a], check=True, cwd=GECICI)


# drawtext font yolu: ffmpeg'i parçalar klasöründe çalıştırıp göreli, ASCII "bebas.ttf" ver
shutil.copy(os.path.join(KOK, "varliklar", "font", "BebasNeue-Regular.ttf"), os.path.join(GECICI, "bebas.ttf"))
FONT = "bebas.ttf"


def kadraj(yc):
    if yc is None:   # kaynak zaten yatay: yalnız ölçek + renk
        return f"scale={W}:{H}:force_original_aspect_ratio=increase,crop={W}:{H},{RENK}"
    # 1080x1920 kaynaktan 1080x608 yatay şerit (merkez yc) → 1920x1080, hafif keskinleştirme
    y = int(max(0, min(1920 - 608, yc * 1920 - 304)))
    return f"crop=1080:608:0:{y},scale={W}:{H}:flags=lanczos,unsharp=5:5:0.6,{RENK}"


def zoom(z0, z1, n):
    # n karede z0→z1 yakınlaşma (merkezden), deterministik
    return (f"zoompan=z='{z0}+({z1}-{z0})*on/{max(n - 1, 1)}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)'"
            f":d=1:s={W}x{H}:fps={FPS}")


# --- Geçiş tipleri. KURAL (kullanıcı, 2026-11-09): aynı efekt ARKA ARKAYA kullanılamaz; sürekli aynı hız rampası olmaz.
GECIS_TIPLERI = ("itme", "whip_sag", "whip_yukari", "donme", "flas", "kesme")


def efekt(tip, yon, n):
    """Rampa parçasına (kadraj sonrası, 1920x1080) uygulanacak filtre. yon: 'giden' (klip sonu) | 'gelen' (klip başı)."""
    N = max(n - 1, 1)
    p = f"(n/{N})" if yon == "giden" else f"(1-n/{N})"        # 0→1 giden, 1→0 gelen (tepe = kesim anı)
    if tip == "itme":       # ileri yakınlaşarak hızlan (içinden geçme hissi)
        z0, z1 = (1.04, 1.35) if yon == "giden" else (1.3, 1.0)
        return f"{zoom(z0, z1, n)},gblur=sigma=15"
    if tip in ("whip_sag", "whip_yukari"):   # sert çevirme: 1.5x kadrajın içinde kayma + yönlü bulanıklık
        bw, bh = int(W * 1.5), int(H * 1.5)
        if tip == "whip_sag":   # görüş sağa savrulur: giden merkez→sağ kenar, gelen sol kenar→merkez
            x = f"{(bw - W) // 2}+{(bw - W) // 2}*n/{N}" if yon == "giden" else f"{(bw - W) // 2}*n/{N}"
            return f"scale={bw}:{bh},crop={W}:{H}:x='{x}':y={(bh - H) // 2},avgblur=sizeX=45:sizeY=1"
        y = f"{(bh - H) // 2}-{(bh - H) // 2}*n/{N}" if yon == "giden" else f"{bh - H}-{(bh - H) // 2}*n/{N}"
        return f"scale={bw}:{bh},crop={W}:{H}:x={(bw - W) // 2}:y='{y}',avgblur=sizeX=1:sizeY=45"
    if tip == "donme":      # dönme: ÖNCE 1.6x büyüt, döndür, SONRA ortadan kırp → köşede siyah yok
        # 16:9'da θ açısını örtmek için gereken ölçek = cosθ + (16/9)·sinθ; θ=0.25 rad → 1.41 < 1.6
        a = f"0.25*{p}" if yon == "giden" else f"-0.25*{p}"
        bw, bh = int(W * 1.6), int(H * 1.6)
        return (f"scale={bw}:{bh},rotate=a='{a}':ow={bw}:oh={bh}:fillcolor=black,"
                f"crop={W}:{H}:{(bw - W) // 2}:{(bh - H) // 2},gblur=sigma=10")
    if tip == "flas":       # beyaza parlayarak geç
        z0, z1 = (1.0, 1.08) if yon == "giden" else (1.08, 1.0)
        return f"{zoom(z0, z1, n)},eq=brightness='0.75*{p}':eval=frame,gblur=sigma=6"
    raise ValueError(tip)


def plan(i, ad, bas, yc, once, sonra):
    """once: bu plana GİRİŞ geçişi (None = ilk plan), sonra: ÇIKIŞ geçişi (None = son plan). 'kesme' = rampa yok."""
    src = ad
    gir = once not in (None, "kesme")
    cik = sonra not in (None, "kesme")
    govde = D - (R if gir else 0) - (R if cik else 0)
    parca, t, n_r = [], bas, int(round(R * FPS))
    if gir:   # gelen rampa: hızlı başla, geçişe özgü hareketle netleş
        ks = R * HIZLI
        parca.append(f"[0:v]trim={t:.3f}:{t + ks:.3f},setpts=(PTS-STARTPTS)/{HIZLI},fps={FPS},{kadraj(yc)},"
                     f"{efekt(once, 'gelen', n_r)}[p{len(parca)}]")
        t += ks
    ks = govde * YAVAS
    parca.append(f"[0:v]trim={t:.3f}:{t + ks:.3f},setpts=(PTS-STARTPTS)/{YAVAS},fps={FPS},{kadraj(yc)},"
                 f"{zoom(1.0, 1.04, int(round(govde * FPS)))}[p{len(parca)}]")
    t += ks
    if cik:   # giden rampa: hızlan, geçişe özgü hareketle bulanıklaş
        ks = R * HIZLI
        parca.append(f"[0:v]trim={t:.3f}:{t + ks:.3f},setpts=(PTS-STARTPTS)/{HIZLI},fps={FPS},{kadraj(yc)},"
                     f"{efekt(sonra, 'giden', n_r)}[p{len(parca)}]")
        t += ks
    fc = ";".join(parca) + ";" + "".join(f"[p{k}]" for k in range(len(parca))) + \
        f"concat=n={len(parca)}:v=1:a=0,trim=duration={D:.4f},format=yuv420p[v]"
    hedef = os.path.join(GECICI, f"{i:02d}.mp4")
    ff("-i", src, "-filter_complex", fc, "-map", "[v]", "-r", str(FPS), "-c:v", "libx264", "-crf", "18",
       "-preset", "fast", hedef)
    return hedef, t


def kapanis(hedef, sure=3.6):
    son_kare = os.path.join(GECICI, "son.jpg")
    ff("-sseof", "-0.1", "-i", os.path.join(GECICI, f"{len(PLANLAR) - 1:02d}.mp4"), "-frames:v", "1", son_kare)
    logo = os.path.join(KOK, "marka", "inza-logo-saydam.png")
    font = FONT
    vf = (f"[0:v]scale={W}:{H},gblur=sigma=18,eq=brightness=-0.38,vignette=PI/4,zoompan=z='1.08-0.08*on/{int(sure * FPS)}'"
          f":d=1:s={W}x{H}:fps={FPS}[z];[1:v]scale=520:-1[l];[z][l]overlay=(W-w)/2:250[o];"
          f"[o]drawtext=fontfile='{font}':text='YERİNDE GÖRÜN':fontsize=120:fontcolor=white:x=(w-tw)/2:y=640,"
          f"drawtext=fontfile='{font}':text='0 (5XX) XXX XX XX':fontsize=72:fontcolor=0xF2B526:x=(w-tw)/2:y=790,"
          f"fade=t=out:st={sure - 0.6}:d=0.6,format=yuv420p[v]")
    ff("-loop", "1", "-t", str(sure), "-i", son_kare, "-i", logo, "-filter_complex", vf, "-map", "[v]",
       "-r", str(FPS), "-c:v", "libx264", "-crf", "18", hedef)


def main():
    parcalar = []
    for i, (ad, bas, yc) in enumerate(PLANLAR):
        once = GECISLER[i - 1] if i > 0 else None
        sonra = GECISLER[i] if i < len(PLANLAR) - 1 else None
        h, kullanilan = plan(i, ad, bas, yc, once, sonra)
        parcalar.append(h)
        print(f"{os.path.basename(ad)}: kaynak {bas}→{kullanilan:.2f} sn · çıkış: {sonra or 'kapanış'}")
    kap = os.path.join(GECICI, "kapanis.mp4")
    kapanis(kap)
    parcalar.append(kap)
    liste = os.path.join(GECICI, "liste.txt")
    open(liste, "w", encoding="utf-8").write("".join(f"file '{p}'\n" for p in parcalar))
    sessiz = os.path.join(GECICI, "sessiz.mp4")
    ff("-f", "concat", "-safe", "0", "-i", liste, "-c", "copy", sessiz)
    toplam = len(PLANLAR) * D + 3.6

    # Ses: müzik + her kesimde whoosh (tepe = kesim anı), açılış alt bandı
    whoosh = os.path.join(KOK, "hyperframes", "ilan", "assets", "whoosh.wav")
    muzik = os.path.join(KOK, "muzik", "luxury-real-estate.mp3")
    kesimler = [k * D for k in range(1, len(PLANLAR) + 1)]
    girdiler = ["-i", sessiz, "-ss", "4", "-i", muzik]
    af = [f"[1:a]atrim=0:{toplam:.3f},afade=t=in:d=0.3,afade=t=out:st={toplam - 1.5:.3f}:d=1.5,volume=0.8[m]"]
    vurus = os.path.join(KOK, "hyperframes", "ilan", "assets", "impact.wav")
    # tip → (dosya, perde/hız çarpanı, ses, kesimden önce başlama sn) — aynı ses arka arkaya monoton olmasın
    SES = {"itme": (whoosh, 0.85, 0.48, 0.3), "whip_sag": (whoosh, 1.3, 0.48, 0.2), "whip_yukari": (whoosh, 1.15, 0.48, 0.22),
           "donme": (whoosh, 1.0, 0.5, 0.28), "flas": (vurus, 1.2, 0.42, 0.05), "kesme": (vurus, 0.9, 0.38, 0.02),
           "kapanis": (vurus, 1.0, 0.6, 0.02)}
    for j, k in enumerate(kesimler):
        dosya, oran, ses, once_sn = SES[GECISLER[j] if j < len(GECISLER) else "kapanis"]
        girdiler += ["-i", dosya]
        gecik = int(max(0, k - once_sn) * 1000)
        af.append(f"[{j + 2}:a]asetrate=44100*{oran},aresample=44100,volume={ses},adelay={gecik}|{gecik}[w{j}]")
    af.append("[m]" + "".join(f"[w{j}]" for j in range(len(kesimler))) +
              f"amix=inputs={len(kesimler) + 1}:normalize=0[a]")
    font = FONT
    BS = 2.5   # açılış bandı bitişi (Gemini: biraz daha uzun kalsın)
    alt_bant = (f"drawbox=x=80:y=880:w=560:h=110:color=0x16213E@0.75:t=fill:enable='between(t,0.3,{BS:.2f})',"
                f"drawtext=fontfile='{font}':text='{ALT_BANT}':fontsize=62:fontcolor=white:x=110:y=905:"
                f"alpha='if(lt(t,0.5),(t-0.3)/0.2,if(gt(t,{BS - 0.2:.2f}),({BS:.2f}-t)/0.2,1))':"
                f"enable='between(t,0.3,{BS:.2f})'")
    ff(*girdiler, "-filter_complex", ";".join(af) + f";[0:v]{alt_bant}[v]", "-map", "[v]", "-map", "[a]",
       "-c:v", "libx264", "-crf", "18", "-preset", "medium", "-c:a", "aac", "-b:a", "192k",
       "-movflags", "+faststart", CIKTI)
    print("yazıldı:", CIKTI, f"{toplam:.1f} sn")


if __name__ == "__main__":
    main()
