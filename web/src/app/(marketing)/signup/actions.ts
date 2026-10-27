"use server";

import { redirect } from "next/navigation";

import { ensureAgentRow } from "@/lib/auth/ensureAgentRow";
import { createClient } from "@/lib/supabase/server";

const GENERIC_MESSAGE = "Kayıt alındı; hesabınız varsa e-postanızı kontrol edin veya giriş yapın.";

export async function signup(formData: FormData): Promise<{ message: string } | { error: string }> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const companyName = String(formData.get("company_name") ?? "").trim();

  if (!email || !password) return { error: "E-posta ve şifre gerekli." };
  if (companyName.length < 2 || companyName.length > 100) {
    return { error: "Şirket adı gerekli (2-100 karakter)." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { company_name: companyName } },
  });

  if (error) {
    // AC-S3: e-posta varlığını doğrulayan bir mesaj gösterilmez (enumeration önlenir).
    return { message: GENERIC_MESSAGE };
  }

  if (data.session && data.user) {
    try {
      await ensureAgentRow(supabase, data.user.id, companyName);
    } catch (err) {
      console.error("signup: ensureAgentRow başarısız", err);
      // Kullanıcı yine de giriş yapmış durumda, ileride login'de tekrar denenecek (idempotent).
    }
    redirect("/agent/dashboard");
  }

  return { message: GENERIC_MESSAGE };
}
