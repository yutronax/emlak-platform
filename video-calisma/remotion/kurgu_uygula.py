# Gemini'nin kurgu JSON'unu IlanYaratici props'una çevirir (klip adı → video yolu, süre sınırları, font adı, kapanış).
# Kullanım: python -X utf8 kurgu_uygula.py <gemini.json> <klipler.json> <cikti.json> "<not1>" ["<not2>" ...]
import json, os, shutil, sys
g, kl, out = sys.argv[1:4]
notlar = sys.argv[4:]
c = json.load(open(g, encoding="utf-8")); K = json.load(open(kl, encoding="utf-8"))
c["font"] = {a: v.split(" ")[0] for a, v in c.get("font", {}).items()}
for p in c["planlar"]:
    p["video"] = K[p["klip"]]["video"]
    if p.get("izgara"): p["videolar"] = [K[x]["video"] for x in p.pop("izgara") if x in K]
    else: p.pop("izgara", None)
    p["sure_sn"] = min(p["sure_sn"], (K[p["klip"]]["en_fazla_sn"] - p.get("kesit_bas_sn", 0)) / max(p.get("hiz", 1), 0.1))
    y = p.get("yazi")
    if y and not y.get("alt"): y.pop("alt", None)
a = c["acilis"]
a["klipler"] = [{"video": K[x["klip"]]["video"], "kesit_bas_sn": x.get("kesit_bas_sn", 0)} for x in a.get("klipler", []) if x.get("klip") in K]
if "kapanis_gecisi" in c: c["planlar"][-1]["sonraki_gecis"] = c.pop("kapanis_gecisi")
kat = {m["dosya"]: m for m in json.load(open("../muzik/katalog.json", encoding="utf-8"))}
kr = kat.get(c["muzik"]["dosya"], {}).get("kredi")
c["kapanis"] = {"logo": "medya/logo.png", "cagri": "YERİNDE GÖRÜN", "telefon": "0 (5XX) XXX XX XX", "sure_sn": 4.5,
                "logo_animasyonu": c.pop("logo_animasyonu", "yukselis"), "notlar": notlar + ([kr] if kr else [])}
hedef = "public/medya/" + c["muzik"]["dosya"]
if not os.path.exists(hedef): shutil.copy("../muzik/" + c["muzik"]["dosya"], hedef)
c["muzik"]["dosya"] = "medya/" + c["muzik"]["dosya"]
json.dump(c, open(out, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print("açılış:", a.get("teknik"), "| logo:", c["kapanis"]["logo_animasyonu"], "| müzik:", c["muzik"]["dosya"], "| font:", c["font"])
