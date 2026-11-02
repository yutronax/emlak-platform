"use server";

import type { Deal, ListResult, ShowcaseFilters, ShowcaseItem } from "@/lib/showcase-ui/types";
import { createServiceRoleClient } from "@/lib/supabase/server";

// Herkese açık vitrin okuması. Görünüm (0029) yalnız servis rolüne açık; burada yalnız yayındaki,
// bilgisi tam ve telefon onayı veren emlakçıların videoları döner. Video imzalı, kısa ömürlü URL ile.

const PAGE = 6;
const VIDEO_BUCKET = "property-videos";
const SIGNED_TTL = 60 * 60;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const COLUMNS =
  "id, published_at, storage_path, duration_sec, title, deal, price_minor, city, district, rooms, area_m2, floor, building_age, heating, description, agent_name, agent_phone";

export type ShowcaseRow = {
  id: string;
  published_at: string;
  storage_path: string;
  duration_sec: number;
  title: string;
  deal: Deal;
  price_minor: number;
  city: string;
  district: string;
  rooms: string;
  area_m2: number;
  floor: string | null;
  building_age: number | null;
  heating: string | null;
  description: string;
  agent_name: string;
  agent_phone: string;
};

type Db = ReturnType<typeof createServiceRoleClient>;

async function toItems(db: Db, rows: ShowcaseRow[]): Promise<ShowcaseItem[]> {
  const paths = rows.map((r) => r.storage_path);
  const { data } = paths.length
    ? await db.storage.from(VIDEO_BUCKET).createSignedUrls(paths, SIGNED_TTL)
    : { data: [] as { path: string | null; signedUrl: string }[] };
  const urls = new Map((data ?? []).map((d) => [d.path, d.signedUrl]));
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    deal: r.deal,
    priceMinor: Number(r.price_minor),
    city: r.city,
    district: r.district,
    rooms: r.rooms,
    areaM2: r.area_m2,
    floor: r.floor,
    buildingAge: r.building_age,
    heating: r.heating,
    description: r.description,
    durationSec: r.duration_sec,
    posterUrl: null,
    videoUrl: urls.get(r.storage_path) ?? null,
    publishedAt: r.published_at,
    // Veritabanında +90'sız 10 hane.
    agent: { name: r.agent_name, phone: `+90${r.agent_phone}` },
  }));
}

export async function showcaseCities(): Promise<string[]> {
  const db = createServiceRoleClient();
  const { data, error } = await db.from("showcase_items").select("city");
  if (error) return [];
  return [...new Set((data ?? []).map((r) => r.city as string))].sort((a, b) => a.localeCompare(b, "tr"));
}

export async function showcaseList(f: ShowcaseFilters, cursor?: string): Promise<ListResult> {
  const db = createServiceRoleClient();
  const start = cursor && /^\d{1,6}$/.test(cursor) ? Number(cursor) : 0;

  let q = db.from("showcase_items").select(COLUMNS, { count: "exact" });
  if (f.deal) q = q.eq("deal", f.deal);
  if (f.city) q = q.eq("city", f.city);
  if (f.rooms === "4+") q = q.gte("room_count", 4);
  else if (f.rooms) q = q.eq("rooms", f.rooms);
  if (f.minPrice) q = q.gte("price_minor", f.minPrice);
  if (f.maxPrice) q = q.lte("price_minor", f.maxPrice);
  q =
    f.sort === "fiyat-artan"
      ? q.order("price_minor", { ascending: true })
      : f.sort === "fiyat-azalan"
        ? q.order("price_minor", { ascending: false })
        : q.order("published_at", { ascending: false });

  const { data, error, count } = await q.order("id").range(start, start + PAGE - 1);
  if (error) {
    console.error("showcase_list_failed", { code: error.code });
    return { status: "error" };
  }
  const items = await toItems(db, (data ?? []) as unknown as ShowcaseRow[]);
  const total = count ?? items.length;
  return { status: "ok", items, total, nextCursor: start + PAGE < total ? String(start + PAGE) : null };
}

export async function showcaseGet(
  id: string,
): Promise<{ status: "ok"; item: ShowcaseItem; similar: ShowcaseItem[] } | { status: "not_found" } | { status: "error" }> {
  if (!UUID_RE.test(id)) return { status: "not_found" };
  const db = createServiceRoleClient();
  const { data, error } = await db.from("showcase_items").select(COLUMNS).eq("id", id).maybeSingle();
  if (error) {
    console.error("showcase_get_failed", { code: error.code });
    return { status: "error" };
  }
  if (!data) return { status: "not_found" };
  const row = data as unknown as ShowcaseRow;
  const { data: sim } = await db
    .from("showcase_items")
    .select(COLUMNS)
    .eq("city", row.city)
    .eq("deal", row.deal)
    .neq("id", id)
    .order("published_at", { ascending: false })
    .limit(3);
  const [item, ...similar] = await toItems(db, [row, ...((sim ?? []) as unknown as ShowcaseRow[])]);
  return { status: "ok", item, similar };
}
