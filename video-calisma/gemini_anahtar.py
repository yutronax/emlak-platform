# Gemini anahtarı seçici: birden çok anahtar varsa kotası/ödemesi biten (402/429) anahtarı atlayıp çalışan ilk anahtarı verir.
# Anahtarlar repo DIŞINDA durur: GEMINI_API_KEY ortam değişkeni, %USERPROFILE%\.gemini-anahtarlar (satır başına bir), %USERPROFILE%\.gemini-anahtar.
# Anahtar asla yazdırılmaz.
import json, os, urllib.request

_secilen = None


def _adaylar():
    ev = os.path.expanduser("~")
    k = [os.environ.get("GEMINI_API_KEY", "")]
    for ad in (".gemini-anahtarlar", ".gemini-anahtar"):
        yol = os.path.join(ev, ad)
        if os.path.exists(yol):
            k += [x.strip() for x in open(yol, encoding="ascii").read().replace(",", "\n").splitlines()]
    goruldu, sonuc = set(), []
    for x in k:
        if x and x not in goruldu:
            goruldu.add(x); sonuc.append(x)
    return sonuc


def anahtar():
    global _secilen
    if _secilen:
        return _secilen
    govde = json.dumps({"contents": [{"parts": [{"text": "ok"}]}]}).encode()
    adaylar = _adaylar()
    for i, k in enumerate(adaylar):
        try:
            r = urllib.request.Request("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
                                       data=govde, headers={"x-goog-api-key": k, "Content-Type": "application/json"}, method="POST")
            urllib.request.urlopen(r, timeout=20)
            _secilen = k
            return k
        except Exception as e:
            if getattr(e, "code", None) not in (400, 401, 402, 403, 429):  # zaman aşımı/404/503 kota sorunu değildir
                _secilen = k
                return k
            print(f"Gemini anahtarı #{i + 1} kullanılamıyor ({getattr(e, 'code', type(e).__name__)}), sıradakine geçiliyor")
    if adaylar:
        _secilen = adaylar[0]
        return _secilen
    raise RuntimeError("Gemini anahtarı bulunamadı")


def hepsi():
    """Tüm anahtarlar (kota döngüsü için); seçilen önce."""
    a = _adaylar()
    if _secilen in a:
        a.remove(_secilen); a.insert(0, _secilen)
    return a
