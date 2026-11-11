# Yapay zekâ ile sanal döşeme: boş oda fotoğrafını Gemini görsel modeliyle döşer (mimari aynen kalır).
# Çıktı videoda MUTLAKA "Yapay zekâ ile sanal döşeme — temsilidir" etiketiyle kullanılır.
# Kullanım: python -X utf8 kurgu/sanal_doseme.py <girdi.jpg> <cikti.png> [stil notu]
import base64
import json
import os
import sys
import urllib.request

API = "https://generativelanguage.googleapis.com/v1beta/models/{m}:generateContent"
MODELLER = ["gemini-3.1-flash-image", "gemini-3-pro-image", "gemini-2.5-flash-image"]
KOMUT = ("Bu boş dairenin fotoğrafını sanal olarak döşe (virtual staging). Duvarları, pencereleri, kapıları, tavanı, "
         "zemini, ışığı ve kamera açısını AYNEN koru; yapıya hiçbir şey ekleme ya da çıkarma. Yalnızca hareketli "
         "mobilya ve dekor ekle: sıcak, modern, aydınlık bir Türk ailesi evi; açık ton kanepe, halı, sehpa, bitki, "
         "perde. Gerçekçi fotoğraf, abartısız. ")


def anahtar():
    k = os.environ.get("GEMINI_API_KEY")
    if not k:
        k = open(os.path.join(os.path.expanduser("~"), ".gemini-anahtar"), encoding="ascii").read().strip()
    return k


def dose(girdi, cikti, not_=""):
    veri = base64.b64encode(open(girdi, "rb").read()).decode()
    govde = {"contents": [{"parts": [{"inline_data": {"mime_type": "image/jpeg", "data": veri}},
                                     {"text": KOMUT + not_}]}],
             "generationConfig": {"responseModalities": ["IMAGE", "TEXT"]}}
    hata = None
    for m in MODELLER:
        try:
            r = urllib.request.Request(API.format(m=m), data=json.dumps(govde).encode(), method="POST",
                                       headers={"x-goog-api-key": anahtar(), "Content-Type": "application/json"})
            cevap = json.loads(urllib.request.urlopen(r, timeout=300).read())
            for p in cevap["candidates"][0]["content"]["parts"]:
                if "inlineData" in p or "inline_data" in p:
                    d = p.get("inlineData") or p.get("inline_data")
                    open(cikti, "wb").write(base64.b64decode(d["data"]))
                    return m
            hata = f"{m}: görsel dönmedi"
        except Exception as e:   # kota/model yok → sıradaki model
            hata = f"{m}: {e}"
            print(hata, file=sys.stderr)
    raise RuntimeError(hata)


if __name__ == "__main__":
    print("model:", dose(sys.argv[1], sys.argv[2], " ".join(sys.argv[3:])))
