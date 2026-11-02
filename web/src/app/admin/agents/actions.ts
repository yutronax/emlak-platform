"use server";

import { filterAgents, latestSub, toAgentRow, type AgentRecord } from "@/lib/admin-ui/mapping";
import type { AdminError, AdminService, AgentDetail, AgentQuery, AgentRow } from "@/lib/admin-ui/types";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { STATUS_LABELS, type OrderStatus } from "@/lib/video-orders/status";

// Admin emlakçı yönetimi. Yetki her çağrıda requireAdmin ile, sorgular servis rolüyle (e-posta auth.users'ta).
// Emlakçı sayısı küçük olduğundan liste bellekte süzülür; büyürse SQL'e taşınmalı.

type Result<T> = Promise<Awaited<T>>;
const PAGE = 20;
const AGENT_SELECT =
  "id, company_name, created_at, is_admin, suspended_at, subscriptions(status, created_at, current_period_end, plans(name)), wa_connections(status)";

async function admin() {
  const auth = await requireAdmin();
  return auth.ok ? { db: createServiceRoleClient(), userId: auth.userId } : null;
}

type Db = ReturnType<typeof createServiceRoleClient>;

async function emails(db: Db): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    data.users.forEach((u) => out.set(u.id, u.email ?? ""));
    if (data.users.length < 1000) break;
  }
  return out;
}

async function allRows(db: Db): Promise<AgentRow[]> {
  const [{ data, error }, mails] = await Promise.all([
    db.from("agents").select(AGENT_SELECT).order("created_at", { ascending: false }),
    emails(db),
  ]);
  if (error) throw error;
  return ((data ?? []) as unknown as AgentRecord[]).map((a) => toAgentRow(a, mails.get(a.id) ?? ""));
}

export async function adminOverview(): Result<ReturnType<AdminService["overview"]>> {
  const ctx = await admin();
  if (!ctx) return { status: "error" };
  try {
    const [rows, listings, videos] = await Promise.all([
      allRows(ctx.db),
      ctx.db.from("raw_listings").select("id", { count: "exact", head: true }).eq("status", "pending"),
      ctx.db.from("video_orders").select("id", { count: "exact", head: true }).eq("status", "quote_pending"),
    ]);
    return {
      status: "ok",
      counts: {
        pendingListings: listings.count ?? 0,
        pendingVideoOrders: videos.count ?? 0,
        activeSubscribers: rows.filter((r) => r.subscription.status === "active").length,
        pastDue: rows.filter((r) => r.subscription.status === "past_due").length,
      },
      recentAgents: rows.slice(0, 4),
    };
  } catch (e) {
    console.error("admin_overview_failed", e);
    return { status: "error" };
  }
}

export async function adminListAgents(q: AgentQuery): Result<ReturnType<AdminService["listAgents"]>> {
  const ctx = await admin();
  if (!ctx) return { status: "error" };
  try {
    const out = filterAgents(await allRows(ctx.db), q);
    const page = Math.max(1, Math.floor(q.page) || 1);
    return { status: "ok", items: out.slice((page - 1) * PAGE, page * PAGE), total: out.length, page, pageSize: PAGE };
  } catch (e) {
    console.error("admin_list_agents_failed", e);
    return { status: "error" };
  }
}

async function loadDetail(db: Db, id: string): Promise<AgentDetail | null> {
  const { data, error } = await db
    .from("agents")
    .select(`${AGENT_SELECT}, contact_name, phone`)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const a = data as unknown as AgentRecord & { contact_name: string | null; phone: string | null };

  const [user, selection, listings, raws, videos] = await Promise.all([
    db.auth.admin.getUserById(id),
    db.from("wa_group_selection").select("group_jid").eq("agent_id", id),
    db.from("listings").select("source_group_name").eq("owner_agent_id", id),
    db
      .from("raw_listings")
      .select("id, status, created_at, parsed, raw_text")
      .eq("owner_agent_id", id)
      .order("created_at", { ascending: false })
      .limit(5),
    db
      .from("video_orders")
      .select("id, service_code, status, created_at")
      .eq("agent_id", id)
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  const jids = (selection.data ?? []).map((s) => s.group_jid as string);
  const names = jids.length
    ? ((await db.from("wa_groups").select("name").eq("agent_id", id).in("group_jid", jids)).data ?? []).map(
        (g) => g.name as string,
      )
    : [];
  const counts = new Map<string, number>();
  (listings.data ?? []).forEach((l) => {
    const n = l.source_group_name as string | null;
    if (n) counts.set(n, (counts.get(n) ?? 0) + 1);
  });

  return {
    ...toAgentRow(a, user.data.user?.email ?? ""),
    contactName: a.contact_name,
    phone: a.phone ? `+90${a.phone}` : null,
    currentPeriodEnd: latestSub(a.subscriptions)?.current_period_end ?? null,
    // Ödeme kayıtları henüz tutarı taşımıyor (payment_events ham olay); iyzico entegrasyonunda doldurulacak.
    payments: [],
    groups: names.map((name) => ({ name, listingCount: counts.get(name) ?? 0 })),
    recentListings: (raws.data ?? []).map((r) => {
      const parsed = r.parsed as { title?: string } | null;
      const status = r.status as string;
      return {
        id: r.id as string,
        title: parsed?.title || String(r.raw_text ?? "").slice(0, 60),
        status: status === "approved" || status === "rejected" ? status : "pending",
        createdAt: r.created_at as string,
      };
    }),
    videoOrders: (videos.data ?? []).map((v) => ({
      id: v.id as string,
      title: `Video siparişi · ${v.service_code}`,
      status: STATUS_LABELS[v.status as OrderStatus] ?? String(v.status),
      createdAt: v.created_at as string,
    })),
  };
}

export async function adminGetAgent(id: string): Result<ReturnType<AdminService["getAgent"]>> {
  const ctx = await admin();
  if (!ctx) return { status: "error" };
  try {
    const agent = await loadDetail(ctx.db, id);
    return agent ? { status: "ok", agent, isSelf: id === ctx.userId } : { status: "not_found" };
  } catch (e) {
    console.error("admin_get_agent_failed", e);
    return { status: "error" };
  }
}

async function mutate(
  id: string,
  apply: (db: Db) => Promise<{ error: unknown }[]>,
): Promise<{ status: "ok"; agent: AgentDetail } | AdminError> {
  const ctx = await admin();
  if (!ctx) return { status: "error" };
  try {
    const results = await apply(ctx.db);
    const failed = results.find((r) => r.error);
    if (failed) throw failed.error;
    const agent = await loadDetail(ctx.db, id);
    return agent ? { status: "ok", agent } : { status: "error" };
  } catch (e) {
    console.error("admin_agent_update_failed", e);
    return { status: "error" };
  }
}

export async function adminSetSuspended(id: string, suspended: boolean) {
  const auth = await requireAdmin();
  if (!auth.ok) return { status: "error" } as AdminError;
  if (auth.userId === id) return { status: "error", code: "self" } as AdminError;
  return mutate(id, async (db) => {
    const now = new Date().toISOString();
    const res = [await db.from("agents").update({ suspended_at: suspended ? now : null }).eq("id", id)];
    // Panel kapanır; ilan toplama da durur (sidecar bağlantıyı keser).
    if (suspended) {
      res.push(
        await db
          .from("wa_connections")
          .update({ requested_action: "disconnect", requested_at: now, updated_at: now })
          .eq("agent_id", id),
      );
    }
    return res;
  });
}

const PERIOD_MS = 30 * 24 * 60 * 60 * 1000;

// Elle tahsilat sonrası: en yeni abonelik aktif yapılır ve dönem sonu max(şimdi, mevcut son) + 30 gün olur;
// abonelik yoksa en ucuz planla açılır.
export async function adminExtendSubscription(id: string) {
  return mutate(id, async (db) => {
    const { data: subs, error } = await db
      .from("subscriptions")
      .select("id, current_period_end")
      .eq("agent_id", id)
      .order("created_at", { ascending: false })
      .limit(1);
    if (error) return [{ error }];
    const latest = subs?.[0] as { id: string; current_period_end: string | null } | undefined;
    const base = Math.max(Date.now(), latest?.current_period_end ? Date.parse(latest.current_period_end) : 0);
    const current_period_end = new Date(base + PERIOD_MS).toISOString();
    if (latest) {
      return [await db.from("subscriptions").update({ status: "active", current_period_end }).eq("id", latest.id)];
    }
    const { data: plan, error: planError } = await db
      .from("plans")
      .select("id")
      .order("price_minor_unit", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (planError || !plan) return [{ error: planError ?? new Error("plan yok") }];
    return [await db.from("subscriptions").insert({ agent_id: id, plan_id: plan.id, status: "active", current_period_end })];
  });
}

export async function adminSetAdmin(id: string, isAdmin: boolean) {
  const auth = await requireAdmin();
  if (!auth.ok) return { status: "error" } as AdminError;
  // Son yöneticinin kendini düşürüp paneli kilitlemesine karşı.
  if (auth.userId === id && !isAdmin) return { status: "error", code: "self" } as AdminError;
  return mutate(id, async (db) => [await db.from("agents").update({ is_admin: isAdmin }).eq("id", id)]);
}
