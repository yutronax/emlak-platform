import { beforeEach, describe, expect, it, vi } from "vitest";

import { requireAdmin } from "@/lib/auth/requireAdmin";
import { createServiceRoleClient } from "@/lib/supabase/server";

import { adminExtendSubscription, adminSetAdmin, adminSetSuspended, adminListAgents } from "./actions";

vi.mock("@/lib/auth/requireAdmin", () => ({ requireAdmin: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createServiceRoleClient: vi.fn() }));

const SELF = "11111111-1111-1111-1111-111111111111";
const OTHER = "22222222-2222-2222-2222-222222222222";

function db() {
  const updates: { table: string; values: unknown }[] = [];
  const from = vi.fn((table: string) => ({
    update: vi.fn((values: unknown) => {
      updates.push({ table, values });
      return { eq: vi.fn(async () => ({ error: null })) };
    }),
    // detay yeniden yüklenirken: bulunamadı → işlem yine ok sayılmaz, burada yalnız güncelleme doğrulanır
    select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: vi.fn(async () => ({ data: null, error: null })) })) })),
  }));
  vi.mocked(createServiceRoleClient).mockReturnValue({ from } as never);
  return { updates, from };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.mocked(requireAdmin).mockResolvedValue({ ok: true, userId: SELF, supabase: {} } as never);
});

describe("yetki", () => {
  it("admin değilse hiçbir sorgu çalışmaz", async () => {
    vi.mocked(requireAdmin).mockResolvedValue({ ok: false, reason: "not-admin" });
    const { from } = db();

    expect(await adminListAgents({ page: 1 })).toEqual({ status: "error" });
    expect(await adminSetSuspended(OTHER, true)).toMatchObject({ status: "error" });
    expect(from).not.toHaveBeenCalled();
  });
});

describe("adminSetSuspended", () => {
  it("kendini askıya alamaz", async () => {
    const { updates } = db();
    expect(await adminSetSuspended(SELF, true)).toEqual({ status: "error", code: "self" });
    expect(updates).toEqual([]);
  });

  it("askı zaman damgası yazar ve WhatsApp bağlantısının kesilmesini ister", async () => {
    const { updates } = db();
    await adminSetSuspended(OTHER, true);

    expect(updates[0].table).toBe("agents");
    expect(updates[0].values).toEqual({ suspended_at: expect.any(String) });
    expect(updates[1]).toEqual({
      table: "wa_connections",
      values: { requested_action: "disconnect", requested_at: expect.any(String), updated_at: expect.any(String) },
    });
  });

  it("askı kaldırılınca yalnız damga temizlenir", async () => {
    const { updates } = db();
    await adminSetSuspended(OTHER, false);
    expect(updates).toEqual([{ table: "agents", values: { suspended_at: null } }]);
  });
});

describe("adminExtendSubscription", () => {
  function subsDb(latest: { id: string; current_period_end: string | null } | null) {
    const writes: { op: string; values: unknown }[] = [];
    const chain = (data: unknown) => {
      const q: Record<string, unknown> = {};
      for (const m of ["select", "eq", "order", "limit"]) q[m] = vi.fn(() => q);
      q.maybeSingle = vi.fn(async () => ({ data, error: null }));
      q.then = (r: (v: unknown) => unknown) => Promise.resolve({ data: Array.isArray(data) ? data : [data], error: null }).then(r);
      return q;
    };
    const from = vi.fn((table: string) => {
      if (table === "subscriptions") {
        const q = chain(latest ? [latest] : []);
        return {
          ...q,
          update: vi.fn((values: unknown) => {
            writes.push({ op: "update", values });
            return { eq: vi.fn(async () => ({ error: null })) };
          }),
          insert: vi.fn(async (values: unknown) => {
            writes.push({ op: "insert", values });
            return { error: null };
          }),
        };
      }
      if (table === "plans") return chain({ id: "plan-cheap" });
      // detay yeniden yükleme
      return chain(null);
    });
    vi.mocked(createServiceRoleClient).mockReturnValue({ from } as never);
    return writes;
  }

  it("süresi geçmişse bugünden, sürüyorsa mevcut sondan 30 gün ileri alır", async () => {
    vi.useFakeTimers({ now: new Date("2026-11-02T00:00:00Z") });
    let writes = subsDb({ id: "s1", current_period_end: "2026-10-01T00:00:00Z" });
    await adminExtendSubscription(OTHER);
    expect(writes).toEqual([{ op: "update", values: { status: "active", current_period_end: "2026-12-02T00:00:00.000Z" } }]);

    writes = subsDb({ id: "s1", current_period_end: "2026-11-10T00:00:00Z" });
    await adminExtendSubscription(OTHER);
    expect(writes[0].values).toMatchObject({ current_period_end: "2026-12-10T00:00:00.000Z" });
    vi.useRealTimers();
  });

  it("abonelik yoksa en ucuz planla aktif abonelik açar", async () => {
    const writes = subsDb(null);
    await adminExtendSubscription(OTHER);
    expect(writes).toEqual([
      { op: "insert", values: expect.objectContaining({ agent_id: OTHER, plan_id: "plan-cheap", status: "active" }) },
    ]);
  });
});

describe("adminSetAdmin", () => {
  it("kendi yöneticiliğini kaldıramaz", async () => {
    const { updates } = db();
    expect(await adminSetAdmin(SELF, false)).toEqual({ status: "error", code: "self" });
    expect(updates).toEqual([]);
  });

  it("başkasını yönetici yapar", async () => {
    const { updates } = db();
    await adminSetAdmin(OTHER, true);
    expect(updates).toEqual([{ table: "agents", values: { is_admin: true } }]);
  });
});
