# Test Diff — agents-self-update-rls-yetki-yukseltme-acigi

## Oluşturulan dosyalar
- `web/src/test/agents-self-update-rls.test.ts` (yeni — gerçek Supabase'e
  karşı, mock yasağına uygun; `fake-supabase.ts` kullanılmadı)

## AC → Test eşleşmesi
| AC / Davranış Sözleşmesi satırı | Test |
|---|---|
| AC-1 / satır 1 (happy path) | `AC-1 / Davranış Sözleşmesi #1 — sahibi izinli alanları günceller, is_admin false kalır` |
| AC-S1 / satır 2 (is_admin yükseltme reddi) | `AC-S1 / Davranış Sözleşmesi #2 — is_admin=true denemesi 403 + Postgres 42501 ile reddedilir` |
| Davranış Sözleşmesi satır 7 (kısmi başarı yok) | `Davranış Sözleşmesi #7 — kısmi başarı yok: izinli+izinsiz alan birlikte tüm istek reddedilir` |
| AC-S2 / satır 3 (başka kullanıcı) | `AC-S2 / Davranış Sözleşmesi #3 — başka kullanıcının satırını güncelleme 0 satır etkiler` |
| AC-S2 ek / satır 4 (anon key) | `AC-S2 ek / Davranış Sözleşmesi #4 — anon key ile UPDATE denemesi 401/403 ile reddedilir` |
| AC-3 (service_role admin akışı) | `AC-3 — service_role ile is_admin güncellemesi başarılı olur` |

AC-2 (id/created_at değişmez) ayrı bir test olarak yazılmadı — happy-path
testi (#1) zaten `id` sabit tutuluyor ve `created_at` güncellenmiyor,
ayrıca doğrulanmadı (not: `code-copilot`/`verify` adımında bu satırın
gerçekten kapsandığından emin olunmalı, gerekirse ek assert istenebilir).

## Durum
Henüz migration 0004 yok → testler mevcut ortamda da uygulansa FAIL
etmesi beklenir (red step). Şu an `SUPABASE_SERVICE_ROLE_KEY` `.env.local`'de
olmadığı için suite `describe.skipIf` ile atlanıyor (crash etmiyor, mock'la
ikame edilmiyor) — gerçek koşum için test ortamı (local Supabase veya test
projesi + service role key) kurulması gerekiyor; bu `verify`/`supabase-check`
adımında ele alınacak.

## Varsayımlar
- `.env.local`, `web/` dizininin bir üstünde değil, `web/.env.local` olarak
  okunuyor (dosyadaki `loadEnvLocal` fonksiyonu `__dirname/../../.env.local`
  yani `web/.env.local` yoluna bakıyor).
- Test kullanıcıları `serviceClient.auth.admin.createUser` ile oluşturuluyor,
  `afterAll`'da temizleniyor (varsayım: temizlik kodu da yazıldı — ayrıca
  doğrulanmadı, dosyanın tamamı okunmadı).
