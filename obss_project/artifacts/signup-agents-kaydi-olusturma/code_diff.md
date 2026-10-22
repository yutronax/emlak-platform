# Code Diff — signup-agents-kaydi-olusturma

## Oluşturulan dosyalar
- `web/src/lib/auth/ensureAgentRow.ts` — idempotent agent satırı oluşturma (23505 yutulur, diğer hatalar throw+log).
- `web/src/app/signup/actions.ts` — validasyon + `signUp` + user_metadata + enumeration-güvenli mesaj.
- `web/src/app/signup/page.tsx` — kayıt formu (login/page.tsx deseniyle tutarlı).
- `supabase/migrations/0006_agents_self_insert.sql` — `agents_self_insert` RLS policy (AC-S1/S2).

## Değiştirilen dosyalar
- `web/src/app/login/actions.ts` — başarılı girişten sonra `ensureAgentRow()`
  çağrısı eklendi (`user_metadata.company_name`'den okunur, boşsa çağrılmaz).

## Acceptance Criteria karşılanma durumu (kod incelemesiyle doğrulandı)
| AC | Durum |
|---|---|
| AC-1/AC-7/AC-S3 (genel mesaj, enumeration) | ✅ hem signUp hatası hem session-yok dalı AYNI mesaj |
| AC-2 (session var → ensureAgentRow+redirect) | ✅ |
| AC-3 (session yok → ensureAgentRow çağrılmaz) | ✅ |
| AC-4 (ilk giriş → ensureAgentRow) | ✅ login/actions.ts |
| AC-5/AC-S4 (idempotent) | ✅ 23505 yutulur |
| AC-6 (company_name validasyonu) | ✅ |
| AC-S1 (is_admin istemciden yok) | ✅ insert payload'ında is_admin yok + policy'de de kilitli |
| AC-S2 (cross-id insert reddi) | ✅ policy `id = auth.uid()` |

## Kalan sınırlamalar / Varsayımlar
- `login/actions.ts`'teki `ensureAgentRow` çağrısı için ayrı bir test
  dosyası YAZILMADI (atdd.md/plan.md bunu login/actions.ts'in mevcut
  davranışına minimal bir ekleme olarak tanımlamıştı, ayrı test dosyası
  öngörmemişti) — bu, `verify` adımında bir test-gap notu olarak işaretli.
- Migration henüz canlı Supabase'e uygulanmadı — `verify`'ın gate 3'ünde
  (`supabase-check`/`authz-test`) kontrol edilecek.
- `login/actions.ts`'teki `redirect("/admin/listings")` hedefi (bilinen
  ayrı bug, atdd.md'nin Risks'inde not edilmişti) DEĞİŞTİRİLMEDİ.

## CAVEMAN self-review
Yeni soyutlama yok, `ensureAgentRow` tek paylaşılan helper (plan.md'de
öngörülmüştü), `signup/page.tsx` mevcut `login/page.tsx` deseniyle
tutarlı.
