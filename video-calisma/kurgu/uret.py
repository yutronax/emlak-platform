"""Mevcut kurgu araçlarını tek komutla çalıştırır; yollar proje köküne göredir."""
import argparse
import json
import math
from pathlib import Path
import subprocess
import sys

KOK = Path(__file__).resolve().parent.parent


def calistir(betik, *argumanlar):
    print(f"Çalışıyor: {betik}", flush=True)
    # Alt süreçlerin hata metinleri API yanıtları içerebilir; bunları yayımlama.
    sonuc = subprocess.run(
        [sys.executable, "-X", "utf8", str(KOK / betik), *map(str, argumanlar)],
        cwd=KOK, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
    )
    if sonuc.returncode:
        ayrinti = ""
        if betik.endswith("gecis_motoru.py"):   # motor hatası (ffmpeg/kural) API verisi içermez; düzeltme için gerekli
            satirlar = sonuc.stderr.decode("utf-8", "replace").splitlines()
            ayrinti = "\n" + "\n".join(s for s in satirlar if "Fontconfig" not in s)[-2500:]
            print(ayrinti, file=sys.stderr)
        raise RuntimeError(f"{betik} başarısız (çıkış kodu {sonuc.returncode}).")


def kok_yolu(yol):
    p = Path(yol)
    return p if p.is_absolute() else KOK / p


def sureler(yol):
    sonuc = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "stream=codec_type,duration",
         "-of", "json", str(yol)], capture_output=True, check=True,
        encoding="utf-8",
    )
    sure = {}
    for akis in json.loads(sonuc.stdout)["streams"]:
        tur = akis["codec_type"]
        if tur in ("audio", "video"):
            deger = float(akis["duration"])
            if not math.isfinite(deger) or deger <= 0:
                raise ValueError("Geçersiz medya süresi.")
            sure[tur] = max(sure.get(tur, 0), deger)
    return sure


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("brif", help="Kaynak brif JSON yolu")
    p.add_argument("--analiz", metavar="KLASOR", help="Klip analizi yapılacak klasör")
    p.add_argument("--seslendirme-metni", metavar="METIN", help="Gemini TTS ile okunacak metin")
    p.add_argument("--elestiri", action="store_true", help="Gemini video eleştirisi al")
    p.add_argument("--atla-ses", action="store_true", help="Yeni ses üretme; brifteki mevcut sesi kullan")
    args = p.parse_args()
    atlanan = []
    brif_yolu = kok_yolu(args.brif).resolve()
    brif = json.loads(brif_yolu.read_text(encoding="utf-8-sig"))
    ad = brif["ad"]
    if not isinstance(ad, str) or not ad or ad in (".", "..") or any(c in ad for c in '/\\:<>"|?*'):
        raise ValueError("Brif adı güvenli bir dosya adı olmalı.")
    planlar = brif["planlar"]
    if not isinstance(planlar, list) or len(planlar) < 2:
        raise ValueError("En az iki plan gerekli.")
    plan_suresi = float(brif.get("vurus", 4)) * 0.4497
    if not math.isfinite(plan_suresi) or plan_suresi <= 0:
        raise ValueError("Vuruş pozitif olmalı.")

    if args.analiz:
        klasor = kok_yolu(args.analiz).resolve()
        klipler = [x for x in klasor.iterdir() if x.is_file() and x.suffix == ".mp4" and not x.name.startswith("_")]
        if not klipler:
            raise ValueError("Analiz klasöründe MP4 klip bulunamadı.")
        analiz = klasor / "analiz.json"
        if analiz.exists() and analiz.stat().st_mtime > max(x.stat().st_mtime for x in klipler):
            atlanan.append("klip analizi (analiz.json güncel)")
        else:
            calistir("kurgu/klip_analiz.py", klasor, analiz)
    else:
        atlanan.append("klip analizi (istenmedi)")

    if args.seslendirme_metni and not args.atla_ses:
        ses = Path("varliklar/yz") / f"{ad}_seslendirme.wav"
        (KOK / ses).parent.mkdir(parents=True, exist_ok=True)
        calistir("kurgu/yz_ses.py", KOK / ses, args.seslendirme_metni)
        brif["seslendirme"] = ses.as_posix()
    else:
        atlanan.append("ses üretimi (--atla-ses)" if args.atla_ses else "ses üretimi (metin verilmedi)")
    konusma = None
    if brif.get("seslendirme"):
        konusma = sureler(kok_yolu(brif["seslendirme"]))["audio"]
        if "seslendirme_bas" not in brif:
            bas = len(planlar) * plan_suresi - 3.6 - 0.5 - konusma
            brif["seslendirme_bas"] = round(bas if bas >= 0 else 0.5, 3)

    uretilen = KOK / "kurgu/brifler" / f"{ad}.uret.json"
    if uretilen.resolve() == brif_yolu:
        raise ValueError("Kaynak brif üretilmiş brifle aynı; özgün brifi kullanın.")
    uretilen.parent.mkdir(parents=True, exist_ok=True)
    uretilen.write_text(json.dumps(brif, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (KOK / "cikti").mkdir(exist_ok=True)
    calistir("kurgu/gecis_motoru.py", uretilen)
    video = KOK / "cikti" / f"{ad}.mp4"
    sure = sureler(video)
    fark = abs(sure["video"] - sure["audio"])
    if fark >= 0.1:
        raise RuntimeError(f"Video/ses süre farkı {fark:.6f} sn; 0.1 sn altında olmalı.")
    # Kesimleri baştan sona eşit yay; dört kesim yoksa mevcutların hepsini al.
    adet = min(4, len(planlar) - 1)
    kesimler = [1 + round(i * (len(planlar) - 2) / max(1, adet - 1)) for i in range(adet)]
    serit = video.with_name(f"{ad}-serit.png")
    calistir("kurgu/gecis_seridi.py", video, serit, ",".join(map(str, kesimler)), plan_suresi)
    if args.elestiri:
        calistir("izlet.py", video)
        elestiri = video.with_name(f"{ad}-elestiri.md")
        if not elestiri.is_file():
            raise RuntimeError("Eleştiri dosyası oluşmadı.")
        print(f"Eleştiri: {elestiri}")
    else:
        atlanan.append("eleştiri (istenmedi)")
    print(f"Brif: {uretilen}\nVideo: {video}\nŞerit: {serit}")
    print(f"Video: {sure['video']:.6f} sn; ses: {sure['audio']:.6f} sn; fark: {fark:.6f} sn")
    if konusma is not None:
        print(f"Seslendirme: {brif['seslendirme']} ({konusma:.3f} sn), başlangıç: {brif['seslendirme_bas']} sn")
    print("Atlanan: " + "; ".join(atlanan))


if __name__ == "__main__":
    try:
        main()
    except RuntimeError as hata:
        print(f"HATA: {hata}", file=sys.stderr)
        sys.exit(1)
    except (OSError, ValueError, KeyError, TypeError, RuntimeError, subprocess.SubprocessError):
        # İstisna/komut gövdelerinde olası hassas içerik bulunabilir.
        print("HATA: Zincir tamamlanamadı; son adımı, brifi ve medya dosyalarını kontrol edin.", file=sys.stderr)
        sys.exit(1)
