import type { AgentQuery, AgentRow, AgentSubStatus, WhatsAppState } from "./types";

// Veritabanı satırlarını admin UI modeline çeviren saf fonksiyonlar (I/O yok, test edilebilir).

export type SubRecord = {
  status: string;
  created_at: string;
  current_period_end: string | null;
  plans: { name: string } | null;
};

export type AgentRecord = {
  id: string;
  company_name: string;
  created_at: string;
  is_admin: boolean;
  suspended_at: string | null;
  subscriptions: SubRecord[];
  // PostgREST bire-bir ilişkiyi nesne, bazen dizi döner.
  wa_connections: { status: string } | { status: string }[] | null;
};

const KNOWN: AgentSubStatus[] = ["active", "trialing", "past_due", "pending", "canceled"];

export function latestSub(subs: SubRecord[]): SubRecord | null {
  return [...subs].sort((a, b) => b.created_at.localeCompare(a.created_at))[0] ?? null;
}

export function toSubStatus(subs: SubRecord[]): AgentSubStatus {
  const s = latestSub(subs);
  if (!s) return "none";
  if (s.status === "failed") return "past_due";
  if (s.status === "needs_review") return "pending";
  return KNOWN.includes(s.status as AgentSubStatus) ? (s.status as AgentSubStatus) : "pending";
}

export function toWhatsApp(wa: AgentRecord["wa_connections"]): WhatsAppState {
  const row = Array.isArray(wa) ? wa[0] : wa;
  if (!row) return "never";
  return row.status === "connected" ? "connected" : "disconnected";
}

export function toAgentRow(a: AgentRecord, email: string): AgentRow {
  const sub = latestSub(a.subscriptions);
  return {
    id: a.id,
    companyName: a.company_name,
    email,
    subscription: { status: toSubStatus(a.subscriptions), planName: sub?.plans?.name ?? null },
    whatsapp: toWhatsApp(a.wa_connections),
    createdAt: a.created_at,
    suspended: a.suspended_at !== null,
    isAdmin: a.is_admin,
  };
}

export function filterAgents(rows: AgentRow[], q: AgentQuery): AgentRow[] {
  const needle = q.q?.trim().toLocaleLowerCase("tr-TR");
  return rows.filter(
    (a) =>
      (!needle || `${a.companyName} ${a.email}`.toLocaleLowerCase("tr-TR").includes(needle)) &&
      (!q.sub || (q.sub === "suspended" ? a.suspended : a.subscription.status === q.sub)) &&
      (!q.wa || (q.wa === "connected" ? a.whatsapp === "connected" : a.whatsapp !== "connected")),
  );
}
