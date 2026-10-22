"use server";

import { redirect } from "next/navigation";

import { ensureAgentRow } from "@/lib/auth/ensureAgentRow";
import { createClient } from "@/lib/supabase/server";

export async function login(formData: FormData): Promise<{ error: string } | never> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "E-posta ve şifre gerekli." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: "Giriş başarısız: e-posta veya şifre hatalı." };
  }

  const { data: userData } = await supabase.auth.getUser();
  if (userData.user) {
    const companyName = String(userData.user.user_metadata?.company_name ?? "");
    if (companyName) {
      try {
        await ensureAgentRow(supabase, userData.user.id, companyName);
      } catch (err) {
        console.error("login: ensureAgentRow başarısız", err);
      }
    }
  }

  redirect("/admin/listings");
}
