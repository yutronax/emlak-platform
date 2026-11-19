# Bir mp4'ü Gemini'ye izletip sanat yönetmeni gözüyle, saniye saniye eleştiri alır.
# Anahtar: %USERPROFILE%\.gemini-anahtar (repo dışında; git'e girmez) ya da GEMINI_API_KEY ortam değişkeni.
# Kullanım:  python -X utf8 izlet.py <video.mp4> [ek not] [--model gemini-pro-latest]
# Çıktı:     <video>-elestiri.md (videonun yanına)
import json
import mimetypes
import os
import sys
import time
import urllib.request

API = "https://generativelanguage.googleapis.com"
VARSAYILAN_MODEL = "gemini-pro-latest"
YEDEKLER = ["gemini-pro-latest", "gemini-3.5-flash", "gemini-flash-latest", "gemini-2.5-flash"]

ROL = """Sen ödüllü bir sosyal medya reklam filmi SANAT YÖNETMENİ ve kurgucususun; uzmanlığın emlak Reels/Shorts (9:16).
Bu videoyu baştan sona, sesiyle birlikte izle. Bağlam: Türkiye'de emlak firması İNZA Gayrimenkul & Yatırım (logo altın
#F2B526 + lacivert #16213E). Videolar CapCut'ta (ücretsiz sürüm) script ile kurgulanıyor; hedef izleyici ilan arayan
alıcı/kiracı ve emlakçılar. Kullanıcı tercihleri: yazılar telefonda rahat okunmalı; slayt gösterisi gibi tek efekt ve
çok hızlı kurgu sevilmiyor; sinematik ama sıcak, akılda kalan bir his isteniyor.

Türkçe yaz, sanatsal yön ön planda (UX ikincil). Her bulguda zaman damgası ver (ör. 0:04).
YARATICILIK DENETİMİ: hangi an tahmin edilebilir/kalıp gibi? Aynı teknik tekrar ediyor mu? Bir konsept/hikâye hissediliyor mu, yoksa 'oda turu + efekt' mi? Ayrı bir 'Tahmin edilebilir anlar' başlığı yaz.
1. İlk izlenim: ilk 1,5 sn kanca tutuyor mu, genel his ne?
2. Zaman çizelgesi: her kesim/sahne için (0:00–0:02 gibi) ne görülüyor, ne iyi, ne kötü.
3. Hareket ve geçişler: akıcı mı, takılan/sert/tekrarlı an var mı?
4. Yazılar: okunurluk (boyut, süre, kontrast), yerleşim, tipografi karakteri.
5. Renk, ışık, marka hissi; ses/müzik uyumu (vuruşa oturuyor mu, efekt sesleri).
6. Öncelik sıralı en fazla 8 somut düzeltme (zaman damgasıyla, CapCut'ta uygulanabilir).
7. 10 üzerinden puan: kanca, akış, tipografi, renk, ses, genel."""


def anahtar():
    import sys as _s, os as _o
    _s.path.insert(0, _o.path.join(_o.path.dirname(_o.path.abspath(__file__)), '..' if _o.path.basename(_o.path.dirname(_o.path.abspath(__file__))) == 'kurgu' else '.'))
    from gemini_anahtar import anahtar as _a
    return _a()


def istek(url, *, veri=None, basliklar=None, yontem=None):
    r = urllib.request.Request(url, data=veri, headers=basliklar or {}, method=yontem)
    with urllib.request.urlopen(r, timeout=600) as y:
        return y.headers, y.read()


def yukle(yol, k):
    boyut = os.path.getsize(yol)
    tur = mimetypes.guess_type(yol)[0] or "video/mp4"
    h, _ = istek(f"{API}/upload/v1beta/files", yontem="POST",
                 veri=json.dumps({"file": {"display_name": os.path.basename(yol)}}).encode(),
                 basliklar={"x-goog-api-key": k, "X-Goog-Upload-Protocol": "resumable",
                            "X-Goog-Upload-Command": "start", "X-Goog-Upload-Header-Content-Length": str(boyut),
                            "X-Goog-Upload-Header-Content-Type": tur, "Content-Type": "application/json"})
    with open(yol, "rb") as f:
        _, govde = istek(h["X-Goog-Upload-URL"], yontem="POST", veri=f.read(),
                         basliklar={"X-Goog-Upload-Offset": "0", "X-Goog-Upload-Command": "upload, finalize"})
    dosya = json.loads(govde)["file"]
    while dosya.get("state") == "PROCESSING":                      # video işlenene kadar bekle
        time.sleep(3)
        _, g = istek(f"{API}/v1beta/{dosya['name']}", basliklar={"x-goog-api-key": k})
        dosya = json.loads(g)
    if dosya.get("state") != "ACTIVE":
        raise RuntimeError(f"Yükleme başarısız: {dosya}")
    return dosya


def izlet(yol, ek="", model=VARSAYILAN_MODEL):
    """Tüm anahtarları ve modelleri sırayla dener (kota/yoğunlukta sıradakine geçer)."""
    import urllib.error, time
    from gemini_anahtar import hepsi
    metin = ROL + (f"\n\nEk not: {ek}" if ek else "")
    if os.environ.get("YZ_SAGLAYICI") == "qwen":                  # yerel yedek: Qwen2.5-VL (ses dinlemez)
        sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "kurgu"))
        from yonetmen import qwen_sor
        yazi = qwen_sor(yol, metin + "\nNot: sesi duyamıyorsun; ses/müzik maddesini 'değerlendirilemedi' diye geç.")
        cikti = os.path.splitext(yol)[0] + "-elestiri.md"
        with open(cikti, "w", encoding="utf-8") as f:
            f.write(f"# {os.path.basename(yol)} — Qwen2.5-VL (yerel) eleştirisi\n\n{yazi}\n")
        return cikti
    g = None
    for tur in range(3):
        if tur: time.sleep(30 * tur)
        for ai, k in enumerate(hepsi()):
            try:
                dosya = yukle(yol, k)
            except Exception as e:
                print(f"anahtar #{ai + 1} yükleme olmadı: {getattr(e, 'code', type(e).__name__)}", file=sys.stderr); continue
            govde = {"contents": [{"parts": [{"file_data": {"mime_type": dosya["mimeType"], "file_uri": dosya["uri"]}}, {"text": metin}]}]}
            for m in [model] + [x for x in YEDEKLER if x != model]:
                try:
                    _, g = istek(f"{API}/v1beta/models/{m}:generateContent", yontem="POST", veri=json.dumps(govde).encode(),
                                 basliklar={"x-goog-api-key": k, "Content-Type": "application/json"}, )
                    model = m; break
                except urllib.error.HTTPError as e:
                    print(f"anahtar #{ai + 1} {m}: HTTP {e.code}", file=sys.stderr)
                except Exception as e:
                    print(f"anahtar #{ai + 1} {m}: {type(e).__name__}", file=sys.stderr)
            if g: break
        if g: break
    if not g:
        raise RuntimeError("Hiçbir anahtar/model cevap vermedi")
    cevap = json.loads(g)
    yazi = "".join(p.get("text", "") for p in cevap["candidates"][0]["content"]["parts"])
    try:                                                           # yüklenen dosyayı sunucudan sil
        istek(f"{API}/v1beta/{dosya['name']}", yontem="DELETE", basliklar={"x-goog-api-key": k})
    except Exception:
        pass
    cikti = os.path.splitext(yol)[0] + "-elestiri.md"
    with open(cikti, "w", encoding="utf-8") as f:
        f.write(f"# {os.path.basename(yol)} — Gemini ({model}) eleştirisi\n\n{yazi}\n")
    return cikti


if __name__ == "__main__":
    argv = sys.argv[1:]
    model = VARSAYILAN_MODEL
    if "--model" in argv:
        i = argv.index("--model")
        model = argv[i + 1]
        del argv[i:i + 2]
    print("yazıldı:", izlet(argv[0], " ".join(argv[1:]), model))
