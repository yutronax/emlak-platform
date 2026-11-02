# Frontend Contract — admin-ilan-kuyrugu

> Kaynak: sayfa listesi #10 (envanterde açık: sayfalama, filtre/arama, onaydan önce düzenleme).
> "Önce tasarımlar, sonra backend" → mock. Yeni tasarım yalnız dev'de `NEXT_PUBLIC_ADMIN_MOCK=1` iken;
> bayraksız mevcut `/admin/listings` aynen çalışır. **Mock dalı `requireAdmin()`'den sonra** — admin oturum
> kontrolü hiçbir koşulda atlanmaz. Backend'e bakılmadı (mevcut sayfanın gösterdiği alanlar dışında). atdd.md yok.

## Tasarım yönü — inceleme masası
- Panelin sakin dili (`fog-50`, beyaz kartlar). ≥1024px iki bölme: solda **kuyruk** (dar liste), sağda **inceleme**.
  <1024px: kuyruk listesi; öğe seçilince inceleme tam ekran, "← Kuyruğa dön".
- Üstte filtre çubuğu: arama (ham metinde/başlıkta), şehir, kaynak (Tümü · Ortak gruplar · Kişisel), skor
  (Tümü · Düşük <0,50 · Orta 0,50–0,69 · Yüksek ≥0,70), sıralama (Eski önce · Yeni önce). "Ayarlar" (eşik formu) katlanır.
- Kuyruk öğesi: başlık (yoksa ham metnin ilk satırı), grup / "Kişisel — {şirket}", skor rozeti (metin + renk), göreli zaman.
- İnceleme: solda **ham WhatsApp mesajı** (mesaj balonu görünümü), sağda **düzenlenebilir ayrıştırılmış alanlar**
  (başlık, fiyat, para birimi, oda, m², şehir, ilçe, mahalle, açıklama). Değişen alan işaretlenir ("düzenlendi").
- Aksiyonlar: **Onayla** (düzenlemelerle) · **Reddet** (gerekçe penceresi). İşlem sonrası öğe kuyruktan düşer, sıradaki seçilir.
- Klavye: `J`/`K` sonraki/önceki, `A` onayla, `R` reddet penceresi (yazı alanındayken devre dışı); kısayollar ekranda yazılı.
- Sayfalama: 20'şer, "41–60 / 132", Önceki/Sonraki.

## UI modeli
```ts
type ParsedFields = { title; price: number | null; currency: "TRY" | "USD" | "EUR"; rooms; areaM2: number | null; city; district; neighborhood; description };
type ReviewItem = { id; rawText; sourceGroup: string | null; owner: { companyName: string } | null; score: number | null; createdAt; parsed: ParsedFields };
type ReviewQuery = { q?: string; city?: string; source?: "group" | "personal"; score?: "low" | "mid" | "high"; order: "oldest" | "newest"; page: number };
type RejectReason = "spam" | "duplicate" | "incomplete" | "not_listing" | "other";
```

## Servis
```ts
interface ReviewService {
  list(q): Promise<{ status: "ok"; items; total; page; pageSize } | { status: "error" }>;
  cities(): Promise<string[]>;
  approve(id, edits: Partial<ParsedFields>): Promise<{ status: "ok" } | { status: "gone" } | { status: "error"; message? }>;
  reject(id, reason, note?): Promise<{ status: "ok" } | { status: "gone" } | { status: "error"; message? }>;
  getThreshold(): Promise<{ value: number; failed: boolean }>;
  saveThreshold(v): Promise<{ ok: true } | { ok: false; error: string }>;
}
```
`approve` yalnız **değişen** alanları gönderir.

## Durumlar
| Durum | Ekran |
|---|---|
| yükleniyor | kuyruk iskeleti, `aria-busy` |
| liste hatası | "Kuyruk yüklenemedi" + Tekrar dene (boş kuyrukla karışmaz) |
| kuyruk boş (filtresiz) | "İncelenecek ilan yok" |
| filtreli boş | "Bu filtrelere uyan ilan yok" + Filtreleri temizle |
| işlem sürüyor | iki düğme kilitli, düğmede "Onaylanıyor…" |
| işlem hatası | inceleme bölmesinde alert; öğe ve düzenlemeler kalır |
| `gone` | "Bu ilan başka bir yönetici tarafından işlendi" (status); öğe kuyruktan düşer |
| başarı | "Onaylandı"/"Reddedildi" (status) + sıradaki öğe |
| doğrulama | başlık 3–140, fiyat ve m² pozitif tam sayı ya da boş; hata alana bağlı, onay gönderilmez |

## Görsel kabul kriterleri
- V-1: 1440/768/390'da taşma yok; 390'da inceleme ekranında Onayla/Reddet ilk ekranda ya da yapışkan alt çubukta.
- V-2: Skor rozeti metin içerir. Kısayollar yazı alanında tetiklenmez.

## Backend'e istekler / sorular
1. Sunucu tarafı arama/filtre/sayfalama (şu an tüm bekleyenler tek sorguda).
2. Onayda düzenlenmiş alanları kabul eden aksiyon (şu an yalnız id).
3. Red gerekçesi saklanacak mı?
4. Eşzamanlı inceleme: başka admin işlediyse `gone` dönebilir mi?
