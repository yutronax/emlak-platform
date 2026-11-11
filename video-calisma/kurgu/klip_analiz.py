# Ham klip klasörünü tek bir etiketli düşük çözünürlüklü videoda birleştirip Gemini'ye her klibin kamera hareketini,
# yönünü, iyi giriş/çıkış anlarını ve "içinden geçme" maskesi olabilecek nesneleri çözdürür → JSON.
# Kullanım: python -X utf8 kurgu/klip_analiz.py <klasor> <cikti.json>
import json
import os
import subprocess
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from izlet import anahtar, yukle  # noqa: E402
import urllib.error  # noqa: E402
import urllib.request  # noqa: E402

GOREV = """Bu video, aynı evden çekilmiş ham klipleri arka arkaya içeriyor. Her klibin sol üstünde sarı bir KLİP NO yazıyor.
HER klip için şu JSON alanlarını doldur ve SADECE JSON dizisi döndür (açıklama yazma):
{"klip": "<KLİP NO>", "mekan": "salon/mutfak/yatak odası/banyo/hol/merdiven/dış/detay...", "icerik": "kısa betimleme",
 "kamera": "ileri|geri|sola_kayma|saga_kayma|sola_cevirme|saga_cevirme|yukari|asagi|yorunge_sol|yorunge_sag|sabit",
 "hiz": "yavas|orta|hizli", "kalite": 1-10, "en_iyi_giris_sn": <klip içi saniye>, "en_iyi_cikis_sn": <klip içi saniye>,
 "maske_nesne": "çıkışta kadrajı kapatan/yaklaşılan nesne varsa (kapı kasası, duvar, kolon, bitki) yoksa null",
 "not": "kusur, insan, logo vb."}
Klip içi saniyeler, o klibin kendi başlangıcına göre olsun (etiket değiştiği andan itibaren)."""


def birlestir(klasor, cikti):
    klasor, cikti = os.path.abspath(klasor), os.path.abspath(cikti)
    dosyalar = sorted(f for f in os.listdir(klasor) if f.endswith(".mp4"))
    parca = []
    for f in dosyalar:
        no = os.path.splitext(f)[0][-3:]
        p = os.path.join(klasor, f"_k_{no}.mp4")
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", os.path.join(klasor, f), "-an", "-vf",
                        f"scale=640:360,fps=10,drawtext=text='KLIP {no}':fontcolor=yellow:fontsize=36:x=12:y=10:box=1:boxcolor=black@0.6",
                        "-c:v", "libx264", "-crf", "30", p], check=True)
        parca.append(p)
    liste = os.path.join(klasor, "_liste.txt")
    open(liste, "w", encoding="utf-8").write("".join(f"file '{os.path.basename(p)}'\n" for p in parca))
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", liste, "-c", "copy", cikti],
                   check=True, cwd=klasor)
    for p in parca:
        os.remove(p)
    os.remove(liste)


def analiz(klasor, json_cikti):
    birlesik = os.path.join(klasor, "_birlesik.mp4")
    birlestir(klasor, birlesik)
    k = anahtar()
    d = yukle(birlesik, k)
    govde = {"contents": [{"parts": [{"file_data": {"mime_type": d["mimeType"], "file_uri": d["uri"]}}, {"text": GOREV}]}],
             "generationConfig": {"responseMimeType": "application/json"}}
    for m in ("gemini-pro-latest", "gemini-3.5-flash", "gemini-flash-latest", "gemini-2.5-flash"):
        try:
            r = urllib.request.Request(f"https://generativelanguage.googleapis.com/v1beta/models/{m}:generateContent",
                                       data=json.dumps(govde).encode(), method="POST",
                                       headers={"x-goog-api-key": k, "Content-Type": "application/json"})
            c = json.loads(urllib.request.urlopen(r, timeout=600).read())
            veri = json.loads("".join(p.get("text", "") for p in c["candidates"][0]["content"]["parts"]))
            json.dump(veri, open(json_cikti, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
            return m, veri
        except urllib.error.HTTPError as e:
            print(m, e.code, file=sys.stderr)
    raise RuntimeError("model yok")


if __name__ == "__main__":
    m, v = analiz(sys.argv[1], sys.argv[2])
    print(m)
    for x in v:
        print(x.get("klip"), x.get("mekan"), x.get("kamera"), x.get("hiz"), x.get("kalite"),
              x.get("en_iyi_giris_sn"), x.get("en_iyi_cikis_sn"), x.get("maske_nesne"), "|", x.get("not"))
