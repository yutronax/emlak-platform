"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/auth/requireAdmin";
import type { Currency, ParsedFields, RejectReason, ReviewItem, ReviewQuery, ReviewService } from "@/lib/review-ui/types";

import { setPersonalThreshold } from "./actions";

// İnceleme masasının gerçek servisi. Yetki requireAdmin + RLS (admin politikaları) + RPC içi kontrol.
// Süzme/sayfalama sunucuda (PostgREST); eşik RPC'leri mevcut aksiyonlarla aynı.

const PAGE = 20;
const CURRENCIES: Currency[] = ["TRY", "USD", "EUR"];
const DB_KEYS: Record<keyof ParsedFields, string> = {
  title: "title",
  price: "price",
  currency: "currency",
  rooms: "rooms",
  areaM2: "area_m2",
  city: "city",
  district: "district",
  neighborhood: "neighborhood",
  description: "description",
};

type Row = {
  id: string;
  raw_text: string;
  source_group: string | null;
  quality_score: number | null;
  created_at: string;
  owner_agent_id: string | null;
  owner: { company_name: string | null } | null;
  parsed: Record<string, unknown> | null;
};

const str = (v: unknown) => (typeof v === "string" ? v : "");
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);

export async function toDbEdits(edits: Partial<ParsedFields>): Promise<Record<string, unknown>> {
  return Object.fromEntries(
    (Object.keys(edits) as (keyof ParsedFields)[]).filter((k) => k in DB_KEYS).map((k) => [DB_KEYS[k], edits[k]]),
  );
}

export async function toReviewItem(r: Row): Promise<ReviewItem> {
  const p = r.parsed ?? {};
  const currency = CURRENCIES.includes(p.currency as Currency) ? (p.currency as Currency) : "TRY";
  return {
    id: r.id,
    rawText: r.raw_text,
    sourceGroup: r.source_group,
    owner: r.owner_agent_id ? { companyName: r.owner?.company_name ?? "Bilinmeyen emlakçı" } : null,
    score: r.quality_score,
    createdAt: r.created_at,
    parsed: {
      title: str(p.title),
      price: num(p.price),
      currency,
      rooms: str(p.rooms),
      areaM2: num(p.area_m2),
      city: str(p.city),
      district: str(p.district),
      neighborhood: str(p.neighborhood),
      description: str(p.description),
    },
  };
}

// PostgREST or() içinde virgül/parantez sözdizimini bozar; arama terimi sadeleştirilir.
const safeTerm = (q: string) => q.replace(/[,()*%\\]/g, " ").trim().slice(0, 100);

export async function reviewList(q: ReviewQuery): Promise<Awaited<ReturnType<ReviewService["list"]>>> {
  const auth = await requireAdmin();
  if (!auth.ok) return { status: "error" };
  const page = Math.max(1, Math.floor(q.page) || 1);

  let query = auth.supabase
    .from("raw_listings")
    .select(
      "id, raw_text, source_group, quality_score, created_at, owner_agent_id, parsed, owner:agents!raw_listings_owner_agent_id_fkey(company_name)",
      { count: "exact" },
    )
    .eq("status", "pending");

  const term = q.q ? safeTerm(q.q) : "";
  if (term) query = query.or(`raw_text.ilike.*${term}*,parsed->>title.ilike.*${term}*`);
  if (q.city) query = query.eq("parsed->>city", q.city);
  if (q.source === "personal") query = query.not("owner_agent_id", "is", null);
  if (q.source === "group") query = query.is("owner_agent_id", null);
  if (q.score === "low") query = query.lt("quality_score", 0.5);
  if (q.score === "mid") query = query.gte("quality_score", 0.5).lt("quality_score", 0.7);
  if (q.score === "high") query = query.gte("quality_score", 0.7);

  const { data, error, count } = await query
    .order("created_at", { ascending: q.order !== "newest" })
    .range((page - 1) * PAGE, page * PAGE - 1);
  if (error) {
    console.error("review_list_failed", { code: error.code });
    return { status: "error" };
  }
  const items = await Promise.all(((data ?? []) as unknown as Row[]).map(toReviewItem));
  return { status: "ok", items, total: count ?? items.length, page, pageSize: PAGE };
}

export async function reviewCities(): Promise<string[]> {
  const auth = await requireAdmin();
  if (!auth.ok) return [];
  const { data } = await auth.supabase.from("raw_listings").select("city:parsed->>city").eq("status", "pending");
  const cities = ((data ?? []) as { city: string | null }[]).map((r) => r.city).filter((c): c is string => !!c);
  return [...new Set(cities)].sort((a, b) => a.localeCompare(b, "tr"));
}

type ActionResult = Awaited<ReturnType<ReviewService["approve"]>>;

function toResult(data: unknown, error: unknown): ActionResult {
  if (error) {
    console.error("review_action_failed", error);
    return { status: "error" };
  }
  const r = (data ?? {}) as { ok?: boolean; error?: string };
  if (r.ok) return { status: "ok" };
  if (r.error === "gone") return { status: "gone" };
  if (r.error === "invalid") return { status: "error", message: "Düzeltilen alanlar geçersiz." };
  return { status: "error" };
}

export async function reviewApprove(id: string, edits: Partial<ParsedFields>): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return { status: "error" };
  const { data, error } = await auth.supabase.rpc("review_approve", {
    p_raw_listing_id: id,
    p_edits: await toDbEdits(edits),
  });
  const res = toResult(data, error);
  if (res.status === "ok") revalidatePath("/admin/listings");
  return res;
}

export async function reviewReject(id: string, reason: RejectReason, note?: string): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return { status: "error" };
  const { data, error } = await auth.supabase.rpc("review_reject", {
    p_raw_listing_id: id,
    p_reason: reason,
    p_note: note?.trim() || null,
  });
  const res = toResult(data, error);
  if (res.status === "ok") revalidatePath("/admin/listings");
  return res;
}

export async function reviewGetThreshold(): Promise<{ value: number; failed: boolean }> {
  const auth = await requireAdmin();
  if (!auth.ok) return { value: 0.7, failed: true };
  const { data, error } = await auth.supabase.rpc("admin_get_threshold");
  const r = (data ?? null) as { ok?: unknown; value?: unknown } | null;
  if (error || r?.ok !== true || typeof r.value !== "number" || !Number.isFinite(r.value)) {
    return { value: 0.7, failed: true };
  }
  return { value: r.value, failed: false };
}

export async function reviewSaveThreshold(value: number) {
  return setPersonalThreshold(value);
}
