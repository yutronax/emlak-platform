import type { createClient } from "@/lib/supabase/server";

type ServerClient = Awaited<ReturnType<typeof createClient>>;

const TERMS_VERSION = "2026-10";

export async function ensureAgentRow(
  supabase: ServerClient,
  userId: string,
  companyName: string,
  terms?: { accepted: boolean },
): Promise<void> {
  const payload: Record<string, string> = { id: userId, company_name: companyName };
  if (terms?.accepted) {
    payload.terms_accepted_at = new Date().toISOString();
    payload.terms_version = TERMS_VERSION;
  }

  const { error } = await supabase.from("agents").insert(payload);
  if (error && error.code !== "23505") {
    console.error("agents satırı oluşturulamadı", error);
    throw error;
  }

  // Deneme başarısızlığı kaydı bozmaz: hata yutulur, dashboard tekrar dener.
  try {
    const { error: trialError } = await supabase.rpc("start_trial");
    if (trialError) {
      console.error("trial_create_failed", { agent_id: userId, error_code: trialError.code });
    }
  } catch (e) {
    const code = (e as { code?: string } | null)?.code ?? (e instanceof Error ? e.name : "unknown");
    console.error("trial_create_failed", { agent_id: userId, error_code: code });
  }
}
