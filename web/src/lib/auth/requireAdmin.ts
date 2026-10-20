import { createClient } from "@/lib/supabase/server";

export type RequireAdminResult =
  | { ok: true; supabase: Awaited<ReturnType<typeof createClient>>; userId: string }
  | { ok: false; reason: "no-session" | "not-admin" };

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

  return { ok: true, supabase, userId: auth.user.id };
}
