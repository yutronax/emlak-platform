# Geçiş motoru v2 — yatay (16:9), hız rampalı, BAĞLAYICILI geçişler.
# Kullanıcı (2026-11-10): "geçişler arası bağlayıcı yok, kesikli hissettiriyor". v1'in (yatay_rampa.py) üç kusuru düzeltildi:
#  1) Hız basamaklı sıçrıyordu (0.8x → 6x) → kademeli EĞRİ: 1.5x → 3x → 5x → 8x (gelen: 8 → 5 → 3 → 1.5).
#  2) Düz Gauss bulanıklığı → gerçek HAREKET İZİ: hızlı parçalarda ardışık kareler harmanlanır (tmix, hızla orantılı).
#  3) Klipler uç uca ekleniyordu → tepe anında geçişe özgü 4 karelik HARMANLAMA (xfade: smoothleft/zoomin/fadewhite...).
# KURAL (kullanıcı): aynı efekt arka arkaya YOK; kısa videoda (≤ 8 kesim) her geçiş tipi BİR kez; aynı AİLE yan yana YOK.
# Kesimler müzik vuruşunda (135 BPM, 4 vuruş/plan). Yazı minimal.
# Kullanım: .venv-capcut\Scripts\python.exe -X utf8 kurgu\gecis_motoru.py <brif.json>
import json
import os
import shutil
import subprocess
import sys

KOK = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
AYAR = json.load(open(sys.argv[1], encoding="utf-8"))
AD = AYAR["ad"]
GECICI = os.path.join(KOK, "kurgu", "projeler", "yatay", AD)
CIKTI = os.path.join(KOK, "cikti", f"{AD}.mp4")
os.makedirs(GECICI, exist_ok=True)

W, H, FPS = 1920, 1080, 30
B = 0.4497
D = AYAR.get("vurus", 4) * B                                   # plan süresi = 4 vuruş; kesimler k·D anlarında (vuruşta)
R = AYAR.get("rampa", 0.30)                 # her rampa (çıktı süresi)
YAVAS = AYAR.get("yavas", 0.8)
EGRI = AYAR.get("egri", [1.5, 3.0, 5.0, 8.0])   # giden rampa hız basamakları (gelen tersi)
OV = AYAR.get("harman", 6 / FPS)            # klipler arası harmanlama (bağlayıcı) süresi
RENK = "curves=all='0/0 0.12/0.14 0.5/0.53 0.85/0.84 1/0.97',eq=saturation=1.06,colorbalance=rs=0.05:bs=-0.05"
PLANLAR = [(os.path.join(KOK, a), b) for a, b, *_ in AYAR["planlar"]]
GECISLER = AYAR["gecisler"]
ALT_BANT = AYAR.get("alt_bant", "İNZA")

# tip → (aile, xfade harmanı, ses)
TIPLER = {
    "itme":        ("zoom",  "zoomin"),
    "whip_sag":    ("whip",  "smoothleft"),
    "whip_sol":    ("whip",  "smoothright"),
    "whip_yukari": ("whip",  "smoothup"),
    "donme":       ("donme", "radial"),
    "flas":        ("isik",  "fadewhite"),
    "sarsinti":    ("sars",  "dissolve"),
    "kesme":       ("kesme", "fade"),
}
# --- KURAL denetimi
assert len(GECISLER) == len(PLANLAR) - 1, "gecisler = plan sayısı - 1"
SERBEST = lambda g: isinstance(g, dict)      # Gemini'nin kendi yazdığı geçiş: {"ad","giden","gelen","harman","ses"}
for g in GECISLER:
    assert SERBEST(g) or g in TIPLER, f"bilinmeyen geçiş: {g}"
_adlar = [g["ad"] if SERBEST(g) else g for g in GECISLER]
for a, b in zip(GECISLER, GECISLER[1:]):
    if not (SERBEST(a) or SERBEST(b)):
        assert TIPLER[a][0] != TIPLER[b][0], f"Kural ihlali: aynı aile ('{TIPLER[a][0]}') yan yana: {a} → {b}"
assert len(set(_adlar)) == len(_adlar), f"Kural ihlali: geçiş tekrarı {_adlar}"
if any(SERBEST(g) for g in GECISLER):
    _h = [g["harman"] for g in GECISLER if SERBEST(g)]
    assert len(set(_h)) == len(_h), "Kural ihlali: iki geçiş aynı harman ifadesini kullanıyor"


def ff(*a):
    r = subprocess.run(["ffmpeg", "-v", "error", "-y", *a], cwd=GECICI, capture_output=True, text=True, encoding="utf-8", errors="replace")
    if r.returncode:   # sadece ffmpeg'in kendi hata satırları (komut dökümü değil) → düzeltme için okunur
        hata = "\n".join(l for l in r.stderr.splitlines() if "Fontconfig" not in l)
        raise SystemExit(f"FFMPEG HATASI ({a[-1]}):\n{hata[-1500:]}")


FONTLAR = {   # ad → kaynak (font seçimi briften: "font")
    "bebas":       os.path.join(KOK, "varliklar", "font", "BebasNeue-Regular.ttf"),   # dar, iri, afiş
    "segoe_kalin": "C:/Windows/Fonts/segoeuib.ttf",                                    # sade, modern
    "segoe_ince":  "C:/Windows/Fonts/segoeuisl.ttf",                                   # zarif, ince
    "bahnschrift": "C:/Windows/Fonts/bahnschrift.ttf",                                 # geometrik, mimari
    "georgia":     "C:/Windows/Fonts/georgiab.ttf",                                    # serif, klasik lüks
    "palatino":    "C:/Windows/Fonts/palab.ttf",                                       # serif, editoryal
}
shutil.copy(FONTLAR[AYAR.get("font", "bebas")], os.path.join(GECICI, "yazi.ttf"))
FONT = "yazi.ttf"
KADRAJ = f"scale={W}:{H}:force_original_aspect_ratio=increase,crop={W}:{H},{RENK}"


def zoom(z0, z1, n):
    return (f"zoompan=z='{z0}+({z1}-{z0})*on/{max(n - 1, 1)}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)'"
            f":d=1:s={W}x{H}:fps={FPS}")


def efekt(tip, yon, n):
    """Rampaya uygulanan kamera hareketi (1920x1080 üzerinde). yon: giden (0→1 tepe) | gelen (1→0)."""
    N = max(n - 1, 1)
    p = f"pow(n/{N},2)" if yon == "giden" else f"pow(1-n/{N},2)"   # tepeye doğru hızlanan (ease-in) şiddet
    if isinstance(tip, dict):
        z = (tip.get(yon) or "null").replace("{W}", str(W)).replace("{H}", str(H)).replace("{N}", str(N)).replace("{p}", f"({p})")
        return z + f",scale={W}:{H},setsar=1"
    if tip == "itme":
        return zoom(*((1.0, 1.7) if yon == "giden" else (1.6, 1.0)), n)
    if tip.startswith("whip"):
        bw, bh = int(W * 2.0), int(H * 2.0)          # 2x kadraj: savrulma mesafesi 960 px
        mx, my = (bw - W) // 2, (bh - H) // 2
        if tip == "whip_yukari":   # görüş yukarı savrulur: giden merkez→üst, gelen alt→merkez
            y = f"{my}-{my}*{p}" if yon == "giden" else f"{my}+{my}*{p}"
            return f"scale={bw}:{bh},crop={W}:{H}:x={mx}:y='{y}'"
        sag = tip == "whip_sag"
        if yon == "giden":
            x = f"{mx}+{mx}*{p}" if sag else f"{mx}-{mx}*{p}"
        else:
            x = f"{mx}-{mx}*{p}" if sag else f"{mx}+{mx}*{p}"
        return f"scale={bw}:{bh},crop={W}:{H}:x='{x}':y={my}"
    if tip == "donme":       # 1.6x büyüt → döndür → ortadan kırp (köşe siyahı yok)
        a = f"0.35*{p}" if yon == "giden" else f"-0.35*{p}"   # 0.35 rad örtme ölçeği 1.55 < 1.8
        bw, bh = int(W * 1.8), int(H * 1.8)
        return (f"scale={bw}:{bh},rotate=a='{a}':ow={bw}:oh={bh}:fillcolor=black,"
                f"crop={W}:{H}:{(bw - W) // 2}:{(bh - H) // 2}")
    if tip == "flas":
        return f"{zoom(*((1.0, 1.1) if yon == 'giden' else (1.1, 1.0)), n)},eq=brightness='0.7*{p}':eval=frame"
    if tip == "sarsinti":     # deterministik titreşim (sinüs), şiddet tepeye doğru artar
        bw, bh = int(W * 1.12), int(H * 1.12)
        mx, my = (bw - W) // 2, (bh - H) // 2
        return (f"scale={bw}:{bh},crop={W}:{H}:x='{mx}+{mx}*sin(n*2.7)*{p}':y='{my}+{my}*cos(n*3.1)*{p}'")
    raise ValueError(tip)


def rampa(t, yon, tip, etiket):
    """Kademeli hız eğrisi + hareket izi. Döndürür: (filtre zinciri metni, kullanılan kaynak sn)."""
    hizlar = EGRI if yon == "giden" else EGRI[::-1]
    d = R / len(hizlar)
    zincir, alt = [], []
    for k, h in enumerate(hizlar):
        ks = d * h
        iz = max(1, round(h / 1.5))                       # hızla orantılı kare harmanı = hareket izi
        tm = f"tmix=frames={iz}," if iz > 1 else ""
        zincir.append(f"[0:v]trim={t:.4f}:{t + ks:.4f},setpts=PTS-STARTPTS,{tm}setpts=PTS/{h},fps={FPS}[{etiket}{k}]")
        alt.append(f"[{etiket}{k}]")
        t += ks
    n = int(round(R * FPS))
    iz = "" if tip == "flas" else ",tmix=frames=4:weights='1 2 3 4'"   # hareketli kadrajın izi (yön bulanıklığı)
    zincir.append("".join(alt) + f"concat=n={len(hizlar)}:v=1:a=0,{KADRAJ},{efekt(tip, yon, n)}{iz}[{etiket}]")
    return ";".join(zincir), t


def plan(i, src, bas, once, sonra):
    gir = once not in (None, "kesme")
    cik = sonra not in (None, "kesme")
    uzunluk = D + (OV if sonra else 0)          # sonraki harman için OV kadar fazla (vuruş hizası korunur)
    govde = uzunluk - (R if gir else 0) - (R if cik else 0)
    parca, t, adlar = [], bas, []
    if gir:
        z, t = rampa(t, "gelen", once, "g")
        parca.append(z), adlar.append("[g]")
    ks = govde * YAVAS
    parca.append(f"[0:v]trim={t:.4f}:{t + ks:.4f},setpts=(PTS-STARTPTS)/{YAVAS},fps={FPS},{KADRAJ},"
                 f"{zoom(1.0, 1.04, int(round(govde * FPS)))}[b]")
    adlar.append("[b]")
    t += ks
    if cik:
        z, t = rampa(t, "giden", sonra, "c")
        parca.append(z), adlar.append("[c]")
    fc = ";".join(parca) + ";" + "".join(adlar) + f"concat=n={len(adlar)}:v=1:a=0,setpts=N/({FPS}*TB),tpad=stop_mode=clone:stop_duration=0.5,format=yuv420p[v]"
    hedef = f"{i:02d}.mp4"
    ff("-i", src, "-filter_complex", fc, "-map", "[v]", "-r", str(FPS), "-frames:v", str(int(round(uzunluk * FPS))),
       "-c:v", "libx264", "-crf", "17", "-preset", "fast", hedef)
    return hedef, t, uzunluk


def muzik_kredi():
    """Seçilen müzik CC BY ise katalogdaki kredi satırı (kapanışta yazılır)."""
    kp = os.path.join(KOK, "muzik", "katalog.json")
    if not os.path.exists(kp):
        return ""
    ad = os.path.basename(AYAR.get("muzik", "muzik/luxury-real-estate.mp3"))
    return next((e.get("kredi", "") for e in json.load(open(kp, encoding="utf-8")) if e["dosya"] == ad), "").replace(":", "\\:")


def kapanis(son_plan, sure=3.6):
    ff("-sseof", "-0.1", "-i", son_plan, "-frames:v", "1", "son.jpg")
    shutil.copy(os.path.join(KOK, "marka", "inza-logo-saydam.png"), os.path.join(GECICI, "logo.png"))
    vf = (f"[0:v]scale={W}:{H},gblur=sigma=18,eq=brightness=-0.38,vignette=PI/4,"
          f"zoompan=z='1.08-0.08*on/{int(sure * FPS)}':d=1:s={W}x{H}:fps={FPS}[z];[1:v]scale=520:-1[l];"
          f"[z][l]overlay=(W-w)/2:250[o];"
          f"[o]drawtext=fontfile='{FONT}':text='YERİNDE GÖRÜN':fontsize=120:fontcolor=white:x=(w-tw)/2:y=640,"
          f"drawtext=fontfile='{FONT}':text='0 (5XX) XXX XX XX':fontsize=72:fontcolor=0xF2B526:x=(w-tw)/2:y=790,"
          + (f"drawtext=fontfile='{FONT}':text='Seslendirme yapay zekâ ile üretildi':fontsize=30:fontcolor=white@0.7:x=(w-tw)/2:y=980,"
             if AYAR.get("seslendirme") else "") +
          (f"drawtext=fontfile='{FONT}':text='{muzik_kredi()}':fontsize=26:fontcolor=white@0.6:x=(w-tw)/2:y=1025,"
             if muzik_kredi() else "") +
          f"fade=t=out:st={sure - 0.6}:d=0.6,format=yuv420p[v]")
    ff("-loop", "1", "-framerate", str(FPS), "-t", str(sure), "-i", "son.jpg", "-i", "logo.png", "-filter_complex", vf, "-map", "[v]",
       "-r", str(FPS), "-c:v", "libx264", "-crf", "17", "kapanis.mp4")
    return "kapanis.mp4", sure


# ---------- STİLLER: her video farklı bir renk tonu + yazı animasyonu seçer ----------
RENKLER = {
    "sicak":   "curves=master='0/0.02 0.25/0.23 0.5/0.5 0.8/0.79 1/0.93',colorbalance=rs=0.02:bs=-0.03:rm=0.03:bm=-0.02:rh=0.02:bh=-0.03,"
               "eq=contrast=1.05:saturation=1.1,vignette=angle=PI/5,",
    "soguk":   "curves=master='0/0.02 0.5/0.5 1/0.95',colorbalance=rs=-0.02:bs=0.04:rm=-0.01:bm=0.02:rh=-0.01:bh=0.02,"
               "eq=contrast=1.07:saturation=0.95,",
    "film":    "curves=master='0/0.06 0.3/0.27 0.7/0.72 1/0.92',colorbalance=rs=-0.04:bs=0.05:rh=0.05:bh=-0.04,"
               "eq=saturation=0.9,noise=alls=6:allf=t,vignette=angle=PI/4,",
    "yumusak": "curves=master='0/0.08 0.5/0.55 1/0.94',eq=contrast=0.94:saturation=0.85:brightness=0.02,",
    "yok":     "",
}


def _alfa(t0, t1, gir=0.3, cik=0.2):
    return f"if(lt(t,{t0 + gir:.3f}),(t-{t0:.3f})/{gir},if(gt(t,{t1 - cik:.3f}),({t1:.3f}-t)/{cik},1))"


def yazi_kayan(metin, t0, t1):          # altın çubuk + soldan kayarak açılış
    ac = f"pow(max(0,1-(t-{t0:.3f})/0.45),3)"
    en = f"enable='between(t,{t0:.3f},{t1:.3f})'"
    return (f"drawbox=x=96:y=150:w=8:h=96:color=0xF2B526@0.95:t=fill:{en},"
            f"drawtext=fontfile='{FONT}':text='{metin}':fontsize=88:fontcolor=white:shadowcolor=black@0.55:shadowx=0:shadowy=4:"
            f"x='128-60*{ac}':y=152:alpha='{_alfa(t0, t1)}':{en},")


def yazi_daktilo(metin, t0, t1):        # harf harf yazılır
    out, adim = "", 0.055
    for i in range(1, len(metin) + 1):
        a = t0 + (i - 1) * adim
        b = t0 + i * adim if i < len(metin) else t1
        out += (f"drawtext=fontfile='{FONT}':text='{metin[:i]}':fontsize=84:fontcolor=white:shadowcolor=black@0.6:shadowy=4:"
                f"x=110:y=150:alpha='if(gt(t,{t1 - 0.2:.3f}),({t1:.3f}-t)/0.2,1)':enable='between(t,{a:.3f},{b:.3f})',")
    return out


def yazi_cizgi(metin, t0, t1):          # altın çizgi soldan çizilir, yazı üstünde belirir
    en = f"enable='between(t,{t0:.3f},{t1:.3f})'"
    return (f"drawbox=x=110:y=250:w='max(1,min(460,(t-{t0:.3f})*1500))':h=4:color=0xF2B526@0.95:t=fill:{en},"
            f"drawtext=fontfile='{FONT}':text='{metin}':fontsize=78:fontcolor=white:shadowcolor=black@0.5:shadowy=3:"
            f"x=110:y='170+14*pow(max(0,1-(t-{t0 + 0.15:.3f})/0.4),2)':alpha='{_alfa(t0 + 0.15, t1)}':{en},")


def yazi_dev(metin, t0, t1):            # iri, yarı saydam, yavaşça sağa süzülen başlık (üst bant)
    en = f"enable='between(t,{t0:.3f},{t1:.3f})'"
    return (f"drawtext=fontfile='{FONT}':text='{metin}':fontsize=170:fontcolor=white:"
            f"x='96+28*(t-{t0:.3f})':y=90:alpha='0.55*({_alfa(t0, t1, 0.4, 0.3)})':{en},")


YAZILAR = {"kayan": yazi_kayan, "daktilo": yazi_daktilo, "cizgi": yazi_cizgi, "dev": yazi_dev}


def stiller():
    if AYAR.get("renk_filtre") or AYAR.get("yazi_filtre"):     # serbest stil: ham metin karşılaştırılır
        return AYAR.get("renk_filtre", "-"), AYAR.get("yazi_filtre", "-"), AYAR.get("muzik", "muzik/luxury-real-estate.mp3")
    r = AYAR.get("renk", "yok")
    r = "sicak" if r is True else ("yok" if r is False else r)
    return r, AYAR.get("yazi_stili", "kayan"), AYAR.get("muzik", "muzik/luxury-real-estate.mp3")


def stil_katmanlari():
    if AYAR.get("renk_filtre") or AYAR.get("yazi_filtre"):
        renk = (AYAR.get("renk_filtre", "").rstrip(",") + ",") if AYAR.get("renk_filtre") else ""
        sab = AYAR.get("yazi_filtre")
        yazi = ""
        for k, m in AYAR.get("yazilar", []):
            t0, t1 = k * D + 0.25, (k + 1) * D + OV - 0.1
            if sab:
                yazi += (sab.replace("{FONT}", FONT).replace("{metin}", m).replace("{t0}", f"{t0:.3f}")
                         .replace("{t1}", f"{t1:.3f}").rstrip(",") + ",")
            else:
                yazi += YAZILAR["kayan"](m, t0, t1)
        return renk, yazi
    r, y, _ = stiller()
    yazi = "".join(YAZILAR[y](m, k * D + 0.25, (k + 1) * D + OV - 0.1) for k, m in AYAR.get("yazilar", []))
    return RENKLER[r], yazi


# ---------- KULLANIM GEÇMİŞİ: son 2 videonun renk/yazı stili tekrar edilemez ----------
GECMIS = os.path.join(KOK, "kurgu", "gecmis.json")


def gecmis_oku():
    return json.load(open(GECMIS, encoding="utf-8")) if os.path.exists(GECMIS) else []


def gecmis_denetle():
    r, y, m = stiller()
    son = [e for e in gecmis_oku() if e["ad"] != AD][-2:]
    if AYAR.get("tekrar_izin"):
        return
    for alan, deger in (("renk", r), ("yazi_stili", y)):
        kullanan = [e["ad"] for e in son if e.get(alan) == deger]
        assert not kullanan, f"KURAL: '{alan}={deger}' son videolarda kullanıldı ({kullanan}). Başka stil seç ya da brife \"tekrar_izin\": true ekle."
    if any(e.get("muzik") == m for e in son):
        print(f"UYARI: müzik '{m}' son videolarda da kullanıldı (havuzda yeni müzik yok).")


def gecmis_yaz():
    r, y, m = stiller()
    g = [e for e in gecmis_oku() if e["ad"] != AD]
    g.append({"ad": AD, "renk": r, "yazi_stili": y, "muzik": m, "gecisler": GECISLER})
    json.dump(g, open(GECMIS, "w", encoding="utf-8"), ensure_ascii=False, indent=2)


def main():
    gecmis_denetle()
    dosyalar, uzunluklar = [], []
    for i, (src, bas) in enumerate(PLANLAR):
        once = GECISLER[i - 1] if i else None
        sonra = GECISLER[i] if i < len(GECISLER) else None
        h, son_t, u = plan(i, src, bas, once, sonra)
        dosyalar.append(h), uzunluklar.append(u)
        print(f"{os.path.basename(src)}: kaynak {bas}→{son_t:.2f} sn · çıkış: {sonra or 'kapanış'}")
    k, ks = kapanis(dosyalar[-1])
    dosyalar.append(k), uzunluklar.append(ks)
    olc = lambda f: float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f],
                                          capture_output=True, text=True, cwd=GECICI).stdout)
    gercek = [olc(f) for f in dosyalar]
    for f, u, g in zip(dosyalar, uzunluklar, gercek):
        assert abs(u - g) < 1.5 / FPS, f"{f}: beklenen {u:.3f} sn, ölçülen {g:.3f} sn"
    uzunluklar = gercek

    # Bağlayıcı: planlar xfade ile, tepe anında birleşir. Ofsetler k·D (vuruş) olacak şekilde hesaplanır.
    # 'kesme' de OV süreli harman ama ortada SERT geçiş (custom ifade): tüm birleşimler eşit uzun → vuruş hizası sabit
    harmanlar = [(g if isinstance(g, dict) else TIPLER[g][1], OV) for g in GECISLER] + [("fade", 0.25)]
    girdi = []
    for f in dosyalar:
        girdi += ["-i", f]
    fc, onceki, cur = [], "[0:v]", uzunluklar[0]
    for j, (tur, sure) in enumerate(harmanlar, start=1):
        ofset = cur - (sure if j < len(harmanlar) else 0.25)
        if j == len(harmanlar):          # son plan (OV fazlası yok) → kapanış harmanı, plan sonundan 0.25 önce
            ofset = cur - 0.25
        if j <= len(GECISLER) and GECISLER[j - 1] == "kesme":
            gecis = "transition=custom:expr='if(gt(P,0.5),A,B)'"      # P: 1→0; yarıda sert kesim
        elif isinstance(tur, dict):
            gecis = f"transition=custom:expr='{tur['harman']}'"
        else:
            gecis = f"transition={tur}"
        fc.append(f"{onceki}[{j}:v]xfade={gecis}:duration={sure:.4f}:offset={ofset:.4f}[x{j}]")
        onceki = f"[x{j}]"
        cur = ofset + uzunluklar[j]
    toplam = cur
    BS = 2.5
    alt_bant = (f"drawbox=x=80:y=880:w=560:h=110:color=0x16213E@0.75:t=fill:enable='between(t,0.3,{BS})',"
                f"drawtext=fontfile='{FONT}':text='{ALT_BANT}':fontsize=62:fontcolor=white:x=110:y=905:"
                f"alpha='if(lt(t,0.5),(t-0.3)/0.2,if(gt(t,{BS - 0.2}),({BS}-t)/0.2,1))':enable='between(t,0.3,{BS})'")
    renk, yazi = stil_katmanlari()
    fc.append(f"{onceki}{renk}{yazi}{alt_bant},format=yuv420p[v]")

    # Ses: müzik + geçişe özgü ses, tepe (harman ortası) k·D + OV/2 anında
    whoosh = os.path.join(KOK, "hyperframes", "ilan", "assets", "whoosh.wav")
    vurus = os.path.join(KOK, "hyperframes", "ilan", "assets", "impact.wav")
    SES = {"itme": (whoosh, 0.85, 0.5, 0.3), "whip_sag": (whoosh, 1.3, 0.5, 0.2), "whip_sol": (whoosh, 1.2, 0.5, 0.2),
           "whip_yukari": (whoosh, 1.1, 0.5, 0.22), "donme": (whoosh, 0.95, 0.5, 0.28), "flas": (vurus, 1.2, 0.42, 0.04),
           "sarsinti": (vurus, 0.8, 0.45, 0.04), "kesme": (vurus, 0.9, 0.38, 0.02), "kapanis": (vurus, 1.0, 0.6, 0.02)}
    sesler = GECISLER + ["kapanis"]
    gir_a = ["-ss", str(AYAR.get("muzik_bas", 4)), "-i", os.path.join(KOK, stiller()[2])]
    n_v = len(dosyalar)
    af = [f"[{n_v}:a]atrim=0:{toplam:.3f},afade=t=in:d=0.3,afade=t=out:st={toplam - 1.5:.3f}:d=1.5,volume=0.8,aresample=44100,aformat=channel_layouts=stereo[m]"]
    for j, tip in enumerate(sesler):
        if isinstance(tip, dict):
            sx = tip.get("ses") or {}
            dosya, oran, ses, once_sn = (vurus if sx.get("tur") == "vurus" else whoosh), float(sx.get("oran", 1.0)), \
                float(sx.get("ses", 0.45)), (0.03 if sx.get("tur") == "vurus" else 0.25)
        else:
            dosya, oran, ses, once_sn = SES[tip]
        gir_a += ["-i", dosya]
        tepe = (j + 1) * D + OV / 2
        gec = int(max(0, tepe - once_sn) * 1000)
        af.append(f"[{n_v + 1 + j}:a]asetrate=44100*{oran},aresample=44100,volume={ses},adelay={gec}|{gec}[w{j}]")
    vo = AYAR.get("seslendirme")
    if vo:   # v3 katman 3 — SESLENDİRME: müzik konuşma altında kısılır (sidechain), sonra yayın seviyesine (-14 LUFS)
        gir_a += ["-i", os.path.join(KOK, vo)]
        vb = int(AYAR.get("seslendirme_bas", 3.0) * 1000)
        n_vo = n_v + 1 + len(sesler)
        af.append(f"[{n_vo}:a]aresample=44100,aformat=channel_layouts=stereo,highpass=f=80,"
                  f"acompressor=threshold=0.1:ratio=3,volume=1.6,adelay={vb}|{vb},apad=whole_dur={toplam:.3f},asplit[vo][yan]")
        af.append("[m][yan]sidechaincompress=threshold=0.03:ratio=8:attack=20:release=400[md]")
        af.append("[md]" + "".join(f"[w{j}]" for j in range(len(sesler))) + "[vo]"
                  + f"amix=inputs={len(sesler) + 2}:normalize=0,loudnorm=I=-14:TP=-1.5:LRA=9,aresample=44100[a]")
    else:
        af.append("[m]" + "".join(f"[w{j}]" for j in range(len(sesler))) + f"amix=inputs={len(sesler) + 1}:normalize=0[a]")
    ff(*girdi, *gir_a, "-filter_complex", ";".join(fc + af), "-map", "[v]", "-map", "[a]",
       "-c:v", "libx264", "-crf", "18", "-preset", "medium", "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart",
       "-t", f"{toplam:.3f}", CIKTI)
    gecmis_yaz()
    print("yazıldı:", CIKTI, f"{toplam:.1f} sn")


if __name__ == "__main__":
    main()
