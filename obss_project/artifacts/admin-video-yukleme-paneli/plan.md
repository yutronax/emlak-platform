# Plan — admin-video-yukleme-paneli
_Reference: atdd.md_

Frontend-pipeline: tetikleyici VAR (.tsx dosyaları + Görsel/UI kriteri dolu).
Çalıştırıldı — Design Direction adımı ATLANDI (bu bir yeni estetik tasarım
değil, mevcut `/admin/listings` deseninin mekanik genişletmesi — fast-track
ile aynı mantık). Discover: `/admin/listings/page.tsx` ve `actions.ts`
statik olarak okundu (dev sunucusu gerekmedi, sayfa zaten render edilmiş
bir tasarım taşımıyor, salt Tailwind class'ları yeterli bilgi verdi). Audit:
mevcut `/admin/videos` sayfası tek paragraflık placeholder, audit edilecek
bir UI yok.

## Keşif Sonucu (gerçek koddan) — ATDD'nin varsayımını değiştiren bulgular

1. **`requireAdmin()` tam dönüş şekli** (`web/src/lib/auth/requireAdmin.ts`):
   `{ok:true, supabase, userId}` veya `{ok:false, reason:"no-session"|"not-admin"}`.
   ATDD'nin "admin değilse ana sayfaya redirect" varsayımı YANLIŞ —
   gerçek desen (`/admin/listings/page.tsx:30-32`):
   `redirect(auth.reason === "no-session" ? "/login" : "/agent/dashboard")`.
   AC-6 buna göre düzeltilmeli: `/agent/dashboard`, ana sayfa değil.

2. **Mevcut server action deseni `{ok,error}` DEĞİL, throw-based**
   (`web/src/app/admin/listings/actions.ts`): fonksiyonlar `Promise<void>`
   döner, hata durumunda `throw new Error("<Türkçe mesaj>")` atar, admin
   değilse `redirect`/`throw`. ATDD'nin Davranış Sözleşmesi'ndeki
   `{ok:false, error:"CODE"}` şekli bu projenin mevcut deseniyle TUTARSIZ.
   **Karar:** yeni action'lar da aynı throw-based deseni takip edecek —
   CAVEMAN ilkesi (mevcut desen varken yeni bir hata-nesnesi konvansiyonu
   icat etme). Davranış Sözleşmesi tablosu bu plana göre güncellendi
   (aşağıda).

3. **Next.js 16.4 server action'ları `FormData` içinde `File` nesnesini
   native olarak kabul ediyor** (`node_modules/next/dist/docs/01-app/
   02-guides/server-actions.md:83,164` — `experimental.serverActions.
   bodySizeLimit`, varsayılan 1MB, 50MB için `next.config.ts`'e
   yükseltilmeli). **Mimari basitleştirme kararı:** ATDD'nin varsaydığı
   "client Storage'a doğrudan yükler, sonra server action'a sadece
   storage_path gönderir" iki-aşamalı akış YERİNE, `/admin/listings`'in
   zaten kullandığı düz `<form action={fn}>` deseniyle TEK bir server
   action dosyayı FormData'dan alıp hem Storage'a yükleyip hem DB'ye
   INSERT eder. Sonuçları:
   - **AC-S1 (path manipülasyonu) kapsamı değişti:** client artık HİÇBİR
     zaman bir `storage_path` göndermiyor — server action path'i kendisi
     üretiyor (`${property_id}/${randomUUID()}.${ext}`). Saldırı yüzeyi
     TASARIMLA ortadan kalktı (test edilecek bir "reddet" davranışı yok).
     AC-S1 şimdi **pozitif** bir birim testine dönüşüyor: path üretici
     fonksiyon HER ZAMAN `${property_id}/` öneki ile başlayan bir yol
     üretir (fuzz-benzeri, birden fazla property_id ile test edilir).
   - Hiçbir client-side JS/component gerekmiyor — mevcut server-component
     + plain `<form>` deseniyle tam uyumlu, yeni bir client component
     dosyası YOK (ATDD'nin "yeni client component" varsayımı düşüyor).
   - `next.config.ts`'e `experimental.serverActions.bodySizeLimit: '55mb'`
     eklenmesi gerekiyor (55MB — 50MB dosya + FormData/multipart overhead
     payı).
   Bu, ATDD'nin onayladığı akıştan bir mimari sapma — kullanıcıya Hard
   Stop'ta ayrıca özetlenecek, ama güvenlik AÇISINDAN AC-S1'i daha güçlü
   kılıyor (runtime kontrolden tasarım-garantisine), basitlik AÇISINDAN
   daha az dosya/kod gerektiriyor — CAVEMAN'a daha uygun.

4. **Supabase Storage bucket durumu:** `GET /storage/v1/bucket` → `[]`,
   HİÇ bucket yok (ATDD'nin Unknown'ı çözüldü — "muhtemelen yok" doğrulandı).
   Migration'da `insert into storage.buckets (...) on conflict do nothing`
   ile idempotent oluşturulacak.

5. **`property_videos.storage_path` üzerinde unique constraint YOK**
   (0001_init.sql'de böyle bir index/constraint tanımlı değil — ATDD'nin
   Unknown'ı çözüldü).

6. **Mevcut `raw_listings` admin-review deseni RPC kullanıyor**
   (`approve_raw_listing`/`reject_raw_listing`), ama bu basit bir
   INSERT/UPDATE senaryosu (raw_listings'teki gibi multi-step bir karar
   mekanizması yok) — RPC yerine doğrudan `supabase.from("property_videos").
   insert(...)`/`.update(...)` kullanılacak, RLS zaten yetki kontrolünü
   yapıyor. Gereksiz bir RPC soyutlaması eklemek CAVEMAN'a aykırı olurdu.

## Files to Modify
| File | Why | Risk | Alan |
|------|-----|------|------|
| `web/src/app/admin/videos/page.tsx` | Placeholder'ı gerçek server component'e dönüştür (property seçici + video listesi + upload formu) | medium | frontend |
| `web/next.config.ts` | `experimental.serverActions.bodySizeLimit` ekle (55MB) | low | frontend |

## New Files
| File | Purpose | Alan |
|------|---------|------|
| `web/src/app/admin/videos/actions.ts` | `uploadVideo`, `publishVideo` server action'ları | backend |
| `supabase/migrations/0011_property_videos_admin_policies.sql` | property_videos admin RLS + `property-videos` Storage bucket + admin Storage policy'leri | backend |
| `supabase/rollback/0011_property_videos_admin_policies_rollback.sql` | Ters migration | backend |

## Dependencies
- `requireAdmin()` (`web/src/lib/auth/requireAdmin.ts`) — DEĞİŞTİRİLMEZ, aynen kullanılır.
- `web/src/lib/supabase/server.ts` (`createClient`) — mevcut server-side Supabase client, aynen kullanılır.
- `revalidatePath` (`next/cache`) — mevcut desen.
- `properties` tablosu — property seçici için `select id, title, address`.

## Migration İçeriği (code-copilot'un birebir uygulayacağı taslak)
```sql
-- 0011_property_videos_admin_policies.sql

-- Admin: herhangi bir property'nin videolarını görebilir/ekleyebilir/güncelleyebilir.
create policy property_videos_admin_select on property_videos
    for select to authenticated
    using (exists (select 1 from agents a where a.id = auth.uid() and a.is_admin));

create policy property_videos_admin_insert on property_videos
    for insert to authenticated
    with check (exists (select 1 from agents a where a.id = auth.uid() and a.is_admin));

create policy property_videos_admin_update on property_videos
    for update to authenticated
    using (exists (select 1 from agents a where a.id = auth.uid() and a.is_admin));

-- properties: admin herhangi bir property'yi SELECT edebilmeli (property seçici için).
create policy properties_admin_select on properties
    for select to authenticated
    using (exists (select 1 from agents a where a.id = auth.uid() and a.is_admin));

-- Storage bucket (idempotent, private).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('property-videos', 'property-videos', false, 52428800,
        array['video/mp4', 'video/webm', 'video/quicktime'])
on conflict (id) do nothing;

-- storage.objects: admin property-videos bucket'ına yazabilir/okuyabilir.
create policy property_videos_storage_admin_all on storage.objects
    for all to authenticated
    using (bucket_id = 'property-videos' and exists (
        select 1 from agents a where a.id = auth.uid() and a.is_admin
    ))
    with check (bucket_id = 'property-videos' and exists (
        select 1 from agents a where a.id = auth.uid() and a.is_admin
    ));
```
Not: `property_videos_owner_*` policy'leri (0001_init.sql'de zaten var)
DOKUNULMUYOR — bu migration SADECE admin policy'lerini EKLİYOR, mevcut
owner davranışı (AC-9 regresyonu) bu yüzden otomatik korunuyor.

## Migration Required?
Evet — yukarıdaki `0011_property_videos_admin_policies.sql` (+ rollback).

## Risks
atdd.md'den taşınan riskler (audit log yok, sınırsız video sayısı, yetim Storage dosyası) geçerli — değişmedi.
**Yeni risk (keşifte bulundu):** `storage.objects` için `for all` policy'si hem SELECT/INSERT/UPDATE/DELETE'i kapsıyor — admin'in yanlışlıkla başka bir admin'in yüklediği videoyu silebilmesi (DELETE) bu görevin "silme kapsam dışı" kuralıyla çelişmiyor (UI'da silme YOK ama RLS seviyesinde admin DELETE yapabilir) — bu bilinçli bir risk olarak Risks'e eklenmeli: RLS, UI'ın sunmadığı bir yetkiyi (silme) teknik olarak açık bırakıyor. Kabul edilebilir (tek-admin sistem, UI'da buton yok), ama not edilmeli.

## Open Questions
`Unknowns`'taki 2 madde (bucket var mı, unique constraint var mı) bu adımda ÇÖZÜLDÜ (yukarıda). Kalan gerçek açık soru yok — ama **mimari sapma** (madde 3) kullanıcıya Hard Stop'ta açıkça özetlenecek, zımni onay değil.

## Alan Etiketleri (code-copilot/test-copilot yönlendirmesi için)
- `web/src/app/admin/videos/actions.ts` → backend
- `supabase/migrations/0011_*.sql` + rollback → backend
- `web/src/app/admin/videos/page.tsx` → frontend
- `web/next.config.ts` → frontend (düşük riskli, tek satır config)

## test-copilot / code-copilot Dispatch Talimatı (somut)
**Backend grubu:**
- `supabase/migrations/0011_property_videos_admin_policies.sql` — yukarıdaki SQL birebir.
- `supabase/rollback/0011_property_videos_admin_policies_rollback.sql` — ters migration (admin policy'lerini + bucket'ı DROP eder, owner policy'lerine dokunmaz).
- `web/src/app/admin/videos/actions.ts`:
  - `uploadVideo(formData: FormData): Promise<void>` — `requireAdmin()` kontrolü (throw/redirect, `/admin/listings/actions.ts` ile AYNI desen), `property_id` ve `video` (File) formData'dan okunur, property varlığı doğrulanır (yoksa `throw new Error("Geçersiz mülk")`), format/boyut doğrulanır (yoksa `throw new Error("Sadece MP4, WebM veya MOV yükleyebilirsiniz")` / `throw new Error("Dosya 50MB sınırını aşıyor")`), path server'da üretilir (`${property_id}/${randomUUID()}.${ext}` — ASLA client'tan okunmaz), Storage'a yüklenir, `property_videos`'a `status:"draft"` ile INSERT edilir; INSERT başarısız olursa Storage'daki dosya best-effort silinir (silinemezse `console.error` ile path loglanır), sonra `throw new Error("Video kaydedilemedi, lütfen tekrar deneyin")`; başarılıysa `revalidatePath("/admin/videos")`.
  - `publishVideo(formData: FormData): Promise<void>` — `video_id` formData'dan okunur, `requireAdmin()` kontrolü, `property_videos` güncellenir (`status:"published", published_at: new Date().toISOString()`), idempotent (zaten published ise hata YOK, sessizce geçer), `revalidatePath("/admin/videos")`.
- Path üretici mantık ayrı, test edilebilir bir fonksiyon olarak çıkarılabilir (örn. `buildVideoStoragePath(propertyId, filename)`) — AC-S1'in birim testi bunu hedefleyecek.

**Frontend grubu:**
- `web/src/app/admin/videos/page.tsx`: `requireAdmin()` kontrolü (`/admin/listings/page.tsx` ile AYNI redirect deseni), `properties` tablosundan `id, title, address` seçimi (admin select policy ile), `property_videos`'tan tüm videolar (`property_id, storage_path, status, published_at` + join'li property başlığı) çekilir. UI: bir property seçici (`<select>` veya basit liste+link, `/admin/listings` ile aynı Tailwind stilinde — `rounded border p-4`, `text-zinc-600 dark:text-zinc-400` vb.), seçili property için `<form action={uploadVideo}>` (hidden `property_id` + `<input type="file" name="video" accept="video/mp4,video/webm,video/quicktime">` + submit butonu `/admin/listings`'teki `rounded bg-green-600 ...` stiliyle), video listesi (her satırda "Taslak"/"Yayında" rozeti + taslak olanlar için `<form action={publishVideo}>` "Yayınla" butonu).
- `web/next.config.ts`: `experimental.serverActions.bodySizeLimit: '55mb'` ekle — mevcut `cacheComponents`/`turbopack` ayarlarının yanına, tek satır.
