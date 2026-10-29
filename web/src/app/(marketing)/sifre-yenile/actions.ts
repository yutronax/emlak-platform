"use server";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

const EXPIRED_MESSAGE = "Bağlantının süresi dolmuş";
const TOO_SHORT_MESSAGE = "En az 8 karakter";
const MISMATCH_MESSAGE = "Şifreler eşleşmiyor";
const FAILED_MESSAGE = "Şifre güncellenemedi, lütfen tekrar deneyin.";

export async function updatePassword(
  formData: FormData,
): Promise<{ error: string } | never> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();

  // AC-S7: recovery oturumu yoksa şifre güncellenmez.
  if (!data.user) return { error: EXPIRED_MESSAGE };

  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("password_confirm") ?? "");

  if (password.length < 8) return { error: TOO_SHORT_MESSAGE };
  if (password !== confirm) return { error: MISMATCH_MESSAGE };

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    // AC-12: yalnız sebep kodu loglanır; şifre ve mesaj loglanmaz.
    console.error("password_update_failed", { reason: error.code ?? "unknown" });
    return { error: FAILED_MESSAGE };
  }

  redirect("/agent/dashboard?password_updated=1");
}
