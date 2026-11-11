# Kurgu motoru: brif JSON → HyperFrames projesi (index.html + hazır klipler) → check → snapshot → render.
# Kurallar: kurgu/SABLONLAR.md (güvenli alan, katman sırası, tipografi, ses). Şu an uygulanan şablon: ilan_turu (A/B).
# Kullanım: python -X utf8 kurgu/kur.py kurgu/brifler/<brif>.json [--render] [--varyant A|B]
import json
import os
import shutil
import subprocess
import sys

KOK = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))           # video-calisma
NODE = os.path.join(os.environ["LOCALAPPDATA"], r"Microsoft\WinGet\Packages\OpenJS.NodeJS.LTS_Microsoft.Winget.Source_8wekyb3d8bbwe\node-v24.20.0-win-x64")
EDGE = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
HF = "hyperframes@0.9.11"

W, H = 1080, 1920
GUVENLI = dict(ust=220, alt=440, sol=72, sag=150)          # SABLONLAR.md → Kanvas ve güvenli alan
YAZI_ALT_SINIR = H - 480                                     # altyazı bandının alt kenarı ≤ 1440
Z = dict(medya=10, ton=20, broll=30, grafik=40, yazi=50, marka=60, efekt=70)
RENK = dict(murekkep="#FFFFFF", altin="#F2B526", lacivert="#16213E")
B = 0.4497                                                  # 135 BPM vuruş aralığı

# Renk düzeltme (Cory Malveaux yöntemi): gölgeler +, highlights − (pencere patlamasın), hafif S-eğrisi, siyah kaldırılmaz
# Tur 2 (Gemini): boş daire soğuk/inşaat hissi veriyordu → sıcaklık + hafif doygunluk ("yaşanabilir" ton)
RENK_DUZELT = ("curves=all='0/0 0.12/0.14 0.5/0.53 0.85/0.84 1/0.97',"
               "eq=saturation=1.06:gamma=1.04,colorbalance=rs=0.05:gs=0.01:bs=-0.05:rm=0.03:bm=-0.03:rh=0.02")


def calistir(komut, cwd=None):
    env = dict(os.environ, PATH=NODE + os.pathsep + os.environ["PATH"], HYPERFRAMES_BROWSER_PATH=EDGE)
    if isinstance(komut, list) and komut[0] == "npx":
        komut = [os.path.join(NODE, "npx.cmd")] + komut[1:]
    r = subprocess.run(komut, cwd=cwd, env=env, capture_output=True, text=True, encoding="utf-8", errors="replace",
                       shell=isinstance(komut, str))
    return r.returncode, (r.stdout or "") + (r.stderr or "")


def klip_hazirla(p, hedef, sure):
    """Çekimi tam süresine kırpar, hızını uygular, renk düzeltir, 1080x1920/30fps sessiz mp4 yazar."""
    src = os.path.join(KOK, p["src"])
    hiz = p.get("hiz", 1.0)
    # kirp_ust: kadrajın üst kısmını (tavan kablosu vb.) dışarıda bırak; parlak: oda ışığını eşitle
    k_, ka = p.get("kirp_ust", 0.0), p.get("kirp_alt", 0.0)    # kirp_alt: alttaki kusuru (inşaat demiri vb.) dışarıda bırak
    if k_ or ka:
        kadraj = (f"scale={W}:{int(H*(1+k_+ka))}:force_original_aspect_ratio=increase,"
                  f"crop={W}:{H}:(iw-{W})/2:{'ih-' + str(H) + '-' + str(int(H*ka)) if k_ else '0'}")
    else:
        kadraj = f"scale={W}:{H}:force_original_aspect_ratio=increase,crop={W}:{H}"
    renk = RENK_DUZELT + (f",eq=brightness={p['parlak']}" if p.get("parlak") else "")
    if p.get("sabitle"):   # el çekimi titremesi (Gemini: "kamera titrek") → ffmpeg deshake, kenarı kadraj kırpar
        kadraj = "deshake=rx=32:ry=32," + kadraj
    if src.lower().endswith((".jpg", ".png")):
        vf = f"{kadraj},{renk},format=yuv420p"
        k = ["ffmpeg", "-v", "error", "-y", "-loop", "1", "-i", src, "-t", f"{sure:.3f}", "-r", "30", "-vf", vf]
    elif p.get("rampa"):
        # Velocity: hedefin %25'i 2.5x, %50'si 0.6x, %25'i 2.5x; kaynaktan ardışık parçalar (kesintisiz)
        b0, parcalar, kay = float(p.get("bas", 0)), [], 0.0
        for j, (oran, h) in enumerate(((0.25, 2.5), (0.5, 0.6), (0.25, 2.5))):
            ks = sure * oran * h
            parcalar.append(f"[0:v]trim=start={b0 + kay:.3f}:end={b0 + kay + ks:.3f},setpts=(PTS-STARTPTS)/{h}[r{j}]")
            kay += ks
        fc = ";".join(parcalar) + f";[r0][r1][r2]concat=n=3:v=1:a=0,{kadraj},{renk},fps=30,format=yuv420p[v]"
        k = ["ffmpeg", "-v", "error", "-y", "-i", src, "-filter_complex", fc, "-map", "[v]", "-t", f"{sure:.3f}", "-an"]
    else:
        vf = f"setpts=PTS/{hiz},{kadraj},{renk},fps=30,format=yuv420p"
        k = ["ffmpeg", "-v", "error", "-y", "-ss", str(p.get("bas", 0)), "-i", src, "-t", f"{sure:.3f}", "-an",
             "-vf", vf]
    k += ["-c:v", "libx264", "-crf", "16", "-preset", "fast", hedef]
    kod, cikti = calistir(k)
    if kod:
        raise RuntimeError(f"ffmpeg {p['src']}: {cikti}")
    # kaynak yetmediyse süre kısa çıkar → kontrol
    kod, d = calistir(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", hedef])
    if float(d.strip()) < sure - 0.1:
        raise RuntimeError(f"{p['src']}: kaynak yetmiyor ({float(d):.2f} < {sure:.2f} sn); bas/hiz/vurus düşür")


def altyazi_bandi(konu):
    """Özne karşı bandı: özne altta → üst band; aksi halde alt band (alt kenar ≤ YAZI_ALT_SINIR)."""
    return "ust" if konu == "alt" else "alt"


def html_uret(brif, varyant, planlar, kapanis_t, son):
    css_var = "\n".join(f"        --{k}: {v};" for k, v in RENK.items())
    kart_css = (f"background: rgba(22,33,62,0.88); padding: 22px 36px 26px; border-radius: 18px;"
                if varyant in ("A", "C") else "padding: 0; text-shadow: 0 6px 28px rgba(0,0,0,0.75);")
    yazi_boyut = {"A": 64, "B": 72, "C": 68}[varyant]
    hareketli = varyant == "C"
    parca, js = [], []

    for i, p in enumerate(planlar):
        t0, d = p["_t"], p["_d"]
        parca.append(f'      <video id="v{i}" class="clip medya" src="assets/p{i}.mp4" muted playsinline '
                     f'data-start="{t0:.3f}" data-duration="{d:.3f}" data-media-start="0"></video>')
        # Tur 2 (Gemini): kayma geçişi "slayt gösterisi" gibiydi → mekân değişimi düz kesim + itmeden oturma;
        # tek tween (check: overlapping_gsap_tweens) — itme varsa başlangıç ölçeği +0.06 ve ease power2.out
        itme = p.get("gecis") == "kay" and i > 0
        z0 = p.get("z0", 1.0) + (0.06 if itme else 0)
        js.append(f'      tl.fromTo("#v{i}", {{scale: {z0:.3f}}}, {{scale: {p.get("z1", 1.06)}, '
                  f'duration: {d:.3f}, ease: "{"power2.out" if itme else "none"}"}}, {t0:.3f});')
        if hareketli and i > 0:   # C: her kesimde "pull-in": bulanıktan netleşme (ölçek tween'iyle çakışmaz: filter)
            js.append(f'      tl.fromTo("#v{i}", {{filter: "blur(14px) brightness(1.25)"}}, {{filter: "blur(0px) brightness(1)", duration: 0.28, ease: "power2.out"}}, {t0:.3f});')
        if i == 0:      # açılış başlığı
            satirlar = "".join(f'<div class="satir"><span class="baslik{" altin" if k == len(brif["baslik"]) - 1 else ""}">{s}</span></div>'
                               for k, s in enumerate(brif["baslik"]))
            bant = altyazi_bandi(p.get("konu", "orta"))
            parca.append(f'      <div id="y{i}" class="clip yazi bant-{bant}" data-start="{t0:.3f}" data-duration="{d:.3f}">'
                         f'<div class="kutu baslik-kutu">{satirlar}</div></div>')
            js.append(f'      tl.fromTo("#y{i} .baslik", {{scale: 1.04}}, {{scale: 1, '
                      f'duration: 1.2, ease: "power2.out"}}, 0);   // ilk karede görünür (kapak)')
            js.append(f'      tl.to("#y{i}", {{opacity: 0, duration: 0.2}}, {t0 + d - 0.22:.3f});')
        elif p.get("yazi"):
            bant = altyazi_bandi(p.get("konu", "orta"))
            parca.append(f'      <div id="y{i}" class="clip yazi bant-{bant}" data-start="{t0:.3f}" data-duration="{d:.3f}">'
                         f'<div class="kutu"><span class="cizgi"></span><span class="altyazi">{p["yazi"]}</span></div></div>')
            if hareketli:
                js.append(f'      tl.fromTo("#y{i} .kutu", {{scale: 0.6, opacity: 0}}, {{scale: 1, opacity: 1, duration: 0.4, '
                          f'ease: "back.out(2.2)"}}, {t0 + 0.15:.3f});')
            else:
                js.append(f'      tl.fromTo("#y{i} .kutu", {{y: 40, opacity: 0}}, {{y: 0, opacity: 1, duration: 0.35, '
                          f'ease: "power3.out"}}, {t0 + 0.15:.3f});')
            js.append(f'      tl.fromTo("#y{i} .cizgi", {{width: 0}}, {{width: 90, duration: 0.45, ease: "power3.out"}}, {t0 + 0.25:.3f});')
            js.append(f'      tl.to("#y{i} .kutu", {{opacity: 0, y: -16, duration: 0.2}}, {t0 + d - 0.22:.3f});')

    # Kapanış
    k = brif["kapanis"]
    kd = son - kapanis_t
    parca.append(f'      <video id="vk" class="clip medya" src="assets/kapanis.mp4" muted playsinline '
                 f'data-start="{kapanis_t:.3f}" data-duration="{kd:.3f}" data-media-start="0"></video>')
    parca.append(f'      <div id="kton" class="clip ton-koyu" data-start="{kapanis_t:.3f}" data-duration="{kd:.3f}"></div>')
    parca.append(f'      <div id="kap" class="clip yazi" data-start="{kapanis_t:.3f}" data-duration="{kd:.3f}">'
                 f'<img id="klogo" src="assets/logo.png" alt="" />'
                 f'<div id="kfiyat">{k["fiyat"]}</div><div id="kcagri">{k["cagri"]}</div>'
                 f'<div id="ktel">{k["tel"]}</div></div>')
    js += [f'      tl.fromTo("#vk", {{scale: 1.0}}, {{scale: 1.05, duration: {kd:.3f}, ease: "none"}}, {kapanis_t:.3f});',
           f'      tl.fromTo("#kton", {{opacity: 0}}, {{opacity: 1, duration: 0.5}}, {kapanis_t:.3f});',
           f'      tl.fromTo("#klogo", {{opacity: 0, scale: 0.9}}, {{opacity: 1, scale: 1, duration: 0.6, ease: "power3.out"}}, {kapanis_t + 0.2:.3f});',
           f'      tl.fromTo("#kfiyat", {{opacity: 0, y: 30}}, {{opacity: 1, y: 0, duration: 0.45, ease: "power3.out"}}, {kapanis_t + 0.6:.3f});',
           f'      tl.fromTo("#kcagri", {{opacity: 0, y: 30}}, {{opacity: 1, y: 0, duration: 0.45, ease: "power3.out"}}, {kapanis_t + 0.85:.3f});',
           f'      tl.fromTo("#ktel", {{opacity: 0, y: 30}}, {{opacity: 1, y: 0, duration: 0.45, ease: "power3.out"}}, {kapanis_t + 1.1:.3f});']

    # Varyant B: kart yok → okunurluk için üst+alt gradyan (z20 ton katmanı)
    if varyant == "B":
        parca.append(f'      <div id="gradyan" class="clip" data-start="0" data-duration="{kapanis_t:.3f}" style="z-index:{Z["ton"]};background:linear-gradient(180deg,rgba(0,0,0,0.55) 0%,rgba(0,0,0,0) 32%,rgba(0,0,0,0) 52%,rgba(0,0,0,0.6) 80%,rgba(0,0,0,0.25) 100%)"></div>')
    # Marka filigranı ve efekt katmanı
    parca.append(f'      <img id="filigran" class="clip" src="assets/logo.png" alt="" data-start="0" data-duration="{kapanis_t:.3f}" />')
    parca.append(f'      <div id="isik" class="clip" data-start="0" data-duration="{son:.3f}"></div>')
    parca.append(f'      <div id="vinyet" class="clip" data-start="0" data-duration="{son:.3f}"></div>')
    isik_listesi = brif.get("isik_ler") or ([brif["isik_t"]] if brif.get("isik_t") is not None else [])
    if hareketli:
        parca.append(f'      <div id="flas" class="clip" data-start="0" data-duration="{son:.3f}" style="z-index:{Z["efekt"]};background:#fff;opacity:0;pointer-events:none"></div>')
        js += [f'      tl.fromTo("#flas", {{opacity: 0}}, {{opacity: 0.85, duration: 0.1}}, {kapanis_t - 0.1:.3f});',
               f'      tl.to("#flas", {{opacity: 0, duration: 0.4}}, {kapanis_t:.3f});']
    if isik_listesi:   # check: gsap_repeated_fromto_without_baseline → sabit başlangıç durumu
        js.append('      tl.set("#isik", {opacity: 0, x: 0}, 0);')
    for k_i, isik_t in enumerate(isik_listesi):
        js += [f'      tl.fromTo("#isik", {{opacity: 0, x: {-300 if k_i % 2 == 0 else 300}}}, {{opacity: 0.7, x: 0, duration: 0.35, ease: "power2.out"}}, {isik_t - 0.1:.3f});',
               f'      tl.to("#isik", {{opacity: 0, x: 250, duration: 0.5, ease: "power2.in"}}, {isik_t + 0.25:.3f});']
    # ilk kare kapak görselidir → siyahtan açılış YOK (check: first_frame_empty)
    js += [f'      tl.to("#root", {{opacity: 0, duration: 0.6}}, {son - 0.6:.3f});']

    # Ses
    parca.append(f'      <audio id="muzik" src="assets/muzik.mp3" data-start="0" data-duration="{son:.3f}" data-media-start="4" '
                 f'data-volume="0.8" data-fade-in="0.3" data-fade-out="1.4"></audio>')
    for j, (t, dosya, ses) in enumerate(brif.get("_sfx", [])):
        parca.append(f'      <audio id="sfx{j}" src="assets/{dosya}" data-start="{max(t, 0):.3f}" data-duration="0.7" data-volume="{ses}"></audio>')

    alt_bant_top = YAZI_ALT_SINIR - 260
    return f"""<!doctype html>
<html lang="tr" data-resolution="portrait">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width={W}, height={H}" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@600;800&display=block" rel="stylesheet" />
    <script src="https://cdn.jsdelivr.net/npm/gsap@3.15.0/dist/gsap.min.js"></script>
    <style>
      /* Şablon: ilan_turu / varyant {varyant} — kurallar kurgu/SABLONLAR.md */
      :root {{
{css_var}
      }}
      @font-face {{ font-family: "Bebas Neue"; src: url("assets/BebasNeue.ttf") format("truetype"); font-display: block; }}
      * {{ margin: 0; padding: 0; box-sizing: border-box; }}
      html, body {{ width: {W}px; height: {H}px; overflow: hidden; background: #000; }}
      #root {{ position: relative; width: 100%; height: 100%; overflow: hidden; font-family: "Montserrat", sans-serif; color: var(--murekkep); }}
      .clip {{ position: absolute; inset: 0; }}
      /* Katman sırası (değişmez) */
      .medya {{ z-index: {Z['medya']}; width: 100%; height: 100%; object-fit: cover; transform-origin: 50% 50%; }}
      .ton-koyu {{ z-index: {Z['ton']}; background: rgba(10,14,28,0.45); }}
      .yazi {{ z-index: {Z['yazi']}; pointer-events: none; }}
      #filigran {{ z-index: {Z['marka']}; inset: auto; top: {GUVENLI['ust'] - 60}px; right: {GUVENLI['sag'] - 40}px; width: 170px; opacity: 0.9; }}
      #isik {{ z-index: {Z['efekt']}; inset: -20%; opacity: 0; mix-blend-mode: screen; pointer-events: none;
        background: radial-gradient(40% 30% at 30% 40%, rgba(255,190,110,0.8), rgba(255,120,60,0.2) 45%, rgba(0,0,0,0) 70%); }}
      #vinyet {{ z-index: {Z['efekt']}; pointer-events: none; background: radial-gradient(80% 65% at 50% 50%, rgba(0,0,0,0) 60%, rgba(0,0,0,0.35) 100%); }}
      /* Yazı bandları: hepsi güvenli yazı bölgesi içinde (x {GUVENLI['sol']}–{W - GUVENLI['sag']}, y {GUVENLI['ust']}–{YAZI_ALT_SINIR}) */
      .bant-alt .kutu {{ position: absolute; left: {GUVENLI['sol']}px; max-width: {W - GUVENLI['sol'] - GUVENLI['sag']}px; bottom: {H - YAZI_ALT_SINIR}px; }}
      .bant-ust .kutu {{ position: absolute; left: {GUVENLI['sol']}px; max-width: {W - GUVENLI['sol'] - GUVENLI['sag']}px; top: {GUVENLI['ust'] + 80}px; }}
      .kutu {{ {kart_css} transform-origin: 0% 50%; }}
      .altyazi {{ display: block; font-weight: 600; font-size: {yazi_boyut}px; line-height: 1.15; }}
      .cizgi {{ display: block; height: 6px; width: 0; background: var(--altin); margin-bottom: 16px; border-radius: 3px; }}
      /* Tur 2 (Gemini): başlık da altyazıyla aynı kart dilinde (A) — tek tipografi sistemi */
      .baslik-kutu {{ {kart_css if varyant in ("A", "C") else "background: none; padding: 0; text-shadow: 0 6px 30px rgba(0,0,0,0.6);"} }}
      .satir {{ overflow: hidden; }}
      .baslik {{ display: inline-block; font-family: "Bebas Neue", sans-serif; font-size: 150px; line-height: 0.95; }}
      .altin {{ color: var(--altin); }}
      #kap {{ text-align: center; }}
      #klogo {{ position: absolute; left: 50%; top: {GUVENLI['ust'] + 120}px; width: 560px; margin-left: -280px; }}
      #kfiyat {{ position: absolute; left: 0; right: 0; top: 880px; font-family: "Bebas Neue", sans-serif; font-size: 160px; color: var(--altin); }}
      #kcagri {{ position: absolute; left: 0; right: 0; top: 1030px; font-family: "Bebas Neue", sans-serif; font-size: 110px; }}
      #ktel {{ position: absolute; left: 50%; top: 1170px; transform: translateX(-50%); white-space: nowrap; font-weight: 800; font-size: 76px;
        background: rgba(22,33,62,0.92); padding: 14px 40px; border-radius: 18px; }}
    </style>
  </head>
  <body>
    <div id="root" data-composition-id="main" data-start="0" data-duration="{son:.3f}" data-width="{W}" data-height="{H}">
{chr(10).join(parca)}
    </div>
    <script>
      const tl = gsap.timeline({{ paused: true }});
{chr(10).join(js)}
      window.__timelines = window.__timelines || {{}};
      window.__timelines["main"] = tl;
      tl.seek(0);
    </script>
  </body>
</html>
"""


def kur(brif_yolu, varyant=None, render=False):
    with open(brif_yolu, encoding="utf-8") as f:
        brif = json.load(f)
    varyant = varyant or brif.get("varyant", "A")
    ad = f"{brif['ad']}-{varyant}"
    proje = os.path.join(KOK, "kurgu", "projeler", ad)
    varlik = os.path.join(proje, "assets")
    os.makedirs(varlik, exist_ok=True)
    sablon = os.path.join(KOK, "hyperframes", "ilan")
    for d in ("package.json", "hyperframes.json", "AGENTS.md", "CLAUDE.md"):
        shutil.copy(os.path.join(sablon, d), proje)
    with open(os.path.join(proje, "meta.json"), "w", encoding="utf-8") as f:
        json.dump({"id": ad, "name": ad}, f)

    # Zaman çizelgesi (vuruş)
    t = 0.0
    planlar = brif["planlar"]
    sfx = []
    for i, p in enumerate(planlar):
        # okuma süresi kuralı (check: line_unread): yazı ekranda ≥ 0.5 + 0.3*kelime sn kalmalı;
        # yazı plan başından 0.15 sn sonra gelir, bitimden 0.22 sn önce gider → gerekirse plan vuruş eklenerek uzar
        metin = " ".join(p.get("yazi", "").split()) if i else " ".join(brif["baslik"])
        gerek = 0.5 + 0.3 * len(metin.split()) + 0.37 + 0.35
        while p["vurus"] * B < gerek:
            p["vurus"] += 1
        p["_t"], p["_d"] = t, p["vurus"] * B
        if p.get("gecis") == "kay" or (varyant == "C" and i > 0):
            sfx.append((t - 0.2, "whoosh.wav", 0.35 if varyant != "C" else 0.3))
        t += p["_d"]
    kapanis_t = t
    son = t + brif["kapanis"].get("vurus", 9) * B
    sfx += [(0.0, "impact.wav", 0.6), (kapanis_t, "impact.wav", 0.75)]
    brif["_sfx"] = sfx

    for i, p in enumerate(planlar):
        klip_hazirla(p, os.path.join(varlik, f"p{i}.mp4"), p["_d"])
    klip_hazirla(brif["kapanis"], os.path.join(varlik, "kapanis.mp4"), son - kapanis_t)
    for kaynak, hedef in ((os.path.join(KOK, "marka", "inza-logo-saydam.png"), "logo.png"),
                          (os.path.join(KOK, "varliklar", "font", "BebasNeue-Regular.ttf"), "BebasNeue.ttf"),
                          (os.path.join(KOK, "muzik", "luxury-real-estate.mp3"), "muzik.mp3"),
                          (os.path.join(KOK, "hyperframes", "ilan", "assets", "whoosh.wav"), "whoosh.wav"),
                          (os.path.join(KOK, "hyperframes", "ilan", "assets", "impact.wav"), "impact.wav")):
        shutil.copy(kaynak, os.path.join(varlik, hedef))

    with open(os.path.join(proje, "index.html"), "w", encoding="utf-8") as f:
        f.write(html_uret(brif, varyant, planlar, kapanis_t, son))

    kod, cikti = calistir(["npx", "--yes", HF, "check"], cwd=proje)
    print(f"== check ({ad}) çıkış {kod}\n" + "\n".join(s for s in cikti.splitlines() if "check: " not in s)[-3000:])
    anlar = []
    for p in planlar:
        anlar.append(p["_t"] + p["_d"] * 0.55)          # sahne ortası (yazı görünür)
    anlar.append(kapanis_t + 2.0)
    kod, c2 = calistir(["npx", "--yes", HF, "snapshot", "--at", ",".join(f"{a:.2f}" for a in anlar)], cwd=proje)
    print(f"== snapshot çıkış {kod}\n{c2[-1500:]}")
    if render:
        cikis = os.path.join(KOK, "cikti", f"{ad}.mp4")
        kod, c3 = calistir(["npx", "--yes", HF, "render", "-o", cikis], cwd=proje)
        print(f"== render çıkış {kod}\n{c3[-1500:]}")
    print(f"süre {son:.1f} sn, proje {proje}")
    return proje


if __name__ == "__main__":
    a = sys.argv[1:]
    v = a[a.index("--varyant") + 1] if "--varyant" in a else None
    kur(a[0], v, "--render" in a)
