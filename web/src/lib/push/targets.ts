import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Cron gönderim hedefleri ve yardımcı sorgular. Yalnız service_role istemcisiyle
 * çağrılır (cron route). İstemci girdisi almaz.
 */

/** Erişimi olan abonelik durumları (AC-3). */
export const ACCESS_STATUSES = ["active", "trialing", "past_due"] as const;

const PAGE_SIZE = 1000;

export type PushTarget = {
  id: string;
  agent_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  /** Yeni ilan sayımının başlangıcı: coalesce(last_notified_at, created_at). */
  since: string;
};

type PushRow = {
  id: string;
  agent_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  created_at: string;
  last_notified_at: string | null;
};

type PageResult<T> = { data: T[] | null; error: unknown };

/**
 * PostgREST varsayılan olarak 1000 satır döndürür; tüm sayfaları sırayla toplar.
 * `order("id")` ile sayfalar kararlı tutulur.
 */
async function selectAll<T>(
  run: (from: number, to: number) => PromiseLike<PageResult<T>>,
): Promise<PageResult<T>> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await run(from, from + PAGE_SIZE - 1);
    if (error) return { data: null, error };
    const page = data ?? [];
    out.push(...page);
    if (page.length < PAGE_SIZE) return { data: out, error: null };
  }
}

/**
 * Erişimi olan (subscriptions: active/trialing/past_due ve current_period_end > now)
 * agent'ların push abonelik satırlarını döner. Erişimi olmayan satırlar silinmez,
 * yalnız burada atlanır (AC-3).
 */
export async function loadTargets(
  admin: SupabaseClient,
): Promise<{ data: PushTarget[] | null; error: unknown }> {
  const nowIso = new Date().toISOString();

  const subs = await selectAll<{ id: string; agent_id: string }>((from, to) =>
    admin
      .from("subscriptions")
      .select("id, agent_id")
      .in("status", [...ACCESS_STATUSES])
      .gt("current_period_end", nowIso)
      .order("id")
      .range(from, to),
  );
  if (subs.error) return { data: null, error: subs.error };

  const accessible = new Set((subs.data ?? []).map((s) => s.agent_id));
  if (accessible.size === 0) return { data: [], error: null };

  const rows = await selectAll<PushRow>((from, to) =>
    admin
      .from("push_subscriptions")
      .select("id, agent_id, endpoint, p256dh, auth, created_at, last_notified_at")
      .order("id")
      .range(from, to),
  );
  if (rows.error) return { data: null, error: rows.error };

  const data: PushTarget[] = (rows.data ?? [])
    .filter((r) => accessible.has(r.agent_id))
    .map((r) => ({
      id: r.id,
      agent_id: r.agent_id,
      endpoint: r.endpoint,
      p256dh: r.p256dh,
      auth: r.auth,
      since: r.last_notified_at ?? r.created_at,
    }));

  return { data, error: null };
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * `since` anından sonra onaylanmış ilan sayısı, hedef agent'a görünür olanlar:
 * ortak havuz (owner_agent_id is null) ve agent'ın KENDİ kişisel ilanları (AC-S1).
 * Başka emlakçının kişisel ilanı bu agent'a sayılmaz.
 */
export async function countNewListings(
  admin: SupabaseClient,
  since: string,
  agentId: string,
): Promise<{ count: number; error: unknown }> {
  if (!UUID_RE.test(agentId)) return { count: 0, error: new Error("invalid agent_id") };
  const { count, error } = await admin
    .from("listings")
    .select("id", { count: "exact", head: true })
    .gt("created_at", since)
    .or(`owner_agent_id.is.null,owner_agent_id.eq.${agentId}`);
  if (error) return { count: 0, error };
  return { count: count ?? 0, error: null };
}

/** Başarılı gönderimden sonra yalnız o satırın last_notified_at değerini yazar. */
export async function markNotified(
  admin: SupabaseClient,
  subscriptionId: string,
  notifiedAt: string,
): Promise<{ error: unknown }> {
  const { error } = await admin
    .from("push_subscriptions")
    .update({ last_notified_at: notifiedAt })
    .eq("id", subscriptionId);
  return { error: error ?? null };
}

/** 404/410 (push servisi aboneliği geçersiz saydı) → satırı id ile siler. */
export async function removeSubscription(
  admin: SupabaseClient,
  subscriptionId: string,
): Promise<{ error: unknown }> {
  const { error } = await admin
    .from("push_subscriptions")
    .delete()
    .eq("id", subscriptionId);
  return { error: error ?? null };
}
