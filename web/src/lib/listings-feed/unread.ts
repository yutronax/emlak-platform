import type { SupabaseClient } from "@supabase/supabase-js";

import { QUERY_TIMEOUT_MS } from "./query";

const UNREAD_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const COUNT_LIMIT = 100;

// agentId: listings havuzu ortak (Faz 3'e kadar); okunmamış durum yalnız agents.listings_seen_at'tan gelir.
export async function getUnreadCount(
  supabase: SupabaseClient,
  _agentId: string,
  seenAt: string | null,
): Promise<number | null> {
  const since = seenAt ?? new Date(Date.now() - UNREAD_WINDOW_MS).toISOString();

  try {
    const { count, error } = await supabase
      .from("listings")
      .select("id", { count: "exact", head: true })
      .gt("created_at", since)
      .limit(COUNT_LIMIT)
      .abortSignal(AbortSignal.timeout(QUERY_TIMEOUT_MS));

    if (error) {
      console.error("[dashboard] unread count failed", { code: error.code || "timeout" });
      return null;
    }
    return count ?? 0;
  } catch (err) {
    const name = err instanceof Error ? err.name : "unknown";
    const code = name === "AbortError" || name === "TimeoutError" ? "timeout" : name;
    console.error("[dashboard] unread count failed", { code });
    return null;
  }
}
