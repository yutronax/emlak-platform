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
  let isAdmin = false;
  if (userData.user) {
    const companyName = String(userData.user.user_metadata?.company_name ?? "");
    if (companyName) {
      try {
        await ensureAgentRow(supabase, userData.user.id, companyName);
      } catch (err) {
        console.error("login: ensureAgentRow başarısız", err);
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
