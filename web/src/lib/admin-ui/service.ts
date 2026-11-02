import {
  adminExtendSubscription,
  adminGetAgent,
  adminListAgents,
  adminOverview,
  adminSetAdmin,
  adminSetSuspended,
} from "@/app/admin/agents/actions";

import type { AdminService, AgentDetail, AgentQuery, AgentRow } from "./types";

// Yalnız dev: NEXT_PUBLIC_ADMIN_MOCK=1 (admin oturumu yine gerekir). 24 emlakçı → 2 sayfa.
// "a1" oturumdaki admin (isSelf). "a7" için işlemler hata döner.
const NAMES = [
  "Karşıyaka Sahil Gayrimenkul",
  "Bodrum Mavi Emlak",
  "Çankaya Konut Danışmanlık",
  "Bornova Yıldız Emlak",
  "Ege Kıyı Gayrimenkul Yatırım ve Danışmanlık Hizmetleri",
  "Buca Aile Emlak",
];
const STATUSES: AgentRow["subscription"]["status"][] = ["active", "active", "trialing", "past_due", "none", "canceled", "pending"];

function rows(): AgentDetail[] {
  return Array.from({ length: 24 }, (_, i): AgentDetail => {
    const status = STATUSES[i % STATUSES.length];
    const company = `${NAMES[i % NAMES.length]}${i >= NAMES.length ? ` ${Math.floor(i / NAMES.length) + 1}` : ""}`;
    return {
      id: `a${i + 1}`,
      companyName: company,
      email: `iletisim${i + 1}@${["ornekemlak", "gayrimenkul", "konut"][i % 3]}.com`,
      subscription: { status, planName: status === "none" ? null : ["Temel", "Pro", "Kurumsal"][i % 3] },
      whatsapp: (["connected", "disconnected", "never"] as const)[i % 3],
      createdAt: new Date(Date.UTC(2026, 10, 2, 9) - i * 2.3 * 86_400_000).toISOString(),
      suspended: i === 9,
      isAdmin: i === 0 || i === 4,
      contactName: i % 4 === 3 ? null : ["Ayşe Yılmaz", "Mehmet Kaya", "Zeynep Demir"][i % 3],
      phone: i % 5 === 4 ? null : `+90532${String(1_000_000 + i * 7_919).slice(0, 7)}`,
      currentPeriodEnd: status === "none" ? null : "2026-12-01T09:00:00Z",
      payments:
        status === "none"
          ? []
          : [
              { id: `${i}-p2`, date: "2026-11-01T09:00:00Z", amountMinor: 29_900, status: status === "past_due" ? "failed" : "paid", description: "Aylık abonelik · Kasım" },
              { id: `${i}-p1`, date: "2026-10-01T09:00:00Z", amountMinor: 29_900, status: "paid", description: "Aylık abonelik · Ekim" },
            ],
      groups: i % 3 === 2 ? [] : [{ name: "İzmir Emlakçılar", listingCount: 42 + i }, { name: "Karşıyaka Satılık Kiralık", listingCount: 7 }],
      recentListings: [
        { id: `${i}-l1`, title: "Bornova 3+1 site içinde", status: "approved", createdAt: "2026-11-01T12:00:00Z" },
        { id: `${i}-l2`, title: "Buca 2+1 öğrenciye uygun", status: "pending", createdAt: "2026-11-01T08:00:00Z" },
      ],
      videoOrders: i % 2 ? [] : [{ id: `${i}-v1`, title: "Karşıyaka 3+1 tanıtım videosu", status: "Hazırlanıyor", createdAt: "2026-10-30T10:00:00Z" }],
    };
  });
}

function matches(a: AgentRow, q: AgentQuery) {
  const needle = q.q?.toLocaleLowerCase("tr-TR");
  return (
    (!needle || `${a.companyName} ${a.email}`.toLocaleLowerCase("tr-TR").includes(needle)) &&
    (!q.sub || (q.sub === "suspended" ? a.suspended : a.subscription.status === q.sub)) &&
    (!q.wa || (q.wa === "connected" ? a.whatsapp === "connected" : a.whatsapp !== "connected"))
  );
}

const toRow = ({ id, companyName, email, subscription, whatsapp, createdAt, suspended, isAdmin }: AgentDetail): AgentRow => ({
  id,
  companyName,
  email,
  subscription,
  whatsapp,
  createdAt,
  suspended,
  isAdmin,
});

export function createMockAdminService(delayMs = 500): AdminService {
  let agents = rows();
  const wait = () => new Promise((r) => setTimeout(r, delayMs));
  const PAGE = 20;

  function update(id: string, patch: Partial<AgentDetail>) {
    agents = agents.map((a) => (a.id === id ? { ...a, ...patch } : a));
    return agents.find((a) => a.id === id)!;
  }

  return {
    kind: "mock",
    async overview() {
      await wait();
      return {
        status: "ok",
        counts: {
          pendingListings: 26,
          pendingVideoOrders: 3,
          activeSubscribers: agents.filter((a) => a.subscription.status === "active").length,
          pastDue: agents.filter((a) => a.subscription.status === "past_due").length,
        },
        recentAgents: agents.slice(0, 4).map(toRow),
      };
    },
    async listAgents(q) {
      await wait();
      const out = agents.filter((a) => matches(a, q));
      const start = (q.page - 1) * PAGE;
      return { status: "ok", items: out.slice(start, start + PAGE).map(toRow), total: out.length, page: q.page, pageSize: PAGE };
    },
    async getAgent(id) {
      await wait();
      const agent = agents.find((a) => a.id === id);
      return agent ? { status: "ok", agent, isSelf: id === "a1" } : { status: "not_found" };
    },
    async setSuspended(id, suspended) {
      await wait();
      if (id === "a7") return { status: "error" };
      return { status: "ok", agent: update(id, { suspended }) };
    },
    async setAdmin(id, isAdmin) {
      await wait();
      if (id === "a1" && !isAdmin) return { status: "error", code: "self" };
      if (id === "a7") return { status: "error" };
      return { status: "ok", agent: update(id, { isAdmin }) };
    },
    async extendSubscription(id) {
      await wait();
      if (id === "a7") return { status: "error" };
      const a = agents.find((x) => x.id === id)!;
      const base = Math.max(Date.now(), a.currentPeriodEnd ? Date.parse(a.currentPeriodEnd) : 0);
      return {
        status: "ok",
        agent: update(id, {
          subscription: { status: "active", planName: a.subscription.planName ?? "Temel" },
          currentPeriodEnd: new Date(base + 30 * 86_400_000).toISOString(),
        }),
      };
    },
  };
}

// Sunucu aksiyonlarının istemci sarmalayıcısı; yetki her aksiyonda sunucuda.
export const realAdminService: AdminService = {
  kind: "real",
  overview: () => adminOverview(),
  listAgents: (q) => adminListAgents(q),
  getAgent: (id) => adminGetAgent(id),
  setSuspended: (id, suspended) => adminSetSuspended(id, suspended),
  setAdmin: (id, isAdmin) => adminSetAdmin(id, isAdmin),
  extendSubscription: (id) => adminExtendSubscription(id),
};

// Varsayılan gerçek servis; mock yalnız dev'de bayrakla.
export function selectAdminService(env: { nodeEnv: string | undefined; mockFlag: string | undefined; delayMs?: number }) {
  if (env.mockFlag === "1") {
    if (env.nodeEnv === "production") throw new Error("Admin mock servisi production'da kullanılamaz.");
    return createMockAdminService(env.delayMs);
  }
  return realAdminService;
}

export function getAdminService(opts: { delayMs?: number } = {}): AdminService {
  return selectAdminService({ nodeEnv: process.env.NODE_ENV, mockFlag: process.env.NEXT_PUBLIC_ADMIN_MOCK, delayMs: opts.delayMs });
}
