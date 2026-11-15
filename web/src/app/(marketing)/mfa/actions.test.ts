import { beforeEach, describe, expect, it, vi } from "vitest";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

import { startEnrollment, verifyMfa } from "./actions";

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
const ENROLL_ERROR = "Kurulum başlatılamadı. Tekrar deneyin.";
const NO_AUTH = "Yetkiniz yok.";
const QR = "data:image/svg+xml;base64,PHN2Zy8+";
const SECRET = "JBSWY3DPEHPK3PXP";

type Factor = { id: string; status: "verified" | "unverified"; factor_type: "totp" };

type Setup = {
  user?: { id: string } | null;
  isAdmin?: boolean;
  challengeResult?: { data: unknown; error: { message: string } | null };
  factors?: Factor[];
  enrollFails?: boolean;
};

// Hem admin kontrolü (getUser + agents.is_admin) hem MFA çağrıları aynı client mock'undan geçer.
// verifyMfa aal1 admin için de çalışmalı; bu yüzden yetki kontrolü aal'a bağlı olmamalıdır.
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

  const factors = options.factors ?? [];
  const mfa = {
    getAuthenticatorAssuranceLevel: vi.fn().mockResolvedValue({
      data: { currentLevel: "aal1", nextLevel: "aal2" },
      error: null,
    }),
    listFactors: vi.fn().mockResolvedValue({ data: { totp: factors, all: factors }, error: null }),
    enroll: vi.fn().mockResolvedValue(
      options.enrollFails
        ? { data: null, error: { message: "enroll boom" } }
        : {
            data: {
              id: "factor-new",
              type: "totp",
              totp: { qr_code: QR, secret: SECRET, uri: "otpauth://totp/Admin?secret=JBSWY3DPEHPK3PXP" },
            },
            error: null,
          },
    ),
    unenroll: vi.fn().mockResolvedValue({ data: { id: "factor-old" }, error: null }),
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

describe("startEnrollment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Yetki: admin değil / oturum yok -> hiçbir mfa fonksiyonu çağrılmaz.
  it.each([
    { label: "admin değil", options: { isAdmin: false } },
    { label: "oturum yok", options: { user: null } },
  ])("$label ise mfa fonksiyonu çağrılmaz ve { status: 'error', message: 'Yetkiniz yok.' } döner", async ({ options }) => {
    const { mfa } = setupSupabase({ ...options, factors: [UNVERIFIED] });

    const result = await startEnrollment();

    expectNoMfaCall(mfa);
    expect(result).toEqual({ status: "error", message: NO_AUTH });
  });

  // AC-4: unverified faktörler kurulumdan önce unenroll ile temizlenir.
  it("unverified TOTP faktörleri enroll'dan ÖNCE unenroll ile temizlenir", async () => {
    const { mfa } = setupSupabase({ factors: [UNVERIFIED] });

    await startEnrollment();

    expect(mfa.listFactors).toHaveBeenCalled();
    expect(mfa.unenroll).toHaveBeenCalledWith({ factorId: "factor-old" });
    expect(mfa.enroll).toHaveBeenCalledTimes(1);
    expect(mfa.unenroll.mock.invocationCallOrder[0]).toBeLessThan(
      mfa.enroll.mock.invocationCallOrder[0],
    );
  });

  // Güvenlik: zaten doğrulanmış TOTP faktörü varsa yeni kurulum YAPILMAZ. Aksi halde parolası
  // çalınan biri kendi cihazını ikinci faktör olarak ekleyip MFA'yı atlatabilir.
  it.each([
    { label: "yalnız doğrulanmış faktör", factors: [VERIFIED] },
    { label: "doğrulanmış + unverified faktör", factors: [VERIFIED, UNVERIFIED] },
  ])(
    "$label varsa enroll ve unenroll ÇAĞRILMAZ, { status: 'error', message: 'MFA zaten kurulu.' } döner",
    async ({ factors }) => {
      const { mfa } = setupSupabase({ factors });

      const result = await startEnrollment();

      expect(mfa.enroll).not.toHaveBeenCalled();
      expect(mfa.unenroll).not.toHaveBeenCalled();
      expect(result).toEqual({ status: "error", message: "MFA zaten kurulu." });
    },
  );

  // Başarı: enroll çağrılır, factorId + qr + secret döner.
  it("başarıda enroll({ factorType: 'totp', friendlyName: 'Admin' }) çağrılır ve { status: 'ok', factorId, qr, secret } döner", async () => {
    const { mfa } = setupSupabase({ factors: [] });

    const result = await startEnrollment();

    expect(mfa.enroll).toHaveBeenCalledWith({ factorType: "totp", friendlyName: "Admin" });
    expect(result).toEqual({ status: "ok", factorId: "factor-new", qr: QR, secret: SECRET });
  });

  // Hata: enroll başarısız -> Türkçe mesaj.
  it("enroll hata dönerse { status: 'error', message: 'Kurulum başlatılamadı. Tekrar deneyin.' } döner", async () => {
    setupSupabase({ factors: [], enrollFails: true });

    const result = await startEnrollment();

    expect(result).toEqual({ status: "error", message: ENROLL_ERROR });
  });

  // AC-S2: secret ve QR asla loglanmaz (başarı ve hata yolları).
  it("AC-S2: başarı ve hata yollarında console çıktılarında secret/QR geçmez", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    setupSupabase({ factors: [] });
    await startEnrollment();
    setupSupabase({ factors: [], enrollFails: true });
    await startEnrollment();

    const logged = JSON.stringify([
      consoleErrorSpy.mock.calls,
      consoleLogSpy.mock.calls,
      consoleWarnSpy.mock.calls,
    ]);
    expect(logged).not.toContain(SECRET);
    expect(logged).not.toContain(QR);

    consoleErrorSpy.mockRestore();
    consoleLogSpy.mockRestore();
    consoleWarnSpy.mockRestore();
  });
});

describe("verifyMfa", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // AC-4: kod tam 6 rakam değilse Supabase çağrılmadan Türkçe hata döner.
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

const UNVERIFIED: Factor = { id: "factor-old", status: "unverified", factor_type: "totp" };
const VERIFIED: Factor = { id: "factor-verified", status: "verified", factor_type: "totp" };
