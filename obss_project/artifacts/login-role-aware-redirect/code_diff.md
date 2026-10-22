# Code Diff — login-role-aware-redirect

## Değiştirilen dosyalar
- `web/src/app/login/actions.ts` — koşulsuz `redirect("/admin/listings")`
  kaldırıldı; `ensureAgentRow()`'un yanına `agents.is_admin` okuma
  (try/catch) eklendi, sonuca göre `/admin/listings` veya
  `/agent/dashboard`'a yönlendirme yapılıyor. Hata/satır-yok durumunda
  pessimist varsayım (`isAdmin = false`).

## Acceptance Criteria karşılanma durumu (kod incelemesiyle doğrulandı)
| AC | Durum |
|---|---|
| AC-1 (is_admin=true → /admin/listings) | ✅ |
| AC-2 (is_admin=false/satır yok → /agent/dashboard) | ✅ |
| AC-3 (sorgu hatası → pessimist) | ✅ try/catch + console.error |
| AC-4 (ensureAgentRow korunur) | ✅ değişmedi, altına eklendi |

## Kalan sınırlamalar / Varsayımlar
Yok.

## CAVEMAN self-review
Yeni soyutlama yok, mevcut fonksiyon içinde minimal bir ekleme.
