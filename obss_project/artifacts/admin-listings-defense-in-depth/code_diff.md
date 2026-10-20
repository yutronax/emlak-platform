# Code Diff — admin-listings-defense-in-depth

## Oluşturulan dosyalar
- `web/src/lib/auth/requireAdmin.ts` — side-effect'siz helper, oturum/admin
  kararını `{ok,...}` olarak döner, redirect/throw yapmaz.

## Değiştirilen dosyalar
- `web/src/app/admin/listings/actions.ts` — `approveListing`/`rejectListing`
  önce `requireAdmin()` çağırıyor; `no-session` → redirect("/login"),
  `not-admin` → throw "Bu işlem için yetkiniz yok" (RPC'ye hiç gidilmiyor).
  Kendi `createClient()` çağrısı kaldırıldı, `requireAdmin()`'in döndürdüğü
  client kullanılıyor. Hata mesajları generic, gerçek hata console.error'da.
- `web/src/app/admin/listings/page.tsx` — `requireAdmin()` kullanıyor,
  `no-session`→/login, `not-admin`→/agent/dashboard. Hata mesajı generic.

## Acceptance Criteria karşılanma durumu (kod incelemesiyle doğrulandı)
| AC | Durum |
|---|---|
| AC-S1 (admin değilse RPC yok) | ✅ `requireAdmin()` kontrolü RPC'den önce |
| AC-S2 (auth/admin guard) | ✅ her iki dosyada da |
| AC-S3 (hata sızıntısı yok) | ✅ generic mesaj + console.error |
| AC-4 (admin action happy path) | ✅ değişmedi |
| AC-5 (admin page happy path) | ✅ değişmedi |

## Kalan sınırlamalar / Varsayımlar
- Test dosyalarındaki `createClient` mock'ları artık kodda kullanılmıyor
  (requireAdmin kendi içinde çağırıyor) — test dosyalarına dokunulmadığı
  için bu zararsız bir kalıntı, testler zaten PASS.

## CAVEMAN self-review
`requireAdmin()` tek yeni dosya — plan.md'de zaten öngörülmüştü, paylaşılan
3 kullanım yeri (page + 2 action) için gerekli bir soyutlama. Side-effect'siz
tasarım kasıtlı (tek sorumluluk), redirect/throw çağıran koda bırakıldı.
