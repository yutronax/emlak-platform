import { beforeEach, describe, expect, it, vi } from "vitest";

import { ensureAgentRow } from "@/lib/auth/ensureAgentRow";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

import { login } from "./actions";

vi.mock("@/lib/auth/ensureAgentRow", () => ({
  ensureAgentRow: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn(() => {
    throw new Error("NEXT_REDIRECT");
  }),
}));

type SignInResult = { error: { message: string } | null };
type UserResult = { data: { user: { id: string; user_metadata?: Record<string, unknown> } | null } };
type AgentResult = { data: { is_admin: boolean } | null; error: { message: string } | null };

// agents tablosu zinciri: .select("is_admin").eq("id", userId).maybeSingle()
function setupSupabase(signInResult: SignInResult, userResult: UserResult, agentResult?: AgentResult) {
  const signInWithPassword = vi.fn().mockResolvedValue(signInResult);
  const getUser = vi.fn().mockResolvedValue(userResult);

  const supabase: Record<string, unknown> = { auth: { signInWithPassword, getUser } };

  let maybeSingle: ReturnType<typeof vi.fn> | undefined;
  let agentsChain: Record<string, unknown> | undefined;
  let from: ReturnType<typeof vi.fn> | undefined;

  if (agentResult) {
    maybeSingle = vi.fn().mockResolvedValue(agentResult);
    agentsChain = {};
    agentsChain.select = vi.fn(() => agentsChain);
    agentsChain.eq = vi.fn(() => agentsChain);
    agentsChain.maybeSingle = maybeSingle;
    from = vi.fn((table: string) => {
      if (table === "agents") return agentsChain;
      throw new Error(`Beklenmeyen tablo: ${table}`);
    });
    supabase.from = from;
  }

  vi.mocked(createClient).mockResolvedValue(supabase as never);
  return { supabase, signInWithPassword, getUser, from, agentsChain, maybeSingle };
}

function makeFormData(fields: Record<string, string>) {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    fd.set(key, value);
  }
  return fd;
}

describe("login", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // AC-4: giriş başarılı, user_metadata.company_name dolu -> ensureAgentRow çağrılır + redirect.
  // agents mock'u KURULMADI -> supabase.from çağrısı hata verir -> AC-3 pessimist fallback: /agent/dashboard.
  it("AC-4: giriş başarılı ve company_name doluysa ensureAgentRow çağrılır ve (agents sorgusu yapılamadığı için pessimist) /agent/dashboard'a yönlendirilir", async () => {
    const { supabase } = setupSupabase(
      { error: null },
      { data: { user: { id: "user-1", user_metadata: { company_name: "Acme Emlak" } } } },
    );

    await expect(
      login(makeFormData({ email: "test@example.com", password: "sifre123" })),
    ).rejects.toThrow("NEXT_REDIRECT");

    expect(ensureAgentRow).toHaveBeenCalledWith(supabase, "user-1", "Acme Emlak");
    expect(redirect).toHaveBeenCalledWith("/agent/dashboard");
  });

  // AC-4 negatif: company_name yok/boş -> ensureAgentRow ÇAĞRILMAZ, redirect YİNE çağrılır.
  // agents mock'u KURULMADI -> pessimist fallback: /agent/dashboard.
  it.each([
    { label: "user_metadata boş obje", metadata: {} },
    { label: "company_name boş string", metadata: { company_name: "" } },
    { label: "user_metadata yok", metadata: undefined },
  ])(
    "company_name $label ise ensureAgentRow ÇAĞRILMAZ, redirect yine (pessimist) /agent/dashboard'a çağrılır",
    async ({ metadata }) => {
      setupSupabase(
        { error: null },
        { data: { user: { id: "user-1", user_metadata: metadata } } },
      );

      await expect(
        login(makeFormData({ email: "test@example.com", password: "sifre123" })),
      ).rejects.toThrow("NEXT_REDIRECT");

      expect(ensureAgentRow).not.toHaveBeenCalled();
      expect(redirect).toHaveBeenCalledWith("/agent/dashboard");
    },
  );

  // AC-1: agents.is_admin = true -> doğrudan /admin/listings.
  it("AC-1: agents.is_admin=true ise /admin/listings'e yönlendirilir", async () => {
    setupSupabase(
      { error: null },
      { data: { user: { id: "user-1", user_metadata: {} } } },
      { data: { is_admin: true }, error: null },
    );

    await expect(
      login(makeFormData({ email: "test@example.com", password: "sifre123" })),
    ).rejects.toThrow("NEXT_REDIRECT");

    expect(redirect).toHaveBeenCalledWith("/admin/listings");
  });

  // AC-2a: agents.is_admin = false -> /agent/dashboard.
  it("AC-2a: agents.is_admin=false ise /agent/dashboard'a yönlendirilir", async () => {
    setupSupabase(
      { error: null },
      { data: { user: { id: "user-1", user_metadata: {} } } },
      { data: { is_admin: false }, error: null },
    );

    await expect(
      login(makeFormData({ email: "test@example.com", password: "sifre123" })),
    ).rejects.toThrow("NEXT_REDIRECT");

    expect(redirect).toHaveBeenCalledWith("/agent/dashboard");
  });

  // AC-2b: agents satırı yok (data:null, error:null) -> /agent/dashboard.
  it("AC-2b: agents satırı yoksa (data:null) /agent/dashboard'a yönlendirilir", async () => {
    setupSupabase(
      { error: null },
      { data: { user: { id: "user-1", user_metadata: {} } } },
      { data: null, error: null },
    );

    await expect(
      login(makeFormData({ email: "test@example.com", password: "sifre123" })),
    ).rejects.toThrow("NEXT_REDIRECT");

    expect(redirect).toHaveBeenCalledWith("/agent/dashboard");
  });

  // AC-3: agents sorgusu gerçek bir hata döner -> pessimist, /agent/dashboard, console.error.
  it("AC-3: agents sorgusu hata dönerse pessimist /agent/dashboard'a yönlendirilir ve console.error çağrılır", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    setupSupabase(
      { error: null },
      { data: { user: { id: "user-1", user_metadata: {} } } },
      { data: null, error: { message: "network error" } },
    );

    await expect(
      login(makeFormData({ email: "test@example.com", password: "sifre123" })),
    ).rejects.toThrow("NEXT_REDIRECT");

    expect(redirect).toHaveBeenCalledWith("/agent/dashboard");
    expect(consoleErrorSpy).toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
  });

  // Regresyon: giriş başarısız -> ensureAgentRow çağrılmaz, mevcut hata mesajı döner.
  it("giriş başarısız olursa ensureAgentRow ÇAĞRILMAZ ve mevcut hata mesajı döner", async () => {
    const { getUser } = setupSupabase(
      { error: { message: "Invalid login credentials" } },
      { data: { user: null } },
    );

    const result = await login(makeFormData({ email: "test@example.com", password: "wrong" }));

    expect(result).toEqual({ error: "Giriş başarısız: e-posta veya şifre hatalı." });
    expect(ensureAgentRow).not.toHaveBeenCalled();
    expect(getUser).not.toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalled();
  });
});
