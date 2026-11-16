# İNZA dikey ilan şablonu (Remotion)

Lisans: Remotion ücretsiz lisans (≤3 çalışan). Sürüm 4.0.539 sabit.

## Kurulum
```
cd video-calisma/remotion
npm install
```

## Yeni ilan
1. Klipleri `public/medya/<ilan>/` altına koy (dikey 1080x1920 sabitlenmiş planlar; yatay klipse ffmpeg ile ortadan kırp).
2. `veri/<ilan>.json` yaz (örnek: `veri/gercek-ilan-1.json`):
   - `kanca`: `{"metin": "ATAŞEHİR'DE|3+1", "sure": 1.5}` — `|` ikinci satırı altın yapar.
   - `planlar`: `[{"video", "sure", "baslik"?, "altBaslik"?, "yazi"?: "carpma|kelime|cizgi|yay"}]`
   - `seslendirme` (yoksa `""`), `seslendirmeBas`, `muzik`, `muzikBas`
   - `kapanis`: logo, cagri, telefon (gerçek değilse `0 (5XX) XXX XX XX`), notlar (YZ seslendirme notu, müzik kredisi, stoksa "İNZA ÖRNEK KURGU").
   Yalnız gerçek bilgileri yaz; fiyat/m² uydurma. Verilmeyen alanlar varsayılan veriden gelir — boşaltmak için `""` ver.
3. Render:
```
npx remotion render IlanDikey ../cikti/remotion-<ilan>.mp4 --props=veri/<ilan>.json --concurrency=4
```
Önizleme: `npx remotion studio`. 25 sn'lik video ~1,5–2 dk'da render olur.
