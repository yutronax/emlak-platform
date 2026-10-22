import type { createClient } from "@/lib/supabase/server";

type ServerClient = Awaited<ReturnType<typeof createClient>>;

export async function ensureAgentRow(
  supabase: ServerClient,
  userId: string,
  companyName: string,
): Promise<void> {
  const { error } = await supabase.from("agents").insert({ id: userId, company_name: companyName });
  if (error && error.code !== "23505") {
    console.error("agents satırı oluşturulamadı", error);
    throw error;
  }
}
