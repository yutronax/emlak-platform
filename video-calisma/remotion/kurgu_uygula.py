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
# OKUMA SÜRESİ KURALI: her yazı en az 2 sn + karakter başına 0.05 sn ekranda kalır; plan kısa ise klip sınırına kadar uzatılır,
# yine yetmezse yazı girişi öne çekilir. Açılış iki satırsa en az 2 sn.
for p in c["planlar"]:
    y = p.get("yazi")
    if not y: continue
    gerek = 2.0 + 0.05 * (len(y.get("metin", "")) + len(y.get("alt") or ""))
    gir = y.get("giris_sn", 0.4)
    if p["sure_sn"] - gir - 0.2 < gerek:
        mx = (K.get(p["klip"], {}).get("en_fazla_sn", p["sure_sn"]) - p.get("kesit_bas_sn", 0)) / max(p.get("hiz", 1), 0.1)
        p["sure_sn"] = round(min(mx, gir + 0.2 + gerek), 2)
        if p["sure_sn"] - gir - 0.2 < gerek: y["giris_sn"] = round(max(0.2, p["sure_sn"] - 0.2 - gerek), 2)
a = c["acilis"]
if "|" in a.get("metin", ""): a["sure_sn"] = max(a.get("sure_sn", 1.5), 2.0)
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
# tekrar defteri: bu videoda kullanılan teknikleri kaydet (sonraki videoda yasak listesi olur)
tek = {"font:" + v for v in c["font"].values()} | {"acilis:" + str(a.get("teknik")), "acilis_yazi:" + a.get("stil", ""), "logo:" + c["kapanis"]["logo_animasyonu"], "muzik:" + c["muzik"]["dosya"].split("/")[-1], "ton:" + str(c.get("renk_tonu"))}
for p in c["planlar"]:
    tek.add("gecis:" + p.get("sonraki_gecis", {}).get("ad", ""))
    if p.get("yazi"): tek.add("yazi:" + p["yazi"].get("stil", ""))
    if p.get("efekt", {}).get("ad", "yok") != "yok": tek.add("efekt:" + p["efekt"]["ad"])
D = "../kurgu/gecmis-yaratici.json"
g = json.load(open(D, encoding="utf-8")) if os.path.exists(D) else []
g.append({"video": os.path.basename(out), "konsept": c.get("konsept"), "kisit": c.get("_kisit"), "teknikler": sorted(tek)})
json.dump(g, open(D, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
yeni = c.get("yeni_teknikler") or []
if yeni:
    with open("../kurgu/efektler/YENI-TEKNIK-ADAYLARI.md", "a", encoding="utf-8") as f:
        for n in yeni: f.write(f"- **{n.get('ad')}** ({os.path.basename(out)}): {n.get('tarif')} — {n.get('nerede')}\n")
print("açılış:", a.get("teknik"), "| logo:", c["kapanis"]["logo_animasyonu"], "| müzik:", c["muzik"]["dosya"], "| font:", c["font"])
