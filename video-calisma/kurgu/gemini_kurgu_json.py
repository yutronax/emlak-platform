# Gemini'ye mekân kliplerinin birleşik reelini izletip IlanYaratici şablonu için AYRINTILI kurgu JSON'u yazdırır.
# Kullanım: python -X utf8 kurgu/gemini_kurgu_json.py <reel.mp4> <klipler.json> <bilgiler> <cikti.json> [yön notu]
import json, sys
sys.path.insert(0, __file__.rsplit("\\", 2)[0] if "\\" in __file__ else ".")
sys.path.insert(0, "kurgu")
import yonetmen as y

reel, klip_yol, bilgi, cikti = sys.argv[1:5]
yon = sys.argv[5] if len(sys.argv) > 5 else ""
ek = open(sys.argv[6], encoding="utf-8").read() if len(sys.argv) > 6 else ""
klipler = json.load(open(klip_yol, encoding="utf-8"))
muzik = json.load(open("muzik/katalog.json", encoding="utf-8"))
MENU = {
    "acilis_stilleri": ["carpma", "daktilo", "maske_yukari", "harf_yagmuru", "kontur", "isik", "yay", "cizgi", "kelime"],
    "yazi_stilleri": ["carpma", "kelime", "cizgi", "yay", "daktilo", "maske_yukari", "harf_yagmuru", "kontur", "yan_cizgi", "isik"],
    "fontlar": ["Anton (kalın, dar)", "Montserrat (modern sans)", "PlayfairDisplay (zarif serif)", "Cinzel (klasik, lüks serif)", "Oswald (kalın dar sans)", "Raleway (ince, şık sans)"],
    "konumlar": ["ust", "orta", "alt"],
    "gecisler": {"whip_sol/whip_sag/whip_yukari/whip_asagi": "hareket bulanıklıklı hızlı kaydırma", "zoom_vurus": "çıkan büyüyerek kaçar, gelen küçükten oturur",
                 "don_zoom": "dönerek yakınlaşma", "flas_itme": "beyaz flaşlı itme", "isik_sizinti": "sıcak ışık sızıntısı", "bulanik_kayma_sag/bulanik_kayma_sol": "yumuşak bulanık kayma",
                 "perde": "ortadan iki yana açılan perde", "yakin_cozulme": "yakınlaşarak çözülme", "kayma_sag/kayma_sol/kayma_alt": "düz itme kayması",
                 "silme": "soldan silme", "iris": "daire açılımı", "saat": "saat yönünde silme", "cozulme": "düz çözülme", "kesme": "sert kesme"},
    "gecis_sesleri": {"whoosh": "sert hava süpürmesi", "vurus": "derin bas vuruşu", "hava": "yumuşak hava", "parilti": "çan/parıltı", "perde": "kumaş/perde hışırtısı", "yok": ""},
    "plan_efektleri": {"isik_huzmesi": "kadrajdan geçen ışık huzmesi", "mercek": "sağ üstte mercek parlaması", "vinyet": "kenar karartma", "parilti_toz": "süzülen altın toz zerreleri", "yok": ""},
    "acilis_teknikleri": {"yok": "ilk plan doğrudan", "sonucla_basla": "en etkileyici kare 1.4 sn başta (acilis.klipler[0])",
        "kalip_kirma": "3 hızlı kesme (0.35 sn, acilis.klipler 3 kesit) sonra asıl tur", "bolunmus_giris": "iki klip yan yana bölünmüş ekran 1.6 sn (acilis.klipler 2 adet)",
        "hizli_zoom_giris": "ilk plan ani zoom-out ve netleşmeyle açılır", "donusum": "ilk plan siyah-beyaz/bulanıktan renge döner",
        "sessizlik_vurus": "ilk 0.7 sn müzik yok, derin vuruşla girer"},
    "logo_animasyonlari": {"yukselis": "aşağıdan yükselip yaylanır (varsayılan)", "parilti": "bulanıktan netleşir", "maske": "soldan sağa çizilir", "isik": "karanlıktan parlar"},
    "plan_turleri": {"tek": "tek klip (varsayılan)", "izgara": "planda 'izgara': [klip adları] — 4 klip 2x2, 9 klip 3x3; hücreler sırayla pop ile açılır"},
    "hiz": "planda 'hiz': 0.5–2.0 (1=normal; >1 hızlandırma, <1 ağır çekim). Kesit süresi sure_sn*hiz kadar kaynak tüketir.",
    "renk_tonlari": ["dogal", "sicak", "soguk", "sinematik", "parlak"],
    "muzik_katalogu": [{"dosya": m["dosya"], "tarif": m["tarif"]} for m in muzik],
}
ist = f"""Sen ödüllü bir emlak Reels yönetmenisin. Bu video, bir evin hazır kamera hareketli mekân kliplerini sırayla içeriyor (her biri ~8 sn, sol üstte etiket).
Kullanılabilir klipler ve sınırları: {json.dumps(klipler, ensure_ascii=False)}
Gerçek ilan bilgileri (YALNIZ bunlar; fiyat/m²/kat UYDURMA): {bilgi}
{('Müşteri yönü: ' + yon) if yon else ''}
{('Referans video analizi (ilham al, kopyalama): ' + ek) if ek else ''}
Görevin: bu ev için YARATICI, KENDİNE ÖZGÜ bir kurgu tasarlamak — sabit kalıp kullanma; müzik, açılış biçimi, yazı tasarımı, fontlar,
her plandaki yazı/efekt, her geçiş ve geçiş sesi senin seçimin. Yalnız aşağıdaki MENÜDEN seç (adları aynen yaz):
{json.dumps(MENU, ensure_ascii=False)}
HOOK KURALLARI (Instagram araştırması, arastirma/REFERANSLAR-ACILIS-HOOK.md): izleyici ~1–1.5 sn'de karar verir; açılış yazısı ilk 0.5 sn'de,
en fazla 5 kelime, kalın/kontrastlı; açılış süresi ≤1.5 sn; ses kapalıyken de işe yaramalı; açılış ilanla ilgili olmalı (ilgisiz şok yok).
Kurallar: toplam süre 35–60 sn; her klip sınırı içinde kullanılır (kesit_bas_sn + sure_sn ≤ izin verilen); mekân sırası mantıklı bir ev turu olsun;
aynı geçiş arka arkaya gelmez, gösterişli geçişler (whip, zoom_vurus, don_zoom, flas_itme, iris, saat) arasında en az bir yumuşak geçiş; geçiş ve müzik tonu uyumlu;
yazılar yalnız gerçek bilgilerden (bir bilgi bir kez); tüm mekânlara yazı koyma (en fazla 4 yazı + açılış); her mekân ≥1.5 sn yazısız görünsün;
açılış metni ikinci satır için '|' kullanabilir. Bant/kutu yok. Kapanış kartı içeriği sabit (logo, YERİNDE GÖRÜN, telefon yer tutucusu, notlar).
SADECE şu JSON'u döndür:
{{"konsept": "...", "muzik": {{"dosya": "...", "baslangic_sn": 0, "neden": "..."}}, "renk_tonu": "...",
 "font": {{"baslik": "<font adı>", "alt": "<font adı>"}}, "vurgu_rengi": "#hex",
 "acilis": {{"teknik": "<acilis_teknikleri>", "klipler": [{{"klip": "<klip adı>", "kesit_bas_sn": 0.0}}], "stil": "<yazı stili>", "metin": "...", "sure_sn": 1.2, "ses": "..."}},
 "logo_animasyonu": "<logo_animasyonlari>",
 "planlar": [{{"klip": "<klip adı>", "izgara": ["<opsiyonel klip adları>"], "hiz": 1.0, "kesit_bas_sn": 0.0, "sure_sn": 4.0, "efekt": {{"ad": "...", "an_sn": 0.5}},
   "yazi": {{"metin": "...", "alt": "...|null", "stil": "...", "konum": "...", "giris_sn": 0.5, "font": "<opsiyonel>"}} | null,
   "sonraki_gecis": {{"ad": "...", "sure_sn": 0.5, "ses": "..."}}, "neden": "..."}}],
 "kapanis_gecisi": {{"ad": "...", "sure_sn": 0.6, "ses": "..."}},
 "gerekce": "..."}}"""
m, c = y.sor(reel, ist)
json.dump(c, open(cikti, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
print(m); print(json.dumps(c, ensure_ascii=False, indent=1)[:4000])
