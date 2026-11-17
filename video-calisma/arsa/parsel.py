"""TKGM'den parsel geometrisini çeker.

Kullanım: python -X utf8 parsel.py <il> <ilce> <mahalle> <ada> <parsel> <cikti.json>
"""
import json
import sys
import unicodedata
import urllib.request

B = "https://cbsapi.tkgm.gov.tr/megsiswebapi.v3/api"


def get(path):
    req = urllib.request.Request(B + path, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.load(r)


def norm(s):
    s = s.replace("İ", "i").replace("I", "ı").lower()
    return unicodedata.normalize("NFC", s).strip()


def bul(features, ad, tur):
    for f in features:
        if norm(f["properties"]["text"]) == norm(ad):
            return f["properties"]["id"]
    adlar = ", ".join(f["properties"]["text"] for f in features[:40])
    sys.exit(f"{tur} bulunamadı: {ad}. Seçenekler: {adlar}")


def main():
    il, ilce, mah, ada, parsel, cikti = sys.argv[1:7]
    il_id = bul(get("/idariYapi/ilListe")["features"], il, "İl")
    ilce_id = bul(get(f"/idariYapi/ilceListe/{il_id}")["features"], ilce, "İlçe")
    mah_id = bul(get(f"/idariYapi/mahalleListe/{ilce_id}")["features"], mah, "Mahalle")
    f = get(f"/parsel/{mah_id}/{ada}/{parsel}")
    with open(cikti, "w", encoding="utf-8") as o:
        json.dump(f, o, ensure_ascii=False, indent=1)
    p = f["properties"]
    print(f"{p['ilAd']}/{p['ilceAd']}/{p['mahalleAd']} {p['adaNo']}/{p['parselNo']} "
          f"alan={p['alan']} m² nitelik={p['nitelik']} mevki={p.get('mevkii')}")


if __name__ == "__main__":
    main()
