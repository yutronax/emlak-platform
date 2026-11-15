import { createClient } from "@/lib/supabase/server";

export type RequireAdminResult =
  | { ok: true; supabase: Awaited<ReturnType<typeof createClient>>; userId: string }
  | { ok: false; reason: "no-session" | "not-admin" | "mfa-required" };

// Side-effect'siz: redirect/throw yapmaz, sadece karar döner.
// Çağıran (page / action) ok:false durumunda kendi bağlamına uygun davranışı uygular.
export async function requireAdmin(): Promise<RequireAdminResult> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    return { ok: false, reason: "no-session" };
  }

  const { data: agent } = await supabase
    .from("agents")
    .select("is_admin")
    .eq("id", auth.user.id)
    .maybeSingle();

  if (!agent?.is_admin) {
    return { ok: false, reason: "not-admin" };
  }

  // AC-1: admin yalnız MFA (aal2) doğrulamasından sonra yetkilidir. Okunamazsa kapalı-varsayılan.
  let currentLevel: string | null = null;
  try {
    const { data: aal, error: aalError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (!aalError) currentLevel = aal?.currentLevel ?? null;
  } catch {
    currentLevel = null;
  }
  if (currentLevel !== "aal2") {
    return { ok: false, reason: "mfa-required" };
  }

  return { ok: true, supabase, userId: auth.user.id };
}
