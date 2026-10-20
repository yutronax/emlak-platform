# Plan — admin-listings-defense-in-depth
_Reference: atdd.md_

Frontend-pipeline: tetikleyici VAR (`page.tsx`) ama bu bir UI reshape
DEĞİL — güvenlik/erişim-kontrolü bug fix'i, Design Direction adımı
bilinçli olarak atlandı (hiçbir görsel/layout değişikliği yok).

## Files to Modify
| File | Why | Risk | Alan |
|------|-----|------|------|
| web/src/app/admin/listings/actions.ts | AC-S1 (RPC'den önce admin kontrolü), AC-S3 (error.message sızıntısı) | medium | frontend |
| web/src/app/admin/listings/page.tsx | AC-S2 (auth+admin guard), AC-S3 (error.message sızıntısı) | medium | frontend |

## New Files
| File | Purpose | Alan |
|------|---------|------|
| web/src/lib/auth/requireAdmin.ts | Paylaşılan helper — oturum/admin kontrolü, page/action arasında davranış farkı (redirect/throw) parametreyle | frontend |
| web/src/lib/auth/requireAdmin.test.ts | Helper'ın 3 dalı (oturum yok/admin değil/admin) | frontend |
| web/src/app/admin/listings/actions.test.ts | AC-S1, AC-S3, AC-4 | frontend |
| web/src/app/admin/listings/page.test.tsx | AC-S2, AC-S3, AC-5 | frontend |

## Dependencies
- **`requireAdmin()` imzası:**
  ```ts
  type RequireAdminResult =
    | { ok: true; supabase: ServerClient; userId: string }
    | { ok: false; reason: "no-session" | "not-admin" };
  async function requireAdmin(): Promise<RequireAdminResult>
  ```
  Çağıran (page veya action) `ok: false` durumunda KENDİ bağlamına uygun
  davranışı (page: `redirect`, action: `throw`) uygular — helper'ın
  KENDİSİ redirect/throw YAPMAZ, sadece karar döner (CAVEMAN: tek
  sorumluluk, helper'ın iki farklı çağrı bağlamında iki farklı yan etki
  üretmesi karışıklık riski taşır — bu plan adımının kendi tasarım
  düzeltmesi, Opus alt-ajanının "page'de redirect, action'da throw"
  önerisini AYNI sonuca ulaştıracak ama helper'ı side-effect'siz tutarak).
  `requireAdmin()` içinde: `supabase.auth.getUser()` → user yoksa
  `{ok:false, reason:"no-session"}`; `agents` tablosundan
  `.select("is_admin").eq("id", userId).maybeSingle()` → `is_admin` true
  değilse `{ok:false, reason:"not-admin"}`; else `{ok:true, supabase,
  userId}`.
- **`page.tsx`'te kullanım:**
  ```ts
  const result = await requireAdmin();
  if (!result.ok) {
    redirect(result.reason === "no-session" ? "/login" : "/agent/dashboard");
  }
  ```
- **`actions.ts`'te kullanım (her iki action'da):**
  ```ts
  const result = await requireAdmin();
  if (!result.ok) {
    if (result.reason === "no-session") redirect("/login");
    throw new Error("Bu işlem için yetkiniz yok");
  }
  ```
  (Action içinde `redirect` çağrılabilir — Next.js Server Action'ları
  bunu destekler, atdd.md'nin AC-S2'si bunu "page.tsx" için öngörmüştü
  ama Opus alt-ajanının 2. cevabı action için de redirect öneriyordu —
  bu plan tutarlılık için her iki yerde de AYNI deseni kullanıyor.)
- **Hata mesajı sızıntısı (AC-S3):** mevcut
  `throw new Error(\`İlan onaylanamadı: ${error.message}\`)` →
  `console.error("İlan onaylanamadı", error); throw new Error("İlan onaylanamadı, lütfen tekrar deneyin");`
  (aynı desen `rejectListing`'de ve `page.tsx`'in `raw_listings` hata
  dalında tekrarlanır).

## Migration Required?
No — hiçbir şema değişikliği yok, `agents.is_admin` zaten var.

## Risks
(atdd.md'den taşındı, yeni risk bulunmadı)

## Open Questions
Yok — atdd.md'nin Unknowns bölümü boştu, bu plan adımının kendi
tasarım düzeltmesi (helper'ın side-effect'siz olması) zaten yukarıda
karara bağlandı, kullanıcı/customer kararı gerektirmiyor (teknik bir
API tasarım tercihi).

## Alan etiketleme
Tüm dosyalar frontend (Next.js app router dosyaları, Supabase client
zaten `@/lib/supabase/server`'daki mevcut frontend-katmanı helper'ı
kullanıyor).
