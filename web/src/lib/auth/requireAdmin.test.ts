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

type AalResult = {
  data: { currentLevel: string | null; nextLevel: string | null } | null;
  error: { message: string } | null;
};

const AAL2: AalResult = { data: { currentLevel: "aal2", nextLevel: "aal2" }, error: null };
const AAL1: AalResult = { data: { currentLevel: "aal1", nextLevel: "aal2" }, error: null };

// agents tablosu zinciri: .select("is_admin").eq("id", userId).maybeSingle()
// MFA: supabase.auth.mfa.getAuthenticatorAssuranceLevel()
function setupSupabase(options: {
  user: { id: string } | null;
  agent?: AgentResult;
  aal?: AalResult;
  aalThrows?: boolean;
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

  const getAuthenticatorAssuranceLevel = options.aalThrows
    ? vi.fn().mockRejectedValue(new Error("network error"))
    : vi.fn().mockResolvedValue(options.aal ?? AAL2);

  const supabase = {
    from,
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: options.user },
        error: null,
      }),
      mfa: { getAuthenticatorAssuranceLevel },
    },
  };
  vi.mocked(createClient).mockResolvedValue(supabase as never);
  return { supabase, from, chain, getAuthenticatorAssuranceLevel };
}

describe("requireAdmin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("oturum yoksa { ok: false, reason: 'no-session' } döner, agents tablosunu ve MFA seviyesini sorgulamaz", async () => {
    const { from, getAuthenticatorAssuranceLevel } = setupSupabase({ user: null });

    const result = await requireAdmin();

    expect(result).toEqual({ ok: false, reason: "no-session" });
    expect(from).not.toHaveBeenCalled();
    expect(getAuthenticatorAssuranceLevel).not.toHaveBeenCalled();
  });

  it("oturum var ama agents.is_admin = false ise { ok: false, reason: 'not-admin' } döner ve MFA seviyesini sorgulamaz", async () => {
    const { from, chain, getAuthenticatorAssuranceLevel } = setupSupabase({
      user: { id: "user-1" },
      agent: { data: { is_admin: false }, error: null },
      aal: AAL1,
    });

    const result = await requireAdmin();

    expect(from).toHaveBeenCalledWith("agents");
    expect(chain.eq).toHaveBeenCalledWith("id", "user-1");
    expect(result).toEqual({ ok: false, reason: "not-admin" });
    expect(getAuthenticatorAssuranceLevel).not.toHaveBeenCalled();
  });

  it("agents satırı yoksa (maybeSingle null) yetkisiz sayılır: { ok: false, reason: 'not-admin' }", async () => {
    const { getAuthenticatorAssuranceLevel } = setupSupabase({
      user: { id: "user-1" },
      agent: { data: null, error: null },
    });

    const result = await requireAdmin();

    expect(result).toEqual({ ok: false, reason: "not-admin" });
    expect(getAuthenticatorAssuranceLevel).not.toHaveBeenCalled();
  });

  // AC-1: admin ama aal1 (parola ile girildi, MFA doğrulanmadı) -> mfa-required.
  it("admin ama currentLevel 'aal1' ise { ok: false, reason: 'mfa-required' } döner", async () => {
    const { getAuthenticatorAssuranceLevel } = setupSupabase({
      user: { id: "user-1" },
      agent: { data: { is_admin: true }, error: null },
      aal: AAL1,
    });

    const result = await requireAdmin();

    expect(getAuthenticatorAssuranceLevel).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ ok: false, reason: "mfa-required" });
  });

  // AC-1: admin + aal2 -> yetkili; mevcut ok:true sözleşmesi korunur.
  it("oturum var ve agents.is_admin = true, currentLevel 'aal2' ise { ok: true, userId, supabase } döner", async () => {
    const { supabase, getAuthenticatorAssuranceLevel } = setupSupabase({
      user: { id: "user-1" },
      agent: { data: { is_admin: true }, error: null },
      aal: AAL2,
    });

    const result = await requireAdmin();

    expect(getAuthenticatorAssuranceLevel).toHaveBeenCalledTimes(1);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.userId).toBe("user-1");
    expect(result.supabase).toBe(supabase);
  });

  // Kapalı-varsayılan: MFA seviyesi okunamazsa admin reddedilir.
  it("admin ama getAuthenticatorAssuranceLevel hata dönerse { ok: false, reason: 'mfa-required' } döner", async () => {
    setupSupabase({
      user: { id: "user-1" },
      agent: { data: { is_admin: true }, error: null },
      aal: { data: null, error: { message: "mfa service unavailable" } },
    });

    const result = await requireAdmin();

    expect(result).toEqual({ ok: false, reason: "mfa-required" });
  });

  it("admin ama getAuthenticatorAssuranceLevel exception fırlatırsa { ok: false, reason: 'mfa-required' } döner", async () => {
    setupSupabase({
      user: { id: "user-1" },
      agent: { data: { is_admin: true }, error: null },
      aalThrows: true,
    });

    const result = await requireAdmin();

    expect(result).toEqual({ ok: false, reason: "mfa-required" });
  });

  it("admin ama currentLevel null ise { ok: false, reason: 'mfa-required' } döner (kapalı-varsayılan)", async () => {
    setupSupabase({
      user: { id: "user-1" },
      agent: { data: { is_admin: true }, error: null },
      aal: { data: { currentLevel: null, nextLevel: null }, error: null },
    });

    const result = await requireAdmin();

    expect(result).toEqual({ ok: false, reason: "mfa-required" });
  });
});
