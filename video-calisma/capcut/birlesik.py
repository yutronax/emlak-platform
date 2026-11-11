# Kaydedilmiş bir CapCut projesini tek "Birleşik klip" (alt proje / compound clip) haline getirir ve
# o klibin hareket bulanıklığını 0 yapar — kullanıcının CapCut'ta elle yaptığı adımın script karşılığı.
# Yapı, kullanıcının elle yaptığı "ilan-tanitim-3" projesinden alınmıştır (SABLON):
#   dış taslak: tek video izi, tek segment → materials.videos[0] ("Birleşik klip1"),
#   materials.drafts[0] (type=combination) içinde bütün iç taslak, kopyası subdraft/<id>/ altında;
#   hareket bulanıklığı: videos[0].video_algorithm.algorithms=[MotionBlur], motion_blur_config.blur=0.
# CapCut projeyi açınca birleşik klibi işler ve sonucu Resources/videoAlg/*.mp4 olarak yazar;
# `indir()` o dosyayı İndirilenler'e kopyalar.
#
# Kullanım:
#   python -X utf8 birlesik.py ilan-tanitim-4            → birleştir + blur 0
#   python -X utf8 birlesik.py ilan-tanitim-4 --indir    → videoAlg'deki tam videoyu İndirilenler'e kopyala
#                                                           (CapCut'ı açıp işlemesini bekler, en fazla 10 dk)
import copy
import glob
import json
import os
import shutil
import sys
import time
import uuid

from taslak import TASLAK_KOK

SABLON = os.environ.get("CAPCUT_BIRLESIK_SABLON", "ilan-tanitim-3")   # elle birleştirilmiş referans proje


def _oku(yol):
    with open(yol, encoding="utf-8") as f:
        return json.load(f)


def _yaz(yol, veri):
    os.makedirs(os.path.dirname(yol), exist_ok=True)
    with open(yol, "w", encoding="utf-8") as f:
        json.dump(veri, f, ensure_ascii=False)


def _yeni_id():
    return str(uuid.uuid4()).upper()


def birlestir(ad):
    hedef = os.path.join(TASLAK_KOK, ad)
    sablon = os.path.join(TASLAK_KOK, SABLON)
    ic = _oku(os.path.join(hedef, "draft_content.json"))
    if ic["materials"].get("drafts"):
        raise ValueError(f"{ad} zaten birleştirilmiş")
    dis = _oku(os.path.join(sablon, "draft_content.json"))
    sure = ic["duration"]
    tl_id = ic["id"]

    # İç taslak → alt proje
    alt_id = _yeni_id()
    ic_kopya = copy.deepcopy(ic)
    ic_kopya["id"] = alt_id
    m = dis["materials"]
    dr = m["drafts"][0]
    eski_dr_id = dr["id"]
    dr["id"] = _yeni_id()
    dr["combination_id"] = _yeni_id()
    dr["draft"] = ic_kopya
    for alan in ("draft_file_path", "draft_cover_path", "draft_config_path"):
        eski = dr[alan].split("\\subdraft\\")[1].split("\\")[0]
        dr[alan] = dr[alan].replace(eski, alt_id)

    # Birleşik klip malzemesi ve hareket bulanıklığı 0
    v = m["videos"][0]
    v["id"] = _yeni_id()
    v["duration"] = sure
    alg = v["video_algorithm"]
    alg["time_range"] = {"start": 0, "duration": sure}
    # Hareket bulanıklığı 0 = algoritma yok. MotionBlur algoritmasını işlenmiş dosyası (videoAlg) olmadan
    # bırakmak CapCut'ta "Medya kaybedildi" verir (2026-11-05 denendi); CapCut o dosyayı kendisi üretmiyor.
    alg["path"] = ""
    alg["motion_blur_config"] = None
    alg["algorithms"] = []

    # Ek malzemelere yeni kimlik (segmentin extra_material_refs sırası korunur)
    seg = dis["tracks"][0]["segments"][0]
    yeni_refs = []
    for ref in seg["extra_material_refs"]:
        if ref == eski_dr_id:                       # alt proje bağlantısı (kimliği yukarıda değişti)
            yeni_refs.append(dr["id"])
            continue
        for anahtar, liste in m.items():
            if not isinstance(liste, list):
                continue
            for oge in liste:
                if isinstance(oge, dict) and oge.get("id") == ref:
                    if anahtar == "drafts":
                        yeni_refs.append(dr["id"])
                    else:
                        oge["id"] = _yeni_id()
                        yeni_refs.append(oge["id"])
    seg["extra_material_refs"] = yeni_refs
    seg["id"] = _yeni_id()
    seg["material_id"] = v["id"]
    seg["source_timerange"] = {"start": 0, "duration": sure}
    seg["target_timerange"] = {"start": 0, "duration": sure}
    dis["tracks"][0]["id"] = _yeni_id()
    dis["duration"] = sure
    dis["id"] = tl_id
    dis["name"] = ic.get("name", "")

    # Alt proje klasörü
    alt_klasor = os.path.join(hedef, "subdraft", alt_id)
    _yaz(os.path.join(alt_klasor, "draft_content.json"), ic_kopya)
    sablon_alt = glob.glob(os.path.join(sablon, "subdraft", "*"))[0]
    cfg = _oku(os.path.join(sablon_alt, "sub_draft_config.json"))
    cfg.update({"id": alt_id, "project_id": alt_id, "rough_cut_duration": sure,
                "create_time": int(time.time()), "import_time_ms": int(time.time() * 1000)})
    _yaz(os.path.join(alt_klasor, "sub_draft_config.json"), cfg)
    shutil.copy(os.path.join(sablon_alt, "draft_cover.jpg"), alt_klasor)

    # Dış taslağı her kopyasına yaz
    for yol in ("draft_content.json", "template-2.tmp",
                os.path.join("Timelines", tl_id, "draft_content.json"),
                os.path.join("Timelines", tl_id, "template-2.tmp")):
        _yaz(os.path.join(hedef, yol), dis)
    return hedef


def indir(ad, bekle=600):
    """CapCut'ın Resources/videoAlg altına yazdığı tam videoyu İndirilenler/<ad>.mp4 olarak kopyalar."""
    klasor = os.path.join(TASLAK_KOK, ad, "Resources", "videoAlg")
    bitis = time.time() + bekle
    while True:
        adaylar = [p for p in glob.glob(os.path.join(klasor, "*.mp4"))
                   if not p.endswith((".alpha.mp4", "_temp.mp4"))]   # _temp: CapCut hâlâ yazıyor
        try:
            yol = max(adaylar, key=os.path.getmtime) if adaylar else None
            boyut = os.path.getsize(yol) if yol else -1
            time.sleep(3)
            hazir = yol and os.path.getsize(yol) == boyut
        except FileNotFoundError:                        # CapCut dosyayı yeniden adlandırdı
            hazir = False
        if hazir:                                        # tam yazılmış mı (yarım dosyada moov yok)
            import subprocess
            r = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", yol],
                               capture_output=True, text=True)
            hazir = r.returncode == 0 and r.stdout.strip() not in ("", "N/A")
        if hazir:                                        # yazma bitti
                hedef = os.path.join(os.path.expanduser("~"), "Downloads", f"{ad}.mp4")
                shutil.copy2(yol, hedef)
                return hedef
        if time.time() > bitis:
            raise TimeoutError(f"{klasor} içinde video oluşmadı — projeyi CapCut'ta açın")
        time.sleep(5)


if __name__ == "__main__":
    ad = sys.argv[1]
    if "--indir" in sys.argv:
        print("indirildi:", indir(ad))
    else:
        print("birleştirildi (blur 0):", birlestir(ad))
