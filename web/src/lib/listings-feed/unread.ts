import type { SupabaseClient } from "@supabase/supabase-js";

import { QUERY_TIMEOUT_MS } from "./query";

const UNREAD_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

// agentId: listings havuzu ortak (Faz 3'e kadar); okunmamış durum yalnız agents.listings_seen_at'tan gelir.
// Sayım feed_unread_count RPC'sinde (security definer): aboneliksiz → 0, üst sınır 100, kilitliler dahil.
export async function getUnreadCount(
  supabase: SupabaseClient,
  _agentId: string,
  seenAt: string | null,
): Promise<number | null> {
  const since = seenAt ?? new Date(Date.now() - UNREAD_WINDOW_MS).toISOString();

  try {
    const { data, error } = await supabase
      .rpc("feed_unread_count", { p_since: since })
      .abortSignal(AbortSignal.timeout(QUERY_TIMEOUT_MS));

    if (error) {
      console.error("[dashboard] unread count failed", { code: error.code || "timeout" });
      return null;
    }
    return typeof data === "number" ? data : 0;
  } catch (err) {
    const name = err instanceof Error ? err.name : "unknown";
    const code = name === "AbortError" || name === "TimeoutError" ? "timeout" : name;
    console.error("[dashboard] unread count failed", { code });
    return null;
  }
}
