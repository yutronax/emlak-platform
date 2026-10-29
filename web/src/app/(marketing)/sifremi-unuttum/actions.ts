"use server";

import { createClient } from "@/lib/supabase/server";

const INVALID_EMAIL_MESSAGE = "Geçerli bir e-posta girin";
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Kayıtlı / kayıtsız / rate-limit: tek dönüş şekli (AC-S6). Supabase hatası kullanıcıya iletilmez.
export async function requestPasswordReset(
  formData: FormData,
): Promise<{ ok: true } | { error: string }> {
  const email = String(formData.get("email") ?? "").trim();
  if (!EMAIL_PATTERN.test(email)) return { error: INVALID_EMAIL_MESSAGE };

  // redirectTo sunucu sabitinden üretilir; istek header'ı okunmaz (AC-S5).
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${siteUrl}/auth/callback?next=/sifre-yenile`,
  });

  // AC-S8: e-posta, token veya IP loglanmaz; yalnız sonuç.
  const result = !error ? "ok" : error.status === 429 ? "rate_limited" : "error";
  console.info("password_reset_requested", { result });

  return { ok: true };
}
