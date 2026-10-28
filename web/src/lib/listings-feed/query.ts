import type { SupabaseClient } from "@supabase/supabase-js";

import type { FeedFilterOptions, ParsedFilters } from "./filters";

const PAGE_SIZE = 20;
export const QUERY_TIMEOUT_MS = 5_000;
const OPTIONS_LIMIT = 1000;
const FIVE_PLUS_ROOMS = ["5+1", "5+2", "6+1", "6+2", "7+1", "8+1"];
const LISTING_COLUMNS =
  "id,title,price,currency,rooms,area_m2,city,district,source_group_name,created_at";

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

export type FeedResult =
  | { ok: true; items: FeedRow[] }
  | { ok: false; code: string };

type OptionRow = {
  city: string | null;
  district: string | null;
  source_group_name: string | null;
};

function distinct(values: (string | null)[]): string[] {
  return [...new Set(values.filter((v): v is string => v !== null))];
}

export async function fetchFeed(
  supabase: SupabaseClient,
  filters: ParsedFilters,
): Promise<FeedResult> {
  const from = (filters.sayfa - 1) * PAGE_SIZE;

  try {
    let query = supabase.from("listings").select(LISTING_COLUMNS);
    if (filters.il) query = query.eq("city", filters.il);
    if (filters.ilce) query = query.eq("district", filters.ilce);
    if (filters.grup) query = query.eq("source_group_name", filters.grup);
    if (filters.fiyatMin !== null || filters.fiyatMax !== null) {
      query = query.eq("currency", "TRY").not("price", "is", null);
    }
    if (filters.fiyatMin !== null) query = query.gte("price", filters.fiyatMin);
    if (filters.fiyatMax !== null) query = query.lte("price", filters.fiyatMax);
    if (filters.oda === "5+") query = query.in("rooms", FIVE_PLUS_ROOMS);
    else if (filters.oda) query = query.eq("rooms", filters.oda);

    const { data, error } = await query
      .order("created_at", { ascending: false })
      .range(from, from + PAGE_SIZE - 1)
      .abortSignal(AbortSignal.timeout(QUERY_TIMEOUT_MS));

    if (error) {
      console.error("[dashboard] listings query failed", { code: error.code });
      return { ok: false, code: error.code ?? "unknown" };
    }
    return { ok: true, items: (data ?? []) as FeedRow[] };
  } catch (err) {
    const code = err instanceof Error ? err.name : "unknown";
    console.error("[dashboard] listings query failed", { code });
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
      .from("listings")
      .select("city,district,source_group_name")
      .limit(OPTIONS_LIMIT)
      .abortSignal(AbortSignal.timeout(QUERY_TIMEOUT_MS));

    if (error) {
      console.error("[dashboard] listings query failed", { code: error.code });
      return empty;
    }

    const rows = (data ?? []) as OptionRow[];
    const districtRows = il ? rows.filter((r) => r.city === il) : rows;
    return {
      cities: distinct(rows.map((r) => r.city)),
      districts: distinct(districtRows.map((r) => r.district)),
      groups: distinct(rows.map((r) => r.source_group_name)),
    };
  } catch (err) {
    const code = err instanceof Error ? err.name : "unknown";
    console.error("[dashboard] listings query failed", { code });
    return empty;
  }
}
