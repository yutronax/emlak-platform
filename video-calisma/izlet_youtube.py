# Gemini'ye bir YouTube videosunu (linkten, indirmeden) izletip kurgu tekniklerini saniye saniye çözdürür.
# Kullanım: python -X utf8 izlet_youtube.py <youtube_id> <cikti.md> [ek odak]
import json
import os
import sys
import urllib.error
import urllib.request

MODELLER = ["gemini-pro-latest", "gemini-3.5-flash", "gemini-flash-latest", "gemini-2.5-flash"]
GOREV = """Sen ödüllü bir kurgucu ve motion tasarımcısısın. Bu emlak videosunu baştan sona izle ve kurgu tekniklerini
TERSİNE MÜHENDİSLİK ile çöz. Türkçe yaz.
1. Zaman çizelgesi: HER geçiş/kesim için satır: [mm:ss] tür (hız rampası, içinden geçme/through transition, whip,
   eşleşmeli kesim, maske geçişi, zoom geçişi, dönme, flaş, vb.) — nasıl yapıldığı: hız eğrisi (ör. %100→%800→%100,
   kaç kare), kamera hareket yönü (iki çekimde aynı yön mü), hareket bulanıklığı, maske/nesne (kapı, duvar, kolon) kullanımı,
   müzik vuruşuna oturuyor mu.
2. "İçinden geçme" (kameranın kapı/pencere/duvar/nesneden geçip yeni sahneye girmesi) örneklerini ayrıca, adım adım anlat.
3. Hız rampalarının ortak deseni: yavaş kısım süresi, hızlı kısım süresi, eğrinin şekli (ease), toplam geçiş süresi.
4. Yazı/grafik ne kadar ve nerede kullanılmış (görüntüyü kapatıyor mu?).
5. Çekim tarafı: bu geçişler için çekimde ne yapılmış (gimbal, aynı yönde hızlı hareket, objeye yaklaşma).
6. Bunları dışarıdan gelen ham klipler ve ffmpeg/HTML-GSAP (HyperFrames) ile yeniden üretmek için somut tarif:
   her teknik için parametreler (süre, hız değerleri, blur miktarı, ölçek, maske).
Genel öneri değil; bu videoda GÖRDÜĞÜN şeyleri, saniyesiyle yaz."""


def anahtar():
    k = os.environ.get("GEMINI_API_KEY")
    return k or open(os.path.join(os.path.expanduser("~"), ".gemini-anahtar"), encoding="ascii").read().strip()


def izle(vid, cikti, ek=""):
    govde = {"contents": [{"parts": [{"file_data": {"file_uri": f"https://www.youtube.com/watch?v={vid}"}},
                                     {"text": GOREV + (f"\nEk odak: {ek}" if ek else "")}]}]}
    for m in MODELLER:
        try:
            r = urllib.request.Request(f"https://generativelanguage.googleapis.com/v1beta/models/{m}:generateContent",
                                       data=json.dumps(govde).encode(), method="POST",
                                       headers={"x-goog-api-key": anahtar(), "Content-Type": "application/json"})
            c = json.loads(urllib.request.urlopen(r, timeout=600).read())
            yazi = "".join(p.get("text", "") for p in c["candidates"][0]["content"]["parts"])
            with open(cikti, "w", encoding="utf-8") as f:
                f.write(f"# https://www.youtube.com/watch?v={vid} — Gemini ({m}) analizi\n\n{yazi}\n")
            return m
        except urllib.error.HTTPError as e:
            print(f"{m}: HTTP {e.code}", file=sys.stderr)
            if e.code not in (429, 404, 503, 500):
                raise
    raise RuntimeError("model yok")


if __name__ == "__main__":
    print(izle(sys.argv[1], sys.argv[2], " ".join(sys.argv[3:])))
