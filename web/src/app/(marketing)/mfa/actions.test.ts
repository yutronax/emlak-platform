import { beforeEach, describe, expect, it, vi } from "vitest";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

import { verifyMfa } from "./actions";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn(() => {
    throw new Error("NEXT_REDIRECT");
  }),
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));

const GENERIC_ERROR = "Kod geçersiz ya da süresi doldu.";

type Setup = {
  user?: { id: string } | null;
  isAdmin?: boolean;
  challengeResult?: { data: unknown; error: { message: string } | null };
};

// Hem admin kontrolü (getUser + agents.is_admin) hem MFA çağrıları aynı client mock'undan geçer.
// Action, aal1 admin'in de doğrulama yapabilmesi için yetki kontrolünü aal'a bağlamamalıdır.
function setupSupabase(options: Setup = {}) {
  const user = options.user === undefined ? { id: "admin-1" } : options.user;
  const isAdmin = options.isAdmin ?? true;

  const getUser = vi.fn().mockResolvedValue({ data: { user } });

  const agentsChain: Record<string, unknown> = {};
  agentsChain.select = vi.fn(() => agentsChain);
  agentsChain.eq = vi.fn(() => agentsChain);
  agentsChain.maybeSingle = vi.fn().mockResolvedValue({ data: { is_admin: isAdmin }, error: null });
  const from = vi.fn((table: string) => {
    if (table === "agents") return agentsChain;
    throw new Error(`Beklenmeyen tablo: ${table}`);
  });

  const mfa = {
    getAuthenticatorAssuranceLevel: vi.fn().mockResolvedValue({
      data: { currentLevel: "aal1", nextLevel: "aal2" },
      error: null,
    }),
    listFactors: vi.fn().mockResolvedValue({ data: { totp: [], all: [] }, error: null }),
    enroll: vi.fn().mockResolvedValue({ data: null, error: { message: "not expected" } }),
    unenroll: vi.fn().mockResolvedValue({ data: { id: "x" }, error: null }),
    challengeAndVerify: vi
      .fn()
      .mockResolvedValue(options.challengeResult ?? { data: {}, error: null }),
  };

  const supabase = { auth: { getUser, mfa }, from };
  vi.mocked(createClient).mockResolvedValue(supabase as never);
  return { mfa, getUser, from };
}

function makeFormData(fields: Record<string, string>) {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    fd.set(key, value);
  }
  return fd;
}

function expectNoMfaCall(mfa: Record<string, ReturnType<typeof vi.fn>>) {
  for (const [name, fn] of Object.entries(mfa)) {
    expect(fn, `mfa.${name} çağrılmamalı`).not.toHaveBeenCalled();
  }
}

describe("verifyMfa", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // AC-4: kod tam 6 rakam değilse Supabase'e gidilmez, Türkçe hata döner.
  it.each([
    { label: "5 rakam", code: "12345" },
    { label: "7 rakam", code: "1234567" },
    { label: "harf içeren", code: "12345a" },
    { label: "yalnız harf", code: "abcdef" },
    { label: "boşluk içeren", code: "123 456" },
    { label: "boş", code: "" },
  ])("kod $label ise challengeAndVerify ÇAĞRILMAZ ve hata döner", async ({ code }) => {
    const { mfa } = setupSupabase();

    const result = await verifyMfa(makeFormData({ factorId: "factor-1", code }));

    expect(result).toEqual({ status: "error", message: GENERIC_ERROR });
    expect(mfa.challengeAndVerify).not.toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalled();
  });

  // AC-4: Supabase doğrulama hatası -> aynı Türkçe mesaj, redirect yok.
  it("challengeAndVerify hata dönerse aynı mesajla { status: 'error' } döner ve redirect çağrılmaz", async () => {
    const { mfa } = setupSupabase({
      challengeResult: { data: null, error: { message: "Invalid TOTP code entered" } },
    });

    const result = await verifyMfa(makeFormData({ factorId: "factor-1", code: "000000" }));

    expect(mfa.challengeAndVerify).toHaveBeenCalledWith({ factorId: "factor-1", code: "000000" });
    expect(result).toEqual({ status: "error", message: GENERIC_ERROR });
    expect(redirect).not.toHaveBeenCalled();
  });

  // AC-4: başarılı doğrulama -> /admin/listings.
  it("doğru 6 haneli kodla challengeAndVerify çağrılır ve redirect('/admin/listings') yapılır", async () => {
    const { mfa } = setupSupabase();

    await expect(
      verifyMfa(makeFormData({ factorId: "factor-1", code: "123456" })),
    ).rejects.toThrow("NEXT_REDIRECT");

    expect(mfa.challengeAndVerify).toHaveBeenCalledWith({ factorId: "factor-1", code: "123456" });
    expect(redirect).toHaveBeenCalledWith("/admin/listings");
  });

  // AC-S2: kod ve secret sunucu loglarına yazılmaz (hata yolu).
  it("AC-S2: hata yolunda console çıktılarının hiçbir argümanında kod değeri geçmez", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    setupSupabase({
      challengeResult: { data: null, error: { message: "Invalid TOTP code entered" } },
    });

    await verifyMfa(makeFormData({ factorId: "factor-1", code: "987654" }));

    const logged = JSON.stringify([
      consoleErrorSpy.mock.calls,
      consoleLogSpy.mock.calls,
      consoleWarnSpy.mock.calls,
    ]);
    expect(logged).not.toContain("987654");

    consoleErrorSpy.mockRestore();
    consoleLogSpy.mockRestore();
    consoleWarnSpy.mockRestore();
  });

  // AC-S2: geçersiz format yolunda da kod loglanmaz.
  it("AC-S2: geçersiz format yolunda console çıktılarında kod değeri geçmez", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    setupSupabase();

    await verifyMfa(makeFormData({ factorId: "factor-1", code: "12ab56" }));

    const logged = JSON.stringify([consoleErrorSpy.mock.calls, consoleLogSpy.mock.calls]);
    expect(logged).not.toContain("12ab56");

    consoleErrorSpy.mockRestore();
    consoleLogSpy.mockRestore();
  });

  // Yetki: admin olmayan kullanıcı için hiçbir MFA fonksiyonu çağrılmaz.
  it("admin olmayan kullanıcıda hiçbir mfa fonksiyonu çağrılmaz ve /admin/listings'e yönlendirilmez", async () => {
    const { mfa } = setupSupabase({ isAdmin: false });

    await verifyMfa(makeFormData({ factorId: "factor-1", code: "123456" })).catch(() => undefined);

    expectNoMfaCall(mfa);
    expect(redirect).not.toHaveBeenCalledWith("/admin/listings");
  });

  // Yetki: oturumsuz kullanıcı için hiçbir MFA fonksiyonu çağrılmaz.
  it("oturum yoksa hiçbir mfa fonksiyonu çağrılmaz ve /admin/listings'e yönlendirilmez", async () => {
    const { mfa } = setupSupabase({ user: null });

    await verifyMfa(makeFormData({ factorId: "factor-1", code: "123456" })).catch(() => undefined);

    expectNoMfaCall(mfa);
    expect(redirect).not.toHaveBeenCalledWith("/admin/listings");
  });
});
