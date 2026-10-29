import { headers } from "next/headers";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createClient } from "@/lib/supabase/server";

import { requestPasswordReset } from "./actions";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

// Reset redirectTo sunucu sabitinden üretilmeli; header okunmamalı (AC-S5).
vi.mock("next/headers", () => ({
  headers: vi.fn(),
  cookies: vi.fn(),
}));

const SITE = "https://emlak.example.com";
const REGISTERED_EMAIL = "kayitli@example.com";
const INVALID_EMAIL_MESSAGE = "Geçerli bir e-posta girin";
const OK = { ok: true };

type ResetError = { message: string; status?: number } | null;

function setupSupabase(error: ResetError) {
  const resetPasswordForEmail = vi.fn().mockResolvedValue({ data: {}, error });
  const supabase = { auth: { resetPasswordForEmail } };
  vi.mocked(createClient).mockResolvedValue(supabase as never);
  return { resetPasswordForEmail };
}

function makeFormData(email: string) {
  const fd = new FormData();
  fd.set("email", email);
  return fd;
}

// console.info veya console.log üzerinden düşen 'password_reset_requested' kaydını bulur.
function findResetLog(spies: Array<ReturnType<typeof vi.spyOn>>) {
  const calls = spies.flatMap((spy) => spy.mock.calls as unknown[][]);
  return calls.find((args) => args[0] === "password_reset_requested");
}

describe("requestPasswordReset (/sifremi-unuttum)", () => {
  let infoSpy: ReturnType<typeof vi.spyOn>;
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_SITE_URL = SITE;
    infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    infoSpy.mockRestore();
    logSpy.mockRestore();
  });

  // AC-11 (High): geçersiz format -> hata; Supabase çağrılmaz.
  it.each(["", "abc", "a@"])(
    "AC-11: geçersiz e-posta (%j) için {error:'Geçerli bir e-posta girin'} döner ve sıfırlama istenmez",
    async (email) => {
      const { resetPasswordForEmail } = setupSupabase(null);

      const result = await requestPasswordReset(makeFormData(email));

      expect(result).toEqual({ error: INVALID_EMAIL_MESSAGE });
      expect(resetPasswordForEmail).not.toHaveBeenCalled();
    },
  );

  // AC-S6 (High): kayıtlı, kayıtsız ve rate-limit durumları birebir aynı sonucu döner.
  it("AC-S6: kayıtlı, kayıtsız ve rate-limit durumlarında dönüş değeri birebir {ok:true}'dur", async () => {
    const outcomes: unknown[] = [];

    setupSupabase(null);
    outcomes.push(await requestPasswordReset(makeFormData(REGISTERED_EMAIL)));

    setupSupabase({ message: "User not found", status: 400 });
    outcomes.push(await requestPasswordReset(makeFormData("kayitsiz@example.com")));

    setupSupabase({ message: "For security purposes, you can only request this after 60 seconds.", status: 429 });
    outcomes.push(await requestPasswordReset(makeFormData(REGISTERED_EMAIL)));

    for (const outcome of outcomes) {
      expect(outcome).toEqual(OK);
    }
    expect(new Set(outcomes.map((o) => JSON.stringify(o))).size).toBe(1);
  });

  it("AC-S6: Supabase hata mesajı kullanıcıya iletilmez", async () => {
    setupSupabase({ message: "User not found", status: 400 });

    const result = await requestPasswordReset(makeFormData("kayitsiz@example.com"));

    expect(JSON.stringify(result)).not.toContain("User not found");
  });

  // AC-11 / AC-S5 (Critical): redirectTo sunucu sabitinden üretilir ve /auth/callback?next=/sifre-yenile'dir.
  it("AC-11/AC-S5: resetPasswordForEmail redirectTo = NEXT_PUBLIC_SITE_URL + '/auth/callback?next=/sifre-yenile'", async () => {
    const { resetPasswordForEmail } = setupSupabase(null);

    await requestPasswordReset(makeFormData(REGISTERED_EMAIL));

    expect(resetPasswordForEmail).toHaveBeenCalledWith(REGISTERED_EMAIL, {
      redirectTo: `${SITE}/auth/callback?next=/sifre-yenile`,
    });
  });

  it("AC-S5: redirectTo için istek header'ı (headers()) okunmaz", async () => {
    setupSupabase(null);

    await requestPasswordReset(makeFormData(REGISTERED_EMAIL));

    expect(headers).not.toHaveBeenCalled();
  });

  // AC-11 / AC-S8 (Medium): password_reset_requested {result} loglanır, e-posta içermez.
  it.each([
    { label: "başarılı", error: null, result: "ok" },
    { label: "rate limit (429)", error: { message: "rate", status: 429 }, result: "rate_limited" },
    { label: "diğer hata", error: { message: "boom", status: 500 }, result: "error" },
  ])("AC-11: $label durumunda password_reset_requested {result:'$result'} loglanır", async ({ error, result }) => {
    setupSupabase(error);

    await requestPasswordReset(makeFormData(REGISTERED_EMAIL));

    const entry = findResetLog([infoSpy, logSpy]);
    expect(entry).toBeDefined();
    expect(entry?.[1]).toEqual({ result });
  });

  it("AC-S8: password_reset_requested logunda e-posta yoktur", async () => {
    setupSupabase({ message: "rate", status: 429 });

    await requestPasswordReset(makeFormData(REGISTERED_EMAIL));

    const allLogged = JSON.stringify([
      ...infoSpy.mock.calls,
      ...logSpy.mock.calls,
    ]);
    expect(allLogged).not.toContain(REGISTERED_EMAIL);
  });
});
