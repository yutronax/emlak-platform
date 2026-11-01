"use server";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export async function signOut(): Promise<never> {
  const supabase = await createClient();
  // Yalnız bu cihazın oturumu; "tüm cihazlar" profil > Güvenlik'te.
  const { error } = await supabase.auth.signOut({ scope: "local" });
  // Hata olsa da kullanıcı çıkmak istedi; içeride tutmak yerine giriş sayfasına gönder.
  if (error) console.error("signOut başarısız", error);
  redirect("/login");
}
