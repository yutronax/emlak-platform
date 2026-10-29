"use server";

import { redirect } from "next/navigation";

import { ensureAgentRow } from "@/lib/auth/ensureAgentRow";
import { createClient } from "@/lib/supabase/server";

const GENERIC_MESSAGE = "Kayıt alındı; hesabınız varsa e-postanızı kontrol edin veya giriş yapın.";
const TERMS_ERROR = "Devam etmek için şartları kabul etmeniz gerekiyor.";
// Sunucu sabiti: istemciden gelen değer kullanılmaz (AC-S4).
const TERMS_VERSION = "2026-10";

export async function signup(formData: FormData): Promise<{ message: string } | { error: string }> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const companyName = String(formData.get("company_name") ?? "").trim();
  const terms = formData.get("terms");

  if (!email || !password) return { error: "E-posta ve şifre gerekli." };
  if (companyName.length < 2 || companyName.length > 100) {
    return { error: "Şirket adı gerekli (2-100 karakter)." };
  }
  // AC-2 / AC-S4: yalnız işaretli kutu ("on"/"true") kabul edilir.
  if (terms !== "on" && terms !== "true") {
    console.info("signup_terms_missing");
    return { error: TERMS_ERROR };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { company_name: companyName, terms_version: TERMS_VERSION } },
  });

  if (error) {
    // AC-S3: e-posta varlığını doğrulayan bir mesaj gösterilmez (enumeration önlenir).
    return { message: GENERIC_MESSAGE };
  }

  if (data.session && data.user) {
    try {
      await ensureAgentRow(supabase, data.user.id, companyName, { accepted: true });
    } catch (err) {
      // Emlakçı kaydı olmadan panel ve siparişler çalışmaz; yarım hesapla içeri alma.
      console.error("signup: ensureAgentRow başarısız", err);
      await supabase.auth.signOut();
      return {
        error: "Hesabınız hazırlanırken bir sorun oluştu. Lütfen tekrar deneyin; sorun sürerse WhatsApp'tan bize yazın.",
      };
    }
    redirect("/agent/dashboard");
  }

  // E-posta onayı açıksa session yok: terms_version user_metadata'da, ilk girişte yazılır.
  return { message: GENERIC_MESSAGE };
}
