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

function setupSupabase(signInResult: SignInResult, userResult: UserResult) {
  const signInWithPassword = vi.fn().mockResolvedValue(signInResult);
  const getUser = vi.fn().mockResolvedValue(userResult);
  const supabase = { auth: { signInWithPassword, getUser } };
  vi.mocked(createClient).mockResolvedValue(supabase as never);
  return { supabase, signInWithPassword, getUser };
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
  it("AC-4: giriş başarılı ve company_name doluysa ensureAgentRow çağrılır ve /admin/listings'e yönlendirilir", async () => {
    const { supabase } = setupSupabase(
      { error: null },
      { data: { user: { id: "user-1", user_metadata: { company_name: "Acme Emlak" } } } },
    );

    await expect(
      login(makeFormData({ email: "test@example.com", password: "sifre123" })),
    ).rejects.toThrow("NEXT_REDIRECT");

    expect(ensureAgentRow).toHaveBeenCalledWith(supabase, "user-1", "Acme Emlak");
    expect(redirect).toHaveBeenCalledWith("/admin/listings");
  });

  // AC-4 negatif: company_name yok/boş -> ensureAgentRow ÇAĞRILMAZ, redirect YİNE çağrılır.
  it.each([
    { label: "user_metadata boş obje", metadata: {} },
    { label: "company_name boş string", metadata: { company_name: "" } },
    { label: "user_metadata yok", metadata: undefined },
  ])(
    "company_name $label ise ensureAgentRow ÇAĞRILMAZ, redirect yine çağrılır",
    async ({ metadata }) => {
      setupSupabase(
        { error: null },
        { data: { user: { id: "user-1", user_metadata: metadata } } },
      );

      await expect(
        login(makeFormData({ email: "test@example.com", password: "sifre123" })),
      ).rejects.toThrow("NEXT_REDIRECT");

      expect(ensureAgentRow).not.toHaveBeenCalled();
      expect(redirect).toHaveBeenCalledWith("/admin/listings");
    },
  );

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
