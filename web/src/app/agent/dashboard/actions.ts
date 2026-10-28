"use server";

import type { SupabaseClient } from "@supabase/supabase-js";

import { getUnreadCount } from "@/lib/listings-feed/unread";
import { createClient } from "@/lib/supabase/server";

type SubscriptionRow = {
  status: string;
  current_period_end: string | null;
};

// Sayfadaki erişim kuralıyla aynı: açık abonelik satırı, status active|trialing, süre dolmamış.
async function hasActiveSubscription(
  supabase: SupabaseClient,
  userId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("subscriptions")
    .select("status, current_period_end")
    .eq("agent_id", userId)
    .in("status", ["trialing", "active", "past_due"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) return false;
  const row = data as SubscriptionRow | null;
  return (
    row !== null &&
    (row.status === "active" || row.status === "trialing") &&
    row.current_period_end !== null &&
    new Date(row.current_period_end) > new Date()
  );
}

// Argüman almaz: hedef satır her zaman oturumdaki kullanıcıdır (AC-S1).
export async function markListingsSeen(): Promise<{ ok: boolean }> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false };

  const { data, error } = await supabase.rpc("mark_listings_seen");
  if (error) {
    console.error("[dashboard] seen_at update failed", { code: error.code });
    return { ok: false };
  }
  if (!data) {
    console.warn("[dashboard] seen_at update affected 0 rows");
    return { ok: false };
  }
  return { ok: true };
}

export async function refreshUnreadCount(): Promise<
  { ok: true; count: number } | { ok: false }
> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false };

  // Abonelik yoksa listings sorgusu hiç atılmaz (AC-S3).
  if (!(await hasActiveSubscription(supabase, auth.user.id))) return { ok: false };

  const { data: agent } = await supabase
    .from("agents")
    .select("listings_seen_at")
    .eq("id", auth.user.id)
    .maybeSingle();
  const seenAt =
    (agent as { listings_seen_at: string | null } | null)?.listings_seen_at ?? null;

  const count = await getUnreadCount(supabase, auth.user.id, seenAt);
  return count === null ? { ok: false } : { ok: true, count };
}
