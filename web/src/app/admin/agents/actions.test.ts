import { beforeEach, describe, expect, it, vi } from "vitest";

import { requireAdmin } from "@/lib/auth/requireAdmin";
import { createServiceRoleClient } from "@/lib/supabase/server";

import { adminSetAdmin, adminSetSuspended, adminListAgents } from "./actions";

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
