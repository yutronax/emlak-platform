import type { SupabaseClient } from "@supabase/supabase-js";

import type { FeedFilterOptions, ParsedFilters } from "./filters";

export const QUERY_TIMEOUT_MS = 5_000;

// Açık satır: sunucu tüm ilan alanlarını döner (EML-98 AC-1).
export type FeedRow = {
  id: string;
  title: string;
  price: number | null;
  currency: string;
  rooms: string | null;
  area_m2: number | null;
  city: string | null;
  district: string | null;
  source_group_name: string | null;
  created_at: string;
};

export type OpenFeedRow = FeedRow & { locked: false };

// Kilitli satır: yalnız bu 5 anahtar (AC-4 / AC-S2). Başka alan gelmez.
export type LockedFeedRow = {
  id: string;
  city: string | null;
  district: string | null;
  created_at: string;
  locked: true;
};

export type FeedItem = OpenFeedRow | LockedFeedRow;

export type FeedResult =
  | {
      ok: true;
      items: FeedItem[];
      lockedCount: number | null;
      limit: number | null;
      openToday: number;
      reason?: string;
    }
  | { ok: false; code: string };

type FeedRpcBody = {
  items?: FeedItem[];
  locked_count?: number;
  limit?: number | null;
  open_today?: number;
  reason?: string;
};

export async function fetchFeed(
  supabase: SupabaseClient,
  filters: ParsedFilters,
): Promise<FeedResult> {
  try {
    const { data, error } = await supabase
      .rpc("feed_listings", {
        p_filters: {
          il: filters.il,
          ilce: filters.ilce,
          grup: filters.grup,
          fiyatMin: filters.fiyatMin,
          fiyatMax: filters.fiyatMax,
          oda: filters.oda,
        },
        p_page: filters.sayfa,
      })
      .abortSignal(AbortSignal.timeout(QUERY_TIMEOUT_MS));

    if (error) {
      console.error("[dashboard] feed rpc failed", { code: error.code });
      return { ok: false, code: error.code ?? "unknown" };
    }

    const body = (data ?? {}) as FeedRpcBody;
    const result: FeedResult = {
      ok: true,
      items: body.items ?? [],
      lockedCount: body.locked_count ?? null,
      limit: body.limit ?? null,
      openToday: body.open_today ?? 0,
    };
    if (body.reason !== undefined) result.reason = body.reason;
    return result;
  } catch (err) {
    const code = err instanceof Error ? err.name : "unknown";
    console.error("[dashboard] feed rpc failed", { code });
    return { ok: false, code };
  }
}

export async function fetchFilterOptions(
  supabase: SupabaseClient,
  il: string | null,
): Promise<FeedFilterOptions> {
  const empty: FeedFilterOptions = { cities: [], districts: [], groups: [] };

  try {
    const { data, error } = await supabase
      .rpc("feed_filter_options", { p_il: il ?? null })
      .abortSignal(AbortSignal.timeout(QUERY_TIMEOUT_MS));

    if (error) {
      console.error("[dashboard] feed options rpc failed", { code: error.code });
      return empty;
    }

    const body = (data ?? {}) as Partial<FeedFilterOptions>;
    return {
      cities: body.cities ?? [],
      districts: body.districts ?? [],
      groups: body.groups ?? [],
    };
  } catch (err) {
    const code = err instanceof Error ? err.name : "unknown";
    console.error("[dashboard] feed options rpc failed", { code });
    return empty;
  }
}
