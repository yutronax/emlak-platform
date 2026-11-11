# CapCut 9.x uyumlu kaydetme.
# pycapcut eski (6.7) taslak formatı yazıyor; CapCut 9.5 ise projeyi Timelines/<id>/ altında,
# ek ayar dosyalarıyla tutuyor. Bu yüzden CapCut'ın kendi oluşturduğu boş bir projeyi iskelet
# olarak kopyalıyor, pycapcut'ın ürettiği içeriği o iskeletin içine yerleştiriyoruz.
import json
import os
import shutil
import uuid

TASLAK_KOK = os.path.join(os.environ["LOCALAPPDATA"], "CapCut", "User Data", "Projects", "com.lveditor.draft")
ISKELET = os.environ.get("CAPCUT_ISKELET", "1104")   # CapCut'ta elle açılmış boş proje


def _oku(yol):
    with open(yol, encoding="utf-8") as f:
        return f.read()


def _yaz(yol, metin):
    with open(yol, "w", encoding="utf-8") as f:
        f.write(metin)


def katmanlari_sirala(proje, araya=None):
    """İz katmanlarını eklenme sırasına göre ayırır.

    pycapcut aynı türdeki bütün izlere aynı render_index'i verir (ör. tüm video izleri 0); CapCut'ta
    üst üste binen görseller rastgele sıralanır. Burada her tür kendi tabanından başlayıp eklenme
    sırasıyla 10'ar artar (sonra eklenen önde). `araya`: {iz_adı: başka_iz_adı} — o izi verilen izin
    hemen arkasına koyar (ör. dev yazıyı kartın arkasına: {"dev": "golge"}).
    """
    sayac = {}
    for iz in proje.tracks.values():
        taban = iz.track_type.value.render_index
        n = sayac.get(iz.track_type, 0)
        iz.render_index = taban + 10 * n
        sayac[iz.track_type] = n + 1
    for iz_adi, arkasina in (araya or {}).items():
        proje.tracks[iz_adi].render_index = proje.tracks[arkasina].render_index - 5


def pro_ogeler(proje):
    """Projede CapCut Pro (ücretli) gerektiren efekt/geçiş/animasyon/filtre/font adlarını döndürür."""
    import enum
    from pycapcut import metadata
    vip = {}
    for ad in dir(metadata):
        E = getattr(metadata, ad)
        if isinstance(E, type) and issubclass(E, enum.Enum):
            for uye in E:
                v = uye.value
                if getattr(v, "is_vip", False):
                    for alan in ("resource_id", "effect_id"):
                        kimlik = getattr(v, alan, None)
                        if kimlik:
                            vip[str(kimlik)] = f"{E.__name__}.{uye.name}"
    metin = proje.dumps()
    return sorted({ad for kimlik, ad in vip.items() if f'"{kimlik}"' in metin})


def kaydet(proje, ad, araya=None):
    """pycapcut ScriptFile'ı CapCut 9.x'in açabileceği bir proje olarak `ad` adıyla kaydeder.
    Kullanıcıda CapCut Pro yok: Pro öğe varsa kaydetmez, hangileri olduğunu söyler."""
    pro = pro_ogeler(proje)
    if pro:
        raise ValueError("CapCut Pro gerektiren öğeler var (ücretsiz karşılıklarıyla değiştir): " + ", ".join(pro))
    katmanlari_sirala(proje, araya)
    iskelet = os.path.join(TASLAK_KOK, ISKELET)
    hedef = os.path.join(TASLAK_KOK, ad)
    if os.path.abspath(hedef) == os.path.abspath(iskelet):
        raise ValueError("İskelet projenin üzerine yazılamaz")
    if os.path.exists(hedef):
        shutil.rmtree(hedef)
    shutil.copytree(iskelet, hedef, ignore=shutil.ignore_patterns(".locked", "draft_cover.jpg"))

    eski_tl = json.loads(_oku(os.path.join(hedef, "Timelines", "project.json")))["main_timeline_id"]
    yeni_tl = str(uuid.uuid4()).upper()
    os.rename(os.path.join(hedef, "Timelines", eski_tl), os.path.join(hedef, "Timelines", yeni_tl))

    # İçerik: iskeletin alanları korunur (sürüm, platform, yeni anahtarlar), pycapcut'ınkiler üstüne yazılır
    taban = json.loads(_oku(os.path.join(hedef, "draft_content.json")))
    bizim = json.loads(proje.dumps())
    for k, v in bizim.items():
        if k in ("id", "version", "new_version", "platform", "last_modified_platform"):
            continue
        if k == "materials":
            taban["materials"].update(v)
        else:
            taban[k] = v
    taban["id"] = yeni_tl
    icerik = json.dumps(taban, ensure_ascii=False)
    for yol in ("draft_content.json", "template-2.tmp",
                os.path.join("Timelines", yeni_tl, "draft_content.json"),
                os.path.join("Timelines", yeni_tl, "template-2.tmp")):
        _yaz(os.path.join(hedef, yol), icerik)

    # Kimlikler ve adlar
    for yol in (os.path.join("Timelines", "project.json"), os.path.join("Timelines", "project.json.bak"),
                "timeline_layout.json"):
        p = os.path.join(hedef, yol)
        if os.path.exists(p):
            _yaz(p, _oku(p).replace(eski_tl, yeni_tl))
    meta_yol = os.path.join(hedef, "draft_meta_info.json")
    meta = json.loads(_oku(meta_yol))
    meta.update({"draft_name": ad, "draft_id": str(uuid.uuid4()).upper(),
                 "draft_fold_path": hedef.replace("\\", "/"), "draft_root_path": TASLAK_KOK,
                 "tm_duration": taban.get("duration", 0)})
    _yaz(meta_yol, json.dumps(meta, ensure_ascii=False))
    return hedef
