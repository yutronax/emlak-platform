# Code Diff — admin-video-yukleme-paneli (backend)

## Oluşturulan Dosyalar
- `supabase/migrations/0011_property_videos_admin_policies.sql` — plan.md'nin SQL'i birebir, `Read` ile doğrulandı.
- `supabase/rollback/0011_property_videos_admin_policies_rollback.sql` — admin policy'leri + bucket DELETE, owner policy'lerine dokunmuyor.
- `web/src/app/admin/videos/actions.ts` — `buildVideoStoragePath`, `uploadVideo`, `publishVideo`.

## Değiştirilen Dosyalar
- `web/next.config.ts` — `experimental.serverActions.bodySizeLimit: "55mb"` eklendi, mevcut ayarlar korundu.

## Doğrulama
`npx vitest run src/app/admin/videos/actions.test.ts` → **13/13 PASS** (bağımsız olarak doğrulandı, alt-ajanın kendi beyanına güvenilmedi).

## AC Karşılama
AC-1/2/3/4/5/6/12/S1 — `actions.test.ts` üzerinden doğrulandı (13/13). AC-S2/S3/S4/9 (RLS/Storage) — `admin-video-rls.test.ts`, gerçek Supabase'e karşı `verify` adımında çalıştırılacak (migration henüz uygulanmadı).

## Frontend (EML-75)
- `web/src/app/admin/videos/page.tsx` yeniden yazıldı — server component, `/admin/listings` Tailwind deseniyle.
- `npx vitest run src/app/admin/videos/page.test.tsx` → **6/6 PASS** (bağımsız doğrulandı).
- Upload butonu "Yükle" olarak adlandırıldı (publish butonu "Yayınla" ile çakışmaması için) — testte doğrudan assert edilmemiş ama atdd.md'nin AC-1'i için gerekli bir ek.

## Varsayımlar / Not Edilen Sınırlamalar (alt-ajandan, Read ile teyit edildi)
- `publishVideo`, idempotency için `.eq("status","draft")` filtresi kullanıyor — zaten published olan bir satırı sessizce 0-satır-etkiler (hata atmaz), bu atdd.md'nin "idempotent" kuralıyla uyumlu.
- Rollback dosyası, bucket'ta dosya varsa `DELETE`'in başarısız olacağını yorum satırında not ediyor — kabul edilebilir (acil durum prosedürü, bu görevin kapsamında otomatikleştirilmiyor).
- Frontend (`page.tsx`) bu dispatch'in kapsamında değil — ayrı bir subtask (EML-75) ile devam ediyor.
