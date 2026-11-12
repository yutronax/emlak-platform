# 08 — Admin Video Yükleme/Onay Paneli

**URL:** `/admin/videos` · **Dosya:** `web/src/app/admin/videos/page.tsx` + `actions.ts` · **Rol:** Admin (auth + `is_admin`)
**Durum:** ⚠️ MVP (EML-?, "video yükleme ve yayınlama akışını uygula" — commit `0f718a6`), önizleme oynatıcı yok · **Route grubu:** yok

## Amaç / Persona

Admin, bir `properties` kaydını seçip tanıtım videosu yükler ve
yayınlar. [01-ana-sayfa](01-ana-sayfa.md)'nın henüz var olmayan public video
galerisi, buradan yayınlanan (`status='published'`) videoları gösterecek (P3, backlog #24).

## İçerik Yapısı

1. Başlık + açıklama.
2. Mülk listesi (`properties` tablosundan, tümü) — tıklanınca `?property_id=...` query param'ıyla seçili hale gelir (URL state, client state değil).
3. Mülk seçiliyse: video yükleme formu (`<input type="file" accept="video/mp4,webm,quicktime">`) + o mülkün mevcut videoları (`data-testid="video-row"`), her biri Taslak/Yayında rozeti + "Yayınla" butonu (taslaksa).

## Server Actions (`actions.ts`, EML-80 öncesi dönemde yazıldı)

- `buildVideoStoragePath(propertyId, filename)` — pure fonksiyon, path'i SERVER üretir, client'tan path GELMEZ (path-manipulation tehdidine karşı bilinçli tasarım kararı, threat-model aşamasında bulundu).
- `uploadVideo(formData)` — `File` objesini doğrudan FormData üzerinden alır (Next.js 16 Server Action özelliği), Supabase Storage'a (`property-videos` bucket, private, 50MB limit) yükler, `property_videos` tablosuna `status='draft'` satır yazar.
- `publishVideo(formData)` — `video_id` alır, `status='published'` + `published_at` yazar.

## Veri Kaynağı

- `properties`: `id, title, address` — tüm satırlar (sayfalama yok).
- `property_videos`: `id, property_id, storage_path, status, published_at, created_at` — SADECE `selectedPropertyId` varsa sorgulanır.
- Supabase Storage bucket `property-videos` (private, admin-only RLS policy — `0011_property_videos_admin_policies.sql`).

## Bağlantılar

| Yön | Hedef | Bağlam |
|---|---|---|
| ← | [`/login`](03-giris.md) | Başarılı giriş sonrası (admin ise) |
| → (yayınlanan video) | [`/`](01-ana-sayfa.md) | Dolaylı, HENÜZ YOK — public galeri backlog #24'te |
| → (oturumsuz/admin değil) | [`/login`](03-giris.md) / [`/agent/dashboard`](05-emlakci-paneli.md) | `requireAdmin()` |

## Erişim Kuralı

`requireAdmin()` — hem sayfa hem Storage bucket RLS seviyesinde korunuyor.

## Olmazsa Olmazlar (henüz kapanmamış)

- [ ] Önizleme oynatıcı (şu an sadece `storage_path` metni gösteriliyor, video oynatılamıyor).
- [ ] Mülk listesi sayfalaması/araması (şu an TÜM `properties` tek seferde).
- [ ] Video silme/değiştirme akışı (şu an sadece yükle+yayınla, geri alma yok).
- [ ] Yükleme ilerleme göstergesi (büyük dosyalarda — 50MB'a kadar — kullanıcı geri bildirimi yok).
- [ ] **Public galeri bağlantısı** (`/` sayfasında anon RLS + gösterim, P3 backlog #24) — bu sayfanın ürettiği veri şu an HİÇBİR YERDE anonim kullanıcıya gösterilmiyor.
- [ ] **Tasarım sistemine geçiş** — eski renkler, EML-80 token sistemine geçmedi.

## İlgili Görev/Jira

- Video yükleme/yayınlama MVP: commit `0f718a6` (Jira id bu dosyadan doğrulanamadı, iş listesinde ayrı madde olarak görünmüyor — muhtemelen EML-7x aralığında).
- Public galeri bağlantısı: backlog #24, henüz Jira task yok.
