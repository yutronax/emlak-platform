"use server";

import { notFound, redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

const GENERIC_ERROR = "Kod geçersiz ya da süresi doldu.";
const CODE_PATTERN = /^\d{6}$/;
const NO_AUTH_ERROR = "Yetkiniz yok.";
const ENROLL_ERROR = "Kurulum başlatılamadı. Tekrar deneyin.";
const ALREADY_ENROLLED_ERROR = "MFA zaten kurulu.";

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

// Kurulum yalnız bu action'da başlar (render'da değil): QR anahtarı kullanıcı kodu girene dek sabit kalır.
// Yarım kalmış (unverified) TOTP faktörleri temizlenir, sonra yeni faktör açılır. Secret/QR loglanmaz.
export async function startEnrollment(): Promise<
  | { status: "ok"; factorId: string; qr: string; secret: string }
  | { status: "error"; message: string }
> {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return { status: "error", message: NO_AUTH_ERROR };
  }

  const { data: agent } = await supabase
    .from("agents")
    .select("is_admin")
    .eq("id", userData.user.id)
    .maybeSingle();
  if (!agent?.is_admin) {
    return { status: "error", message: NO_AUTH_ERROR };
  }

  try {
    const { data: factorData } = await supabase.auth.mfa.listFactors();
    const totp = factorData?.totp ?? [];
    // Güvenlik: doğrulanmış faktör varken yeni faktör eklenmez (parolası çalınan biri MFA'yı atlatamaz).
    if (totp.some((factor) => factor.status === "verified")) {
      return { status: "error", message: ALREADY_ENROLLED_ERROR };
    }
    for (const factor of totp) {
      await supabase.auth.mfa.unenroll({ factorId: factor.id });
    }

    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: "Admin",
    });
    if (error || !data?.totp) {
      return { status: "error", message: ENROLL_ERROR };
    }
    return {
      status: "ok",
      factorId: data.id,
      qr: data.totp.qr_code,
      secret: data.totp.secret,
    };
  } catch {
    return { status: "error", message: ENROLL_ERROR };
  }
}
