"use server";

import { notFound, redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

const GENERIC_ERROR = "Kod geçersiz ya da süresi doldu.";
const CODE_PATTERN = /^\d{6}$/;

// Yetki: yalnız oturum + admin kontrolü. aal1 admin de burada doğrulama yapabilmeli
// (aal2'yi bu action ister, requireAdmin kullanılmaz). Kod/secret asla loglanmaz.
export async function verifyMfa(formData: FormData): Promise<{ status: "error"; message: string }> {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    redirect("/login");
  }

  const { data: agent } = await supabase
    .from("agents")
    .select("is_admin")
    .eq("id", userData.user.id)
    .maybeSingle();
  if (!agent?.is_admin) {
    notFound();
  }

  const factorId = String(formData.get("factorId") ?? "");
  const code = String(formData.get("code") ?? "");
  if (!factorId || !CODE_PATTERN.test(code)) {
    return { status: "error", message: GENERIC_ERROR };
  }

  try {
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code });
    if (error) {
      return { status: "error", message: GENERIC_ERROR };
    }
  } catch {
    return { status: "error", message: GENERIC_ERROR };
  }

  redirect("/admin/listings");
}
