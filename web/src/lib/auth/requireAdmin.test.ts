import { beforeEach, describe, expect, it, vi } from "vitest";

import { createClient } from "@/lib/supabase/server";

import { requireAdmin } from "./requireAdmin";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

type AgentResult = {
  data: { is_admin: boolean } | null;
  error: { message: string } | null;
};

// agents tablosu zinciri: .select("is_admin").eq("id", userId).maybeSingle()
function setupSupabase(options: {
  user: { id: string } | null;
  agent?: AgentResult;
}) {
  const maybeSingle = vi
    .fn()
    .mockResolvedValue(options.agent ?? { data: null, error: null });
  const chain: Record<string, unknown> = {};
  chain.select = vi.fn(() => chain);
  chain.eq = vi.fn(() => chain);
  chain.maybeSingle = maybeSingle;

  const from = vi.fn((table: string) => {
    if (table === "agents") return chain;
    throw new Error(`Beklenmeyen tablo: ${table}`);
  });

  const supabase = {
    from,
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: options.user },
        error: null,
      }),
    },
  };
  vi.mocked(createClient).mockResolvedValue(supabase as never);
  return { supabase, from, chain };
}

describe("requireAdmin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("oturum yoksa { ok: false, reason: 'no-session' } döner ve agents tablosunu sorgulamaz", async () => {
    const { from } = setupSupabase({ user: null });

    const result = await requireAdmin();

    expect(result).toEqual({ ok: false, reason: "no-session" });
    expect(from).not.toHaveBeenCalled();
  });

  it("oturum var ama agents.is_admin = false ise { ok: false, reason: 'not-admin' } döner", async () => {
    const { from, chain } = setupSupabase({
      user: { id: "user-1" },
      agent: { data: { is_admin: false }, error: null },
    });

    const result = await requireAdmin();

    expect(from).toHaveBeenCalledWith("agents");
    expect(chain.eq).toHaveBeenCalledWith("id", "user-1");
    expect(result).toEqual({ ok: false, reason: "not-admin" });
  });

  it("agents satırı yoksa (maybeSingle null) yetkisiz sayılır: { ok: false, reason: 'not-admin' }", async () => {
    setupSupabase({
      user: { id: "user-1" },
      agent: { data: null, error: null },
    });

    const result = await requireAdmin();

    expect(result).toEqual({ ok: false, reason: "not-admin" });
  });

  it("oturum var ve agents.is_admin = true ise { ok: true, userId, supabase } döner", async () => {
    const { supabase } = setupSupabase({
      user: { id: "user-1" },
      agent: { data: { is_admin: true }, error: null },
    });

    const result = await requireAdmin();

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.userId).toBe("user-1");
    expect(result.supabase).toBe(supabase);
  });
});
