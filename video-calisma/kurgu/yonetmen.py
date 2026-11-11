# Yaratıcı yönetmen = Gemini (sadece YÖNTEM tarif eder), kurgucu = Codex (tarifi koda döker). Klasördeki TÜM ham video ve fotoğrafları etiketli tek bir videoda birleştirir,
# Gemini izler ve: her parçanın nasıl kullanılacağını, şablonu (renk/yazı/geçiş), yazı tipini ve seslendirme metnini
# kendisi seçer. Çıktı: kurgu/brifler/<ad>.json + cikti/<ad>-yonetmen.md. Sonra uret.py ile render edilir.
# Kullanım: python -X utf8 kurgu/yonetmen.py <klasor> <ad> [--render]
import json
import os
import subprocess
import sys
import urllib.error
import urllib.request

KOK = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, KOK)
from izlet import anahtar, yukle  # noqa: E402

MODELLER = ("gemini-pro-latest", "gemini-3.5-flash", "gemini-flash-latest", "gemini-2.5-flash")
VIDEO, FOTO = (".mp4", ".mov", ".m4v"), (".jpg", ".jpeg", ".png", ".webp")
GECIS_TIPLERI = {"itme": "zoom", "whip_sag": "whip", "whip_sol": "whip", "whip_yukari": "whip",
                 "donme": "donme", "flas": "isik", "sarsinti": "sars", "kesme": "kesme"}


def birlestir(klasor, cikti):
    """Her parça ham haliyle (kesilmeden), sol üstte etiketle; fotoğraflar 3 sn sabit kare."""
    dosyalar = sorted(f for f in os.listdir(klasor) if f.lower().endswith(VIDEO + FOTO) and not f.startswith("_"))
    parca, etiketler = [], []
    for i, f in enumerate(dosyalar):
        ad = os.path.splitext(f)[0]
        foto = f.lower().endswith(FOTO)
        etiket = f"{'FOTO' if foto else 'KLIP'} {ad[-6:]}"
        p = os.path.join(klasor, f"_p{i:03d}.mp4")
        vf = (f"scale=640:360:force_original_aspect_ratio=decrease,pad=640:360:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=10,"
              f"drawtext=text='{etiket}':fontcolor=yellow:fontsize=34:x=12:y=10:box=1:boxcolor=black@0.6")
        girdi = ["-loop", "1", "-t", "3", "-i", f] if foto else ["-i", f]
        subprocess.run(["ffmpeg", "-v", "error", "-y", *girdi, "-an", "-vf", vf, "-c:v", "libx264", "-crf", "30",
                        "-pix_fmt", "yuv420p", os.path.basename(p)], check=True, cwd=klasor)
        parca.append(p)
        etiketler.append({"etiket": etiket, "dosya": os.path.relpath(os.path.join(klasor, f), KOK).replace("\\", "/"),
                          "tur": "foto" if foto else "video"})
    liste = os.path.join(klasor, "_liste.txt")
    open(liste, "w", encoding="utf-8").write("".join(f"file '{os.path.basename(p)}'\n" for p in parca))
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", "_liste.txt", "-c", "copy", cikti],
                   check=True, cwd=klasor)
    for p in parca + [liste]:
        os.remove(p)
    return etiketler


def muzik_katalogu():
    """muzik/katalog.json: [{"dosya": "x.mp3", "tarif": "tür, tempo, ruh hali", "lisans": "..."}]; yoksa klasördeki dosyalar."""
    kp = os.path.join(KOK, "muzik", "katalog.json")
    if os.path.exists(kp):
        return json.dumps(json.load(open(kp, encoding="utf-8")), ensure_ascii=False)
    return json.dumps(sorted(f for f in os.listdir(os.path.join(KOK, "muzik")) if f.endswith((".mp3", ".wav"))))


def cerceve(radikal):
    if not radikal:
        return """Çerçeve: 16:9 yatay film, 1920x1080. 5–9 plan, her plan bir VİDEO klibinden (fotoğraflar şimdilik plan olamaz).
Planlar arasında hız rampası (hızlanarak bir sonrakine bağlanma) var; bunun üstüne her geçişin tarzını sen tarif et.
Kesimin iki yanında kamera hareketi aynı yöndeyse geçiş o yöne akmalı. Aynı geçiş fikri iki kez kullanılamaz.
Yazı ekranın alt kısmına konmaz, görüntüyü boğmaz, okunur olur. Başlık ≤3 kelime, en fazla 4 başlık."""
    return """RADİKAL MOD. Müşteri önceki videoların hepsini "birbirinin aynısı, küçük farklar" diye buldu ve SIKILDI.
Önceki TÜM videoların ortak kalıbı şuydu — bu kalıbın EN AZ ÜÇÜNÜ bilerek KIR:
 (1) oda oda sıralı tur, (2) her plan tam ekran tek görüntü, (3) üstte küçük başlık, (4) sakin kadın/erkek seslendirme + arka müzik,
 (5) plan başına ~2–3 sn eşit ritim, (6) yumuşak geçişlerle akış, (7) sonda logolu kart.
Düşünebileceğin yönler (sadece ilham; kendi fikrin daha iyiyse onu yap): bölünmüş ekran/çoklu pencere, dev kinetik tipografi
filmin ana unsuru, müziğe vuruş vuruş kesilen klip, hikâyeli (bir günün akışı, bir karakterin bakışı), ters akış, tek uzun
yavaş plan + üstüne katmanlar, kolaj/kağıt kesik, film grenli belgesel, sessiz film, ritmik tekrar, renk bloklarıyla grafik
tasarım, ekranın bir kısmında harita/plan çizimi. Format 1920x1080 kalır; plan sayısı, süre, yazı yeri/büyüklüğü, ses
kullanımı SERBEST. İzleyici ilk 2 saniyede "bu öncekilerden bambaşka" demeli.
"edit_turu" alanında türünü ve hangi kalıpları kırdığını açıkça yaz."""


def gorev(etiketler, gecmis, yon="", radikal=False):
    onceki = json.dumps([e.get("yontem_ozet") or {k: e.get(k) for k in ("renk", "yazi_stili")} for e in gecmis[-3:]],
                        ensure_ascii=False)
    return f"""Sen ödüllü bir emlak tanıtım filmi YÖNETMENİSİN. Kod yazmıyorsun: sadece YÖNTEMİ tarif ediyorsun; bir
kurgucu (ffmpeg uzmanı) tarifini birebir uygulayacak. TÜM yaratıcı kararlar senin: ışık/renk, her geçişin nasıl olacağı,
yazının nasıl görünüp hareket edeceği, yazı tipi karakteri, ritim, seslendirme. Hazır menü YOK. Önceki videolara BENZEME.
Önceki videolarda kullanılanlar (tekrarlama): {onceki}
{('Müşterinin isteği — bir YÖN, sınır değil; nasıl yorumlayacağın tamamen sana kalmış: ' + yon) if yon else ''}

Bu video, bir evin TÜM ham görüntülerini kesilmeden arka arkaya içeriyor; her parçanın sol üstünde sarı etiket var.
Parçalar: {json.dumps(etiketler, ensure_ascii=False)}

{cerceve(radikal)}
EFEKT YOĞUNLUĞU KURALI (müşteri kuralı, her modda geçerli):
- Gösterişli geçiş (maske, bölme, dönme, mozaik, ışık patlaması vb.) her ~4–5 saniyede EN FAZLA bir tane; 30 sn'lik filmde 5–7 adet.
- İki gösterişli geçiş ARKA ARKAYA gelmez: araya en az bir sade geçiş (düz kesme, kısa çözülme veya hız rampası) girer.
- Her gösterişli geçiş filmde yalnızca bir kez kullanılır (çeşitlilik korunur), ama hepsi aynı görsel dilin parçası olmalı.
- Her mekân en az bir kez ≥1,8 sn yazısız ve efektsiz görünür; izleyici evi görmeli, efekti değil.
Seslendirme: Türkçe, ≤35 kelime. Fiyat, m², oda sayısı, telefon, adres UYDURMA; görmediğin şeyi söyleme.
Kötü görüntüleri (bulanık, insan, inşaat, dağınıklık) kullanma.

Müzik kataloğu (sadece bunlardan seç; hiçbiri uymuyorsa en yakını seç ve tarifte idealini yaz): {muzik_katalogu()}
Tariflerini somut yaz: yön, hız, süre hissi, ışık değişimi, neyin neyin içinden geçtiği, renklerin nasıl kayacağı.
SADECE şu JSON'u döndür:
{{"parcalar": [{{"etiket": "...", "mekan": "...", "kalite": 1-10, "kamera": "...", "kullanim": "..."}}],
 "edit_turu": "türün adı + kırılan kalıplar",
 "hikaye": "...",
 "planlar": [{{"etiket": "...", "baslangic_sn": <klip içi sn>, "neden": "..."}}],
 "plan_suresi_sn": 2.2-4.0,
 "gecisler": [{{"ad": "kısa özgün ad", "yontem": "bu kesimde ne olacak, somut tarif", "ses": "nasıl bir ses"}}],
 "isik_renk": "tüm filmin ışık ve renk yöntemi, somut",
 "isik_efektleri": "film boyunca ışıkla yapılacak anlar (parlama, ışık süzmesi, gölge geçişi vb.) — hangi planda, nasıl; yoksa boş",
 "acilis": "filmin ilk 1-2 saniyesi nasıl açılsın (siyahtan, ışıktan, bulanıktan, maskeden...) — somut tarif",
 "kapanis": "son plandan logolu kapanış kartına nasıl geçilsin ve kart nasıl belirsin/kapansın — somut tarif (kartın içeriği sabit: logo, YERİNDE GÖRÜN, telefon yer tutucusu, krediler)",
 "yazi": {{"gorunum": "yazı tipi karakteri, boyut, renk, konum", "animasyon": "nasıl girip çıkacağı"}},
 "basliklar": [{{"plan_no": 0, "metin": "BÜYÜK HARF"}}],
 "muzik": {{"tarif": "bu film için ideal müzik: tür, tempo (BPM), ruh hali, enstrümanlar", "secim": "<katalogdan dosya adı>",
            "baslangic_sn": <parçanın kaçıncı saniyesinden başlasın>, "neden": "..."}},
 "seslendirme_metni": "...",
 "gerekce":"bu kararların bu ev için neden doğru olduğu"}}"""


def sor(video, metin, gecmis_mesaj=None):
    k = anahtar()
    d = yukle(video, k)
    icerik = [{"role": "user", "parts": [{"file_data": {"mime_type": d["mimeType"], "file_uri": d["uri"]}}, {"text": metin}]}]
    icerik += gecmis_mesaj or []
    govde = {"contents": icerik,
             "generationConfig": {"responseMimeType": "application/json", "temperature": 1.0}}
    import time
    for tur in range(4):                       # 503 (yoğunluk) geçicidir: tüm modelleri bekleyerek yeniden dene
      if tur:
          print(f'Gemini yoğun, {30 * tur} sn bekleniyor…', file=sys.stderr)
          time.sleep(30 * tur)
      for m in MODELLER:
        try:
            r = urllib.request.Request(f"https://generativelanguage.googleapis.com/v1beta/models/{m}:generateContent",
                                       data=json.dumps(govde).encode(), method="POST",
                                       headers={"x-goog-api-key": k, "Content-Type": "application/json"})
            c = json.loads(urllib.request.urlopen(r, timeout=300).read())
            metin = "".join(p.get("text", "") for p in c["candidates"][0]["content"]["parts"]).strip()
            return m, json.JSONDecoder().raw_decode(metin[metin.index("{"):])[0]
        except urllib.error.HTTPError as e:
            print(m, e.code, file=sys.stderr)
        except (TimeoutError, urllib.error.URLError, ConnectionError) as e:   # yoğunlukta bağlantı da düşebilir
            print(m, "zaman aşımı/bağlantı:", type(e).__name__, file=sys.stderr)
    raise RuntimeError("hiçbir Gemini modeli cevap vermedi")


CODEX_GOREV = """Sen kurgucusun. Yönetmen (Gemini) bir video için YÖNTEM tarif etti: {yontem}
Görevin bu tarifleri BİREBİR uygulayan bir brif JSON'u yazmak ve videoyu render etmek. Yaratıcı karar verme; tarifi değiştirme,
sadece teknik olarak gerçekleştir. Tarif teknik olarak imkânsızsa en yakın uygulamayı yap ve raporda belirt.

Motor: kurgu/gecis_motoru.py (oku). Brif alanları (örnek: kurgu/brifler/yatay-pexels-v5.json):
- planlar: [["<dosya yolu>", <baslangic_sn>]] — etiket→dosya: {harita}
- vurus = round(plan_suresi_sn / 0.4497), rampa 0.3, harman 0.3333
- gecisler: her biri {{"ad","giden","gelen","harman","ses"}} — motordaki efekt()/SERBEST bölümünü oku:
  giden/gelen = rampa karelerine ffmpeg filtre zinciri ({{W}},{{H}},{{N}},{{p}} yer tutucuları), harman = xfade custom ifadesi,
  ses = {{"tur": "whoosh"|"vurus", "oran", "ses"}}. zoompan kullanma; kare sayısını değiştiren filtre kullanma.
- renk_filtre: ışık/renk tarifinin ffmpeg zinciri. yazi_filtre: başlık animasyonu şablonu ({{FONT}},{{metin}},{{t0}},{{t1}}).
- font: bebas | segoe_kalin | segoe_ince | bahnschrift | georgia | palatino — tarifteki karaktere en yakını.
- muzik: "muzik/<yönetmenin muzik.secim dosyası>" (motor stiller()/muzik alanına bak; başlangıç saniyesi tarifteki gibi olmalı —
  brifte "muzik_bas": <saniye>).
- yazilar: [[plan_no, "METİN"]], ad: "{ad}", alt_bant: "İNZA · ÖRNEK KURGU".
- acilis / kapanis / isik_efektleri: motorda karşılığı yoksa, motorun çıktısı (cikti/{ad}.mp4) üzerinde AYRI bir ffmpeg
  geçişiyle uygula (ör. kurgu/projeler/yatay/{ad}/son_dokunus.py yazıp çalıştır; sonuç yine cikti/{ad}.mp4 olsun, ses korunsun).
  Kapanış kartının İÇERİĞİ (logo, YERİNDE GÖRÜN, telefon yer tutucusu, krediler) mutlaka bulunmalı ve okunmalı; ama kartın
  tasarımı (zemin, yerleşim, renk, beliriş/kapanış) yönetmenin tarifine göre tamamen değişebilir.
- Yönetmenin tarif ettiği edit türü motorun yapısına (hız rampalı tur) hiç uymuyorsa motoru kullanmak zorunda değilsin:
  kurgu/projeler/yatay/{ad}/ altına kendi ffmpeg betiğini yaz ve cikti/{ad}.mp4'ü onunla üret (seslendirme: kurgu/yz_ses.py,
  müzik: muzik/ altındaki seçim, CC BY ise kredi kapanışta; logolu kapanış kartı içeriği yine bulunmalı). Raporda belirt.
Brifi kurgu/brifler/{ad}.json olarak yaz, sonra çalıştır:
  .venv-capcut\\Scripts\\python.exe -X utf8 kurgu/uret.py kurgu/brifler/{ad}.json --seslendirme-metni "<seslendirme_metni>"
Hata verirse düzelt ve tekrar çalıştır. Bittiğinde cikti/{ad}.mp4 var olmalı.
Yönetmen tarifinde EFEKT YOĞUNLUĞU KURALI var: her ~4–5 sn'de en fazla bir gösterişli geçiş, iki gösterişli geçiş arka arkaya
gelmez (araya sade geçiş), her mekâna ≥1,8 sn efektsiz an. Tarif bunu çiğniyorsa kurala uydur ve raporla.
Kurallar: motorun logolu kapanış kartını KESME. Başlıklar her arka planda okunur olmalı (gerekirse gölge/koyu bant ekle;
tarifin görünümünü koru) — her başlıktan bir kare alıp bakarak doğrula. Mevcut betikleri değiştirme (zorunluysa raporla). Gemini anahtarını yazdırma. Fiyat/m²/telefon uydurma.
Rapor (Türkçe, kısa): her tarif nasıl uygulandı, tam uygulanamayan neydi."""


def codex_calistir(ad, yontem, harita):
    import glob
    codex = sorted(glob.glob(os.path.expandvars(r"%LOCALAPPDATA%\OpenAI\Codex\bin\*\codex.exe")), key=os.path.getmtime)[-1]
    node = glob.glob(os.path.expandvars(r"%LOCALAPPDATA%\Microsoft\WinGet\Packages\OpenJS.NodeJS.LTS_*\node-v*"))[0]
    ffbin = os.path.dirname(subprocess.run(["where", "ffmpeg"], capture_output=True, text=True).stdout.splitlines()[0])
    py = os.path.dirname(os.path.realpath(sys.executable)) if "venv" not in sys.executable else \
        os.path.expandvars(r"%LOCALAPPDATA%\Programs\Python\Python311")
    istem = CODEX_GOREV.format(yontem=json.dumps(yontem, ensure_ascii=False), harita=json.dumps(harita, ensure_ascii=False), ad=ad)
    rapor = os.path.join(KOK, "cikti", f"{ad}-kurgucu.md")
    subprocess.run([codex, "exec", "-C", KOK, "-s", "workspace-write", "-c", "sandbox_workspace_write.network_access=true",
                    "-c", "shell_environment_policy.ignore_default_excludes=true", "--add-dir", node, "--add-dir", ffbin,
                    "--add-dir", py, "--skip-git-repo-check", "-o", rapor, "-"], input=istem, text=True, encoding="utf-8",
                   cwd=KOK, check=True)
    return rapor


def main():
    klasor, ad = os.path.abspath(sys.argv[1]), sys.argv[2]
    gp = os.path.join(KOK, "kurgu", "gecmis.json")
    gecmis = json.load(open(gp, encoding="utf-8")) if os.path.exists(gp) else []
    reel = os.path.join(klasor, "_ham_birlesik.mp4")
    etiketler = birlestir(klasor, reel)
    print(f"birleştirildi: {len(etiketler)} parça → {reel}")
    yon = sys.argv[sys.argv.index("--yon") + 1] if "--yon" in sys.argv else ""
    model, c = sor(reel, gorev(etiketler, gecmis, yon, "--radikal" in sys.argv))
    yp = os.path.join(KOK, "kurgu", "brifler", f"{ad}.yontem.json")
    json.dump({"model": model, **c}, open(yp, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
    md = [f"# {ad} — Gemini yönetmen notu ({model})", "", f"**Edit türü:** {c.get('edit_turu', '')}", "", f"**Hikâye:** {c['hikaye']}", "",
          f"**Işık/renk:** {c['isik_renk']}", "", f"**Işık efektleri:** {c.get('isik_efektleri', '')}", "",
          f"**Açılış:** {c.get('acilis', '')}", "", f"**Kapanış:** {c.get('kapanis', '')}", "", f"**Yazı:** {c['yazi']['gorunum']} — {c['yazi']['animasyon']}", "",
          "## Geçişler", ""] + [f"{i + 1}. **{g['ad']}** — {g['yontem']} *(ses: {g['ses']})*" for i, g in enumerate(c["gecisler"])] + \
         ["", "## Planlar", ""] + [f"- {p['etiket']} @ {p['baslangic_sn']} sn — {p['neden']}" for p in c["planlar"]] + \
         ["", f"**Seslendirme:** {c['seslendirme_metni']}", "", f"**Gerekçe:** {c['gerekce']}", "", "## Tüm parçalar", "",
          "| Etiket | Mekân | Kalite | Kamera | Kullanım |", "|---|---|---|---|---|"] + \
         [f"| {p['etiket']} | {p['mekan']} | {p['kalite']} | {p['kamera']} | {p['kullanim']} |" for p in c["parcalar"]]
    mp = os.path.join(KOK, "cikti", f"{ad}-yonetmen.md")
    open(mp, "w", encoding="utf-8").write("\n".join(md) + "\n")
    print("yöntem:", yp, "\nnot:", mp)
    if "--render" in sys.argv:
        harita = {e["etiket"]: e["dosya"] for e in etiketler}
        print("kurgucu (Codex) çalışıyor…")
        print("rapor:", codex_calistir(ad, c, harita))
        if os.path.exists(gp):      # geçmişe Gemini'nin yöntem özetini ekle (bir sonraki video benzemesin)
            g = json.load(open(gp, encoding="utf-8"))
            for e in g:
                if e["ad"] == ad:
                    e["yontem_ozet"] = {"isik": c["isik_renk"][:200], "yazi": c["yazi"],
                                        "gecisler": [x["ad"] for x in c["gecisler"]]}
            json.dump(g, open(gp, "w", encoding="utf-8"), ensure_ascii=False, indent=2)


if __name__ == "__main__":
    main()
