# Frontend Contract — video-vitrin

> Kaynak: sayfa listesi #8–9. Kullanıcı kararları (2026-11-01): ayrı `/vitrin` sayfası + ana sayfada 3 videoluk
> önizleme; kitle **alıcı/kiracı**. "Önce tasarımlar, sonra backend" → mock servis. Backend'e bakılmadı. atdd.md yok.

## Tasarım yönü
- Marketing kabuğu (site başlığı/altbilgisi). Üstte ince koyu bant: "Videolu vitrin" + kısa vaat
  ("Evi gezmeden önce videosunu izleyin").
- **Filtre çubuğu**: Satılık/Kiralık (segment), Şehir (select), Oda (1+1 · 2+1 · 3+1 · 4+), Fiyat en az/en çok, Sıralama.
  Mobilde çubuk "Filtreler (n)" düğmesiyle açılan panel; masaüstünde tek satır.
- **Kartlar**: 16:9 poster (CSS zemin + baş harfler; gerçek poster gelince `<img>`), süre rozeti, oynat simgesi;
  altında fiyat (en belirgin), başlık (2 satır kırpılır), konum, "3+1 · 120 m²", Satılık/Kiralık etiketi.
  1440: 3 sütun · 768: 2 · 390: 1.
- **Detay `/vitrin/[id]`**: üstte oynatıcı (16:9), sağda (mobilde altta) yapışkan iletişim kartı: emlakçı adı/baş harfleri,
  **WhatsApp'tan yaz** (önceden doldurulmuş mesaj: ilan başlığı + bağlantı), **Ara**. Altında olgular tablosu
  (oda, m², kat, bina yaşı, ısıtma), açıklama, "Benzer ilanlar" (3).

## UI modeli
```ts
type Deal = "satilik" | "kiralik";
type ShowcaseItem = {
  id; title; deal: Deal; priceMinor: number; city; district; rooms: string; areaM2: number;
  floor: string | null; buildingAge: number | null; heating: string | null; description: string;
  durationSec: number; posterUrl: string | null; videoUrl: string | null; publishedAt: string;
  agent: { name: string; phone: string /* +90… */ };
};
type ShowcaseFilters = { deal?: Deal; city?: string; rooms?: "1+1"|"2+1"|"3+1"|"4+"; minPrice?: number; maxPrice?: number; sort: "yeni"|"fiyat-artan"|"fiyat-azalan" };
```
Filtreler URL'de: `?islem=kiralik&sehir=İzmir&oda=3+1&min=…&max=…&sirala=fiyat-artan` (TL, kuruş değil).

## Servis
```ts
interface ShowcaseService {
  kind: "mock" | "real";
  cities(): Promise<string[]>;
  list(f: ShowcaseFilters, cursor?: string): Promise<{ status: "ok"; items; nextCursor: string | null; total: number } | { status: "error" }>;
  get(id): Promise<{ status: "ok"; item; similar: ShowcaseItem[] } | { status: "not_found" } | { status: "error" }>;
}
```
Mock yalnız dev'de `NEXT_PUBLIC_SHOWCASE_MOCK=1`; production'da hata fırlatır. Servis yoksa `/vitrin*` → 404,
ana sayfa önizlemesi gizli.

## Durumlar
| Durum | Ekran |
|---|---|
| yükleniyor | 6 kart iskeleti, `aria-busy` |
| sonuç | "{total} ilan" + kartlar; "Daha fazla göster" (nextCursor varsa) |
| boş (filtreli) | "Bu filtrelere uyan ilan yok" + **Filtreleri temizle** |
| hata | "İlanlar yüklenemedi" + **Tekrar dene** (boş durumla karışmaz) |
| daha fazla yüklenirken hata | mevcut kartlar kalır, altta alert + tekrar dene |
| detay not_found | 404 sayfası |
| detay video yok | poster + "Video hazırlanıyor" |

## Doğrulama
min > max ise uyarı ve sorgu yapılmaz ("En az fiyat en çoktan büyük olamaz").

## Görsel kabul kriterleri
- V-1: 1440/768/390'da taşma yok; 390'da filtre paneli kapalıyken ilk kart ilk ekranda.
- V-2: Kart tamamı tek bağlantı (başlık bağlantı, kart tıklanabilir alanı genişletir); klavye odağı görünür.
- V-3: Fiyat `299.000 ₺` / kiralıkta `25.000 ₺ / ay`.
- V-4: WhatsApp bağlantısı yeni sekmede, mesaj URL-encoded.

## Backend'e istekler / sorular
1. Yayınlanmış mülk videoları için anon okuma (RLS) ve hangi alanlar herkese açık?
2. Emlakçı telefonu herkese açık gösterilebilir mi (KVKK / emlakçı onayı)?
3. Poster/thumbnail üretimi ve video dosyası için imzalı/herkese açık URL.
4. Şehir listesi sabit mi, yayındaki ilanlardan mı?
