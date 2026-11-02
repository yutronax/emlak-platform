# Frontend Contract — admin-genel-bakis

> Kaynak: sayfa listesi #11. Kullanıcı kararları (2026-11-02): özet kartları, emlakçı listesi, emlakçı detayı,
> hesap aksiyonları; admin alanına ortak üst çubuk. "Önce tasarımlar" → mock (`NEXT_PUBLIC_ADMIN_MOCK=1`, yalnız dev).
> Admin oturum/yetki kontrolü `admin/layout.tsx`'te kalır, atlanmaz. Backend'e bakılmadı. atdd.md yok.

## Rotalar
- `/admin` — genel bakış · `/admin/agents` — emlakçılar · `/admin/agents/[id]` — emlakçı detayı.
  Servis yoksa üçü 404; üst çubukta bu iki bağlantı gizlenir (mevcut İlanlar/Videolar kalır).

## Üst çubuk
Panel çubuğuyla aynı bileşen (`AppHeader`), admin bölümleriyle: **Genel bakış · İlanlar · Videolar · Emlakçılar**,
`aria-label="Yönetim bölümleri"`, logo `/admin`'e gider. Hesap menüsü aynı.

## Genel bakış
Dört özet kartı (sayı + açıklama + bağlantı): Bekleyen ilan → `/admin/listings` · Bekleyen video siparişi →
`/admin/videos` · Aktif abone → `/admin/agents?abonelik=active` · Gecikmiş ödeme (uyarı tonu, 0 değilse) →
`/admin/agents?abonelik=past_due`. Altında "Son 7 günde katılan emlakçılar" kısa listesi.
Durumlar: yükleniyor (iskelet) · hata ("Özet yüklenemedi" + Tekrar dene).

## Emlakçılar
Arama (şirket/e-posta), abonelik filtresi (Tümü · Aktif · Deneme · Gecikmiş · Abonelik yok · Askıda),
WhatsApp filtresi (Bağlı · Bağlı değil). Tablo (≥768) / kart (<768): şirket + e-posta, abonelik rozeti, WhatsApp
durumu, kayıt tarihi, "Askıda"/"Admin" etiketleri. Satır detaya gider. 20'şer sayfalama.
Filtreler URL'de (`?q=&abonelik=&wa=&sayfa=`). Boş/filtreli boş/hata ayrı.

## Emlakçı detayı
Başlık (şirket, e-posta, etiketler) · özet satırı (plan, durum, dönem sonu, kayıt) · bölümler: Ödemeler, WhatsApp
grupları (ad + ilan sayısı), Son ilanlar, Video siparişleri — her biri kendi boş metniyle.
**Hesap aksiyonları** (sağ sütun / mobilde altta): Askıya al ↔ Yeniden etkinleştir; Admin yap ↔ Admin yetkisini kaldır.
Her biri onay penceresi; askıya almada sonuç metni ("panele erişemez, ilanları yayından kalkmaz").
Kendi admin yetkisini kaldırma düğmesi pasif + açıklama ("Kendi yetkinizi kaldıramazsınız").

## Servis
```ts
interface AdminService {
  overview(): Promise<{ status: "ok"; counts: { pendingListings; pendingVideoOrders; activeSubscribers; pastDue }; recentAgents: AgentRow[] } | { status: "error" }>;
  listAgents(q: AgentQuery): Promise<{ status: "ok"; items: AgentRow[]; total; page; pageSize } | { status: "error" }>;
  getAgent(id): Promise<{ status: "ok"; agent: AgentDetail; isSelf: boolean } | { status: "not_found" } | { status: "error" }>;
  setSuspended(id, suspended): Promise<{ status: "ok"; agent: AgentDetail } | { status: "error"; message? }>;
  setAdmin(id, isAdmin): Promise<{ status: "ok"; agent: AgentDetail } | { status: "error"; code?: "self"; message? }>;
}
```

## Görsel kabul kriterleri
- V-1: 1440/768/390'da taşma yok; 390'da liste kart görünümünde.
- V-2: Rozetler metin içerir; aksiyonlar onaysız çalışmaz.

## Backend'e istekler / sorular
1. Hesap askıya alma kavramı (alan + RLS/oturum etkisi) — şu an yok.
2. Admin yap/kaldır (`agents.is_admin`) için güvenli RPC ve denetim kaydı.
3. Özet sayıları için tek RPC; emlakçı listesinde sunucu tarafı arama/sayfalama.
4. Bir adminin başka adminin yetkisini kaldırabilmesi istenir mi? Son admin korunmalı mı?
