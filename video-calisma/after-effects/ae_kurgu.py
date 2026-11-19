# Remotion props JSON'undan (kurgu_uygula.py çıktısı) After Effects projesi kurar ve render alır.
# Geçişler/görünüm test edilmiş kısa menüden (arastirma/AFTER-EFFECTS-KISA-MENU.md): Gemini 'sonraki_gecis.ae' ve 'ae.gorunum' verir;
# vermediyse Remotion geçiş adından en yakını seçilir.
# Kullanım: python -X utf8 after-effects/ae_kurgu.py <props.json> <ad> [--sadece-kur] [--yenilik] [--tam]
#   varsayılan: yarım çözünürlük önizleme (deneme için ~4 kat hızlı); --tam: son sürüm 1080x1920
# Çıktı: C:\inza-ae\<ad>.aep ve cikti/ae-<ad>.mp4
import json, os, shutil, subprocess, sys

KOK = "C:/inza-ae"
BURA = os.path.dirname(os.path.abspath(__file__))
PUB = os.path.join(BURA, "..", "remotion", "public")
AE = r"C:\Program Files\Adobe\Adobe After Effects 2023\Support Files"

GECIS_ESLE = {"whip": "Swish3D", "kayma": "Swish3D", "bulanik_kayma": "Swish3D", "isik_sizinti": "DissolveLightLeak",
              "cozulme": "DissolveFilm", "yakin_cozulme": "DissolveFilm", "zoom_vurus": "HyperPull", "don_zoom": "HyperPull",
              "flas_itme": "HyperPull", "kesme": "yok"}
MENU_GECIS = {"DissolveDefocus", "DissolveFilm", "Swish3D", "HyperPull", "DissolveLightLeak", "yok"}
MENU_GORUNUM = {"FilmEffect", "UltraGrain", "SoftFocus", "BleachBypass", "Vignette", "LightLeak"}   # UltraGlow tüm videoda ışık topları yapar → yalnız plan efekti (ae_efekt)
PLAN_EFEKT = {"mercek": "LensFlareAutoTrack", "isik_huzmesi": "LightLeak", "vinyet": "Vignette"}


def ae_gecis(g):
    a = (g or {}).get("ae")
    if a in MENU_GECIS: return a
    ad = (g or {}).get("ad", "")
    for k, v in GECIS_ESLE.items():
        if ad.startswith(k): return v
    return "DissolveDefocus"


def vurus_bul(muzik, bas):
    """Müzik vuruş anları (video zamanına göre). librosa yoksa boş döner."""
    try:
        import librosa
        y, sr = librosa.load(muzik, sr=22050, offset=bas, duration=120)
        _, b = librosa.beat.beat_track(y=y, sr=sr)
        return [float(x) for x in librosa.frames_to_time(b, sr=sr)]
    except Exception as e:
        print("vuruş bulunamadı:", e); return []


def kopyala(yol, ad):
    """public/ altındaki medyayı ASCII yola kopyalar (AE Türkçe yolu açamaz)."""
    hedef = f"{KOK}/medya/{ad}/" + yol.replace("medya/", "").replace("/", "_")
    os.makedirs(os.path.dirname(hedef), exist_ok=True)
    if not os.path.exists(hedef): shutil.copy(os.path.join(PUB, yol), hedef)
    return hedef


def main():
    props, ad = sys.argv[1], sys.argv[2]
    c = json.load(open(props, encoding="utf-8"))
    planlar, t, ov_once = [], 0.0, 0.0
    for p in c["planlar"]:
        g = p.get("sonraki_gecis") or {}
        ge = ae_gecis(g)
        ov = 0.0 if ge == "yok" else max(0.4, min(float(g.get("sure_sn", 0.6)), 1.2))
        ortam = p.get("ortam_sesi")
        planlar.append({"v": kopyala(p["video"], ad), "bas": p.get("kesit_bas_sn", 0), "t": round(t, 3), "sure": p["sure_sn"],
                        "hiz": p.get("hiz", 1), "gecis": ge, "ov": ov, "yazi": p.get("yazi"),
                        "efekt": PLAN_EFEKT.get((p.get("efekt") or {}).get("ad", "")),
                        "ortam": kopyala(f"medya/ortam/{ortam}.wav", ad) if ortam and ortam != "yok" and ortam != "perde_hisirti" else None})
        t += p["sure_sn"] - ov
    for p, q in zip(planlar, c["planlar"]):
        if q.get("ae_efekt"): p["efekt"] = q["ae_efekt"]
    son = planlar[-1]; son["ov"] = 0; son["gecis"] = "yok"
    vuruslar = vurus_bul(os.path.join(PUB, c["muzik"]["dosya"]), c["muzik"].get("baslangic_sn", 0))
    t = 0.0
    for i, p in enumerate(planlar):                                   # geçiş bitişini en yakın vuruşa çek (kısalt ≤0.45, uzat ≤0.15 sn)
        p["t"] = round(t, 3)
        if i < len(planlar) - 1 and vuruslar:
            son_an = t + p["sure"]
            v = min(vuruslar, key=lambda b: abs(b - son_an))
            if -0.45 <= v - son_an <= 0.15: p["sure"] = round(p["sure"] + v - son_an, 3)
        t += p["sure"] - p["ov"]
    t = son["t"] + son["sure"]
    acilis_bitis = min(2.4, planlar[0]["sure"])
    y0 = planlar[0].get("yazi")
    if y0 and y0.get("giris_sn", 0) < acilis_bitis + 0.3: y0["giris_sn"] = acilis_bitis + 0.3   # açılış yazısıyla çakışmasın
    gor = [x for x in (c.get("ae") or {}).get("gorunum", []) if x in MENU_GORUNUM][:3] or ["Vignette", "UltraGrain"]
    k = c.get("kapanis", {})
    veri = {"ad": ad, "planlar": planlar, "sure": round(t + k.get("sure_sn", 4.5), 2), "kapanis_t": round(t, 2),
            "acilis": (c.get("acilis") or {}).get("metin", ""), "gorunum": gor,
            "muzik": kopyala(c["muzik"]["dosya"], ad), "muzik_bas": c["muzik"].get("baslangic_sn", 0),
            "logo": kopyala(k.get("logo", "medya/logo.png"), ad), "cagri": k.get("cagri", ""), "telefon": k.get("telefon", ""),
            "notlar": " · ".join(k.get("notlar", [])), "yenilik": "--yenilik" in sys.argv, "onizleme": "--tam" not in sys.argv, "neon": "--neon" in sys.argv}
    sablon = open(os.path.join(BURA, "ae_kurgu_sablon.jsx"), encoding="utf-8").read()
    jsx = f"{KOK}/betik/kurgu_{ad}.jsx"
    open(jsx, "w", encoding="utf-8", newline="\n").write("var V = " + json.dumps(veri, ensure_ascii=True) + ";\n" + sablon)
    print("betik:", jsx)
    subprocess.run(["powershell", "-ExecutionPolicy", "Bypass", "-File", os.path.join(BURA, "ae.ps1"), "-Betik", jsx, "-Bekle", "300"], check=True)
    if "--sadece-kur" in sys.argv: return
    avi = f"{KOK}/cikti/{ad}.avi"
    if os.path.exists(avi): os.remove(avi)
    for deneme in range(2):                                           # ilk çağrı AE kaydı bitmeden başlarsa boş AVI çıkar → bir kez tekrar
        subprocess.run([os.path.join(AE, "aerender.exe"), "-project", f"{KOK}/{ad}.aep"], stdout=subprocess.DEVNULL, timeout=3600)
        if os.path.exists(avi) and os.path.getsize(avi) > 1_000_000: break
        print("render boş çıktı, tekrar deneniyor")
    mp4 = os.path.join(BURA, "..", "cikti", f"ae-{ad}.mp4")
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", avi, "-c:v", "libx264", "-crf", "18", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k", mp4], check=True)
    os.remove(avi)
    print("render:", os.path.abspath(mp4))


if __name__ == "__main__":
    main()
