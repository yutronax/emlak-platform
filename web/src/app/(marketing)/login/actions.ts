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
    if ((error as { code?: string }).code === "email_not_confirmed") {
      return {
        error:
          "E-posta adresiniz henüz onaylanmadı. Kayıt olurken gelen e-postadaki onay linkine tıklayın (spam klasörüne de bakın).",
      };
    }
    return { error: "Giriş başarısız: e-posta veya şifre hatalı." };
  }

  const { data: userData } = await supabase.auth.getUser();
  let isAdmin = false;
  if (userData.user) {
    const companyName = String(userData.user.user_metadata?.company_name ?? "");
    if (companyName) {
      try {
        await ensureAgentRow(supabase, userData.user.id, companyName);
      } catch (err) {
        // Emlakçı kaydı olmadan panel ve siparişler çalışmaz; yarım hesapla içeri alma.
        console.error("login: ensureAgentRow başarısız", err);
        await supabase.auth.signOut();
        return {
          error: "Hesabınız hazırlanırken bir sorun oluştu. Lütfen tekrar deneyin; sorun sürerse WhatsApp'tan bize yazın.",
        };
      }
    }

    try {
      const { data: agent, error: agentError } = await supabase
        .from("agents")
        .select("is_admin")
        .eq("id", userData.user.id)
        .maybeSingle();
      if (agentError) {
        console.error("login: agents.is_admin okunamadı", agentError);
      } else {
        isAdmin = agent?.is_admin === true;
      }
    } catch (err) {
      console.error("login: agents.is_admin okunamadı", err);
    }
  }

  redirect(isAdmin ? "/admin/listings" : "/agent/dashboard");
}
