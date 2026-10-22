import { beforeEach, describe, expect, it, vi } from "vitest";

import { ensureAgentRow } from "@/lib/auth/ensureAgentRow";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

import { signup } from "./actions";

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

const GENERIC_MESSAGE = "Kayıt alındı; hesabınız varsa e-postanızı kontrol edin veya giriş yapın.";

type SignUpResult = {
  data: { user: { id: string } | null; session: unknown };
  error: { message: string } | null;
};

function setupSupabase(signUpResult: SignUpResult) {
  const signUp = vi.fn().mockResolvedValue(signUpResult);
  const supabase = { auth: { signUp } };
  vi.mocked(createClient).mockResolvedValue(supabase as never);
  return { supabase, signUp };
}

function makeFormData(fields: Record<string, string>) {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    fd.set(key, value);
  }
  return fd;
}

describe("signup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // AC-6: company_name boş/sadece boşluk -> signUp() hiç çağrılmaz.
  it.each([
    { label: "boş", value: "" },
    { label: "sadece boşluk", value: "   " },
  ])("AC-6: company_name $label ise signUp() ÇAĞRILMAZ ve alan hatası döner", async ({ value }) => {
    const { signUp } = setupSupabase({ data: { user: null, session: null }, error: null });

    const result = await signup(
      makeFormData({ email: "test@example.com", password: "sifre123", company_name: value }),
    );

    expect(signUp).not.toHaveBeenCalled();
    expect(result).toEqual({ error: "Şirket adı gerekli (2-100 karakter)." });
  });

  // AC-1/AC-2: signUp başarılı, session dolu (email confirmation kapalı) -> ensureAgentRow çağrılır + redirect.
  it("AC-1/AC-2: signUp başarılı ve session dolu ise ensureAgentRow çağrılır ve /agent/dashboard'a yönlendirilir", async () => {
    const { supabase, signUp } = setupSupabase({
      data: { user: { id: "user-1" }, session: { access_token: "tok" } },
      error: null,
    });

    await expect(
      signup(makeFormData({ email: "test@example.com", password: "sifre123", company_name: "Acme Emlak" })),
    ).rejects.toThrow("NEXT_REDIRECT");

    expect(signUp).toHaveBeenCalledWith({
      email: "test@example.com",
      password: "sifre123",
      options: { data: { company_name: "Acme Emlak" } },
    });
    expect(ensureAgentRow).toHaveBeenCalledWith(supabase, "user-1", "Acme Emlak");
    expect(redirect).toHaveBeenCalledWith("/agent/dashboard");
  });

  // AC-3: signUp başarılı ama session yok (email confirmation açık) -> ensureAgentRow çağrılmaz, genel mesaj.
  it("AC-3: signUp başarılı ama session yoksa ensureAgentRow ÇAĞRILMAZ ve genel mesaj döner", async () => {
    setupSupabase({ data: { user: { id: "user-1" }, session: null }, error: null });

    const result = await signup(
      makeFormData({ email: "test@example.com", password: "sifre123", company_name: "Acme Emlak" }),
    );

    expect(ensureAgentRow).not.toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalled();
    expect(result).toEqual({ message: GENERIC_MESSAGE });
  });

  // AC-7/AC-S3: signUp hata dönerse (örn. var olan email) AC-1/3 ile AYNI genel mesaj - enumeration önlenir.
  it("AC-7/AC-S3: signUp() hata dönerse AC-3 ile TAM AYNI genel mesaj döner, {error:...} DEĞİL", async () => {
    setupSupabase({
      data: { user: null, session: null },
      error: { message: "User already registered" },
    });

    const result = await signup(
      makeFormData({ email: "test@example.com", password: "sifre123", company_name: "Acme Emlak" }),
    );

    expect(ensureAgentRow).not.toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalled();
    expect(result).toEqual({ message: GENERIC_MESSAGE });
  });
});
