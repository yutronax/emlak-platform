"use server";

import { createClient } from "@/lib/supabase/server";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type ResendResult =
  | { status: "ok" }
  | { status: "error"; code: "invalid_email" | "rate_limited" };

// Kayıt onay e-postasını yeniden gönderir. Hesap varlığı açıklanmaz (signup AC-S3): kayıtsız adres veya
// zaten onaylı hesap hatası da "ok" döner; yalnız oran sınırı ayrıca bildirilir.
export async function resendConfirmation(rawEmail: string): Promise<ResendResult> {
  const email = String(rawEmail ?? "").trim();
  if (!EMAIL_PATTERN.test(email)) return { status: "error", code: "invalid_email" };

  const supabase = await createClient();
  const { error } = await supabase.auth.resend({
    type: "signup",
    email,
    // signup ile aynı dönüş adresi; sunucu sabitinden (AC-S5).
    options: { emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback?next=/e-posta-onay` },
  });

  const result = !error ? "ok" : error.status === 429 ? "rate_limited" : "error";
  // E-posta loglanmaz; yalnız sonuç (şifre sıfırlamayla aynı ilke).
  console.info("confirmation_resend_requested", { result });

  return result === "rate_limited" ? { status: "error", code: "rate_limited" } : { status: "ok" };
}
