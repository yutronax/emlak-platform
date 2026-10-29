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
const TERMS_ERROR = "Devam etmek için şartları kabul etmeniz gerekiyor.";
const TERMS_VERSION = "2026-10";

type SignUpResult = {
  data: { user: { id: string } | null; session: unknown };
  error: { message: string } | null;
};

function setupSupabase(signUpResult: SignUpResult) {
  const signUp = vi.fn().mockResolvedValue(signUpResult);
  const signOut = vi.fn().mockResolvedValue({ error: null });
  const supabase = { auth: { signUp, signOut } };
  vi.mocked(createClient).mockResolvedValue(supabase as never);
  return { supabase, signUp, signOut };
}

function makeFormData(fields: Record<string, string>) {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    fd.set(key, value);
  }
  return fd;
}

// Onay kutusu işaretli (name="terms", değer "on") geçerli bir form.
const VALID_FIELDS = {
  email: "test@example.com",
  password: "sifre123",
  company_name: "Acme Emlak",
  terms: "on",
};

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
      makeFormData({ ...VALID_FIELDS, company_name: value }),
    );

    expect(signUp).not.toHaveBeenCalled();
    expect(result).toEqual({ error: "Şirket adı gerekli (2-100 karakter)." });
  });

  // AC-1/AC-2: signUp başarılı, session dolu (email confirmation kapalı) -> ensureAgentRow çağrılır + redirect.
  // AC-3 (sözleşme): terms_version '2026-10' kayıt meta verisinde taşınır.
  it("AC-1/AC-2: signUp başarılı ve session dolu ise ensureAgentRow çağrılır ve /agent/dashboard'a yönlendirilir", async () => {
    const { supabase, signUp } = setupSupabase({
      data: { user: { id: "user-1" }, session: { access_token: "tok" } },
      error: null,
    });

    await expect(signup(makeFormData(VALID_FIELDS))).rejects.toThrow("NEXT_REDIRECT");

    expect(signUp).toHaveBeenCalledWith({
      email: "test@example.com",
      password: "sifre123",
      options: { data: { company_name: "Acme Emlak", terms_version: TERMS_VERSION } },
    });
    expect(ensureAgentRow).toHaveBeenCalledWith(supabase, "user-1", "Acme Emlak", { accepted: true });
    expect(redirect).toHaveBeenCalledWith("/agent/dashboard");
  });

  // Regresyon (login ile aynı davranış): ensureAgentRow hata verirse signOut + açık hata mesajı,
  // dashboard'a yönlendirme YOK.
  it("ensureAgentRow hata verirse signOut çağrılır, hata mesajı döner ve /agent/dashboard'a yönlendirilmez", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { supabase, signOut } = setupSupabase({
      data: { user: { id: "user-1" }, session: { access_token: "tok" } },
      error: null,
    });
    vi.mocked(ensureAgentRow).mockRejectedValueOnce({ code: "42501", message: "row-level security" });

    const result = await signup(makeFormData(VALID_FIELDS));

    expect(ensureAgentRow).toHaveBeenCalledWith(supabase, "user-1", "Acme Emlak", { accepted: true });
    expect(signOut).toHaveBeenCalledTimes(1);
    expect(redirect).not.toHaveBeenCalled();
    expect(result).toEqual({
      error:
        "Hesabınız hazırlanırken bir sorun oluştu. Lütfen tekrar deneyin; sorun sürerse WhatsApp'tan bize yazın.",
    });
    errorSpy.mockRestore();
  });

  // AC-3: signUp başarılı ama session yok (email confirmation açık) -> ensureAgentRow çağrılmaz, genel mesaj.
  it("AC-3: signUp başarılı ama session yoksa ensureAgentRow ÇAĞRILMAZ ve genel mesaj döner", async () => {
    setupSupabase({ data: { user: { id: "user-1" }, session: null }, error: null });

    const result = await signup(makeFormData(VALID_FIELDS));

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

    const result = await signup(makeFormData(VALID_FIELDS));

    expect(ensureAgentRow).not.toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalled();
    expect(result).toEqual({ message: GENERIC_MESSAGE });
  });

  // AC-2 (Critical): onay kutusu işaretsizse (alan hiç gelmez) signUp ÇAĞRILMAZ, şartlar hatası döner.
  it("AC-2: terms alanı yoksa (işaretsiz) signUp() ÇAĞRILMAZ ve 'şartları kabul' hatası döner", async () => {
    const { signUp } = setupSupabase({ data: { user: null, session: null }, error: null });

    const result = await signup(
      makeFormData({ email: "test@example.com", password: "sifre123", company_name: "Acme Emlak" }),
    );

    expect(signUp).not.toHaveBeenCalled();
    expect(ensureAgentRow).not.toHaveBeenCalled();
    expect(result).toEqual({ error: TERMS_ERROR });
  });

  // AC-S4 (Tampering): onay değeri on/true dışında ise kabul edilmez.
  it.each([
    { label: "false", value: "false" },
    { label: "yes", value: "yes" },
    { label: "tarih benzeri", value: "2000-01-01" },
  ])("AC-S4: terms=$label kabul edilmez, signUp() ÇAĞRILMAZ", async ({ value }) => {
    const { signUp } = setupSupabase({ data: { user: null, session: null }, error: null });

    const result = await signup(makeFormData({ ...VALID_FIELDS, terms: value }));

    expect(signUp).not.toHaveBeenCalled();
    expect(result).toEqual({ error: TERMS_ERROR });
  });

  it.each(["on", "true"])("AC-S4: terms=%s kabul edilir ve signUp() çağrılır", async (value) => {
    const { signUp } = setupSupabase({ data: { user: null, session: null }, error: null });

    await signup(makeFormData({ ...VALID_FIELDS, terms: value }));

    expect(signUp).toHaveBeenCalledTimes(1);
  });

  // AC-S4 (Tampering): form'a terms_accepted_at eklense bile signUp'a GEÇMEZ; sunucu kendi sabitini yazar.
  it("AC-S4: formda terms_accepted_at=2000-01-01 olsa bile signUp meta verisine geçmez, terms_version sabit '2026-10'", async () => {
    const { signUp } = setupSupabase({ data: { user: null, session: null }, error: null });

    await signup(makeFormData({ ...VALID_FIELDS, terms_accepted_at: "2000-01-01" }));

    expect(signUp).toHaveBeenCalledWith({
      email: "test@example.com",
      password: "sifre123",
      options: { data: { company_name: "Acme Emlak", terms_version: TERMS_VERSION } },
    });
    const payload = JSON.stringify(signUp.mock.calls[0]);
    expect(payload).not.toContain("terms_accepted_at");
    expect(payload).not.toContain("2000-01-01");
  });
});
