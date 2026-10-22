# Plan — login-role-aware-redirect
_Reference: atdd.md_

Frontend-pipeline: tetikleyici yok (sadece bir Server Action dosyası,
`.ts` — hiçbir `.tsx`/sayfa bileşeni değişmiyor).

## Files to Modify
| File | Why | Risk | Alan |
|------|-----|------|------|
| web/src/app/login/actions.ts | AC-1..4 | low | backend |

## New Files
| File | Purpose | Alan |
|------|---------|------|
| (yok — actions.test.ts zaten var, genişletilecek) | — | backend |

## Dependencies
- Mevcut `login()` fonksiyonu: `signInWithPassword` → `getUser` →
  (varsa) `ensureAgentRow` → `redirect("/admin/listings")` (koşulsuz).
  SONUNA, `ensureAgentRow` çağrısından SONRA, is_admin okuma + role-aware
  redirect eklenir:
  ```ts
  let isAdmin = false;
  try {
    const { data: agent, error: agentError } = await supabase
      .from("agents")
      .select("is_admin")
      .eq("id", userData.user.id)
      .maybeSingle();
    if (agentError) {
      console.error("login: agents.is_admin okunamadı", agentError);
    } else {
      isAdmin = agent?.is_admin === true;
    }
  } catch (err) {
    console.error("login: agents.is_admin okunamadı", err);
  }
  redirect(isAdmin ? "/admin/listings" : "/agent/dashboard");
  ```
  (`agents_self_select` RLS politikası zaten `id = auth.uid()` ile bunu
  destekliyor — `requireAdmin()`'in KULLANDIĞI AYNI okuma deseni, yeni bir
  RLS/yetki değişikliği gerekmiyor.)
- Bu okuma, `userData.user` bloğunun İÇİNDE olmalı (zaten `if
  (userData.user)` kontrolü var) — `userData.user` yoksa (teorik olarak
  olmamalı, signInWithPassword başarılıysa her zaman olmalı) fallback
  `/agent/dashboard` olur.

## Migration Required?
No.

## Risks
Yok.

## Open Questions
Yok.

## Alan etiketleme
Tek dosya: backend (Server Action, DB sorgusu).
