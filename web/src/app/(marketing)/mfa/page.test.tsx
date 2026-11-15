// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";

import { startEnrollment, verifyMfa } from "./actions";
import Page from "./page";

// connection() test ortamında istek kapsamı olmadan atar; dashboard testleriyle aynı mock.
vi.mock("next/server", async (orig) => ({
  ...(await orig<typeof import("next/server")>()),
  connection: vi.fn(async () => {}),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("./actions", () => ({
  verifyMfa: vi.fn(),
  startEnrollment: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn(() => {
    throw new Error("NEXT_REDIRECT");
  }),
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));

type Factor = { id: string; status: "verified" | "unverified"; factor_type: "totp" };

const QR = "data:image/svg+xml;base64,PHN2Zy8+";
const SECRET = "JBSWY3DPEHPK3PXP";
const VERIFIED: Factor = { id: "factor-verified", status: "verified", factor_type: "totp" };
const UNVERIFIED: Factor = { id: "factor-old", status: "unverified", factor_type: "totp" };

type Setup = {
  user?: { id: string } | null;
  isAdmin?: boolean;
  aal?: "aal1" | "aal2";
  factors?: Factor[];
};

function setupSupabase(options: Setup = {}) {
  const user = options.user === undefined ? { id: "admin-1" } : options.user;
  const isAdmin = options.isAdmin ?? true;
  const aal = options.aal ?? "aal1";
  const factors = options.factors ?? [];

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
      data: { currentLevel: aal, nextLevel: "aal2" },
      error: null,
    }),
    listFactors: vi.fn().mockResolvedValue({ data: { totp: factors, all: factors }, error: null }),
    enroll: vi.fn().mockResolvedValue({
      data: {
        id: "factor-new",
        type: "totp",
        totp: { qr_code: QR, secret: SECRET, uri: "otpauth://totp/Admin?secret=JBSWY3DPEHPK3PXP" },
      },
      error: null,
    }),
    unenroll: vi.fn().mockResolvedValue({ data: { id: "factor-old" }, error: null }),
    challengeAndVerify: vi.fn().mockResolvedValue({ data: {}, error: null }),
  };

  const supabase = { auth: { getUser, mfa }, from };
  vi.mocked(createClient).mockResolvedValue(supabase as never);
  return { mfa, getUser, from };
}

async function renderPage() {
  const jsx = await Page({ searchParams: Promise.resolve({}) } as never);
  render(jsx as never);
}

function hiddenFactorId(): string | undefined {
  const input = document.querySelector('input[name="factorId"]') as HTMLInputElement | null;
  return input?.value;
}

describe("MfaPage (/mfa)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  // AC-4 / AC-S3: oturum yok -> /login, MFA API'si hiç çağrılmaz.
  it("oturum yoksa redirect('/login') çağrılır ve MFA fonksiyonları çağrılmaz", async () => {
    const { mfa } = setupSupabase({ user: null });

    await expect(Page({ searchParams: Promise.resolve({}) } as never)).rejects.toThrow(
      "NEXT_REDIRECT",
    );

    expect(redirect).toHaveBeenCalledWith("/login");
    expect(mfa.listFactors).not.toHaveBeenCalled();
    expect(mfa.enroll).not.toHaveBeenCalled();
  });

  // AC-4: admin değilse sayfa yokmuş gibi davranılır, MFA kurulumu yapılmaz.
  it("admin değilse notFound() çağrılır ve MFA fonksiyonları çağrılmaz", async () => {
    const { mfa } = setupSupabase({ isAdmin: false });

    await expect(Page({ searchParams: Promise.resolve({}) } as never)).rejects.toThrow(
      "NEXT_NOT_FOUND",
    );

    expect(notFound).toHaveBeenCalled();
    expect(mfa.listFactors).not.toHaveBeenCalled();
    expect(mfa.enroll).not.toHaveBeenCalled();
  });

  // AC-4: zaten aal2 ise /admin/listings'e yönlendirilir.
  it("admin ve aal2 ise redirect('/admin/listings') çağrılır ve kurulum yapılmaz", async () => {
    const { mfa } = setupSupabase({ aal: "aal2", factors: [VERIFIED] });

    await expect(Page({ searchParams: Promise.resolve({}) } as never)).rejects.toThrow(
      "NEXT_REDIRECT",
    );

    expect(redirect).toHaveBeenCalledWith("/admin/listings");
    expect(mfa.enroll).not.toHaveBeenCalled();
  });

  // Yeni sözleşme: render asla enroll/unenroll çağırmaz (QR anahtarı kullanıcı kodu girene dek sabit kalmalı).
  it("faktör yokken render enroll ve unenroll ÇAĞIRMAZ, startEnrollment de render'da çağrılmaz", async () => {
    const { mfa } = setupSupabase({ factors: [] });

    await renderPage();

    expect(mfa.enroll).not.toHaveBeenCalled();
    expect(mfa.unenroll).not.toHaveBeenCalled();
    expect(startEnrollment).not.toHaveBeenCalled();
  });

  // Yeni sözleşme: unverified faktör varken de render temizlik/kurulum yapmaz.
  it("unverified faktör varken render enroll ve unenroll ÇAĞIRMAZ", async () => {
    const { mfa } = setupSupabase({ factors: [UNVERIFIED] });

    await renderPage();

    expect(mfa.enroll).not.toHaveBeenCalled();
    expect(mfa.unenroll).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /kurulumu başlat/i })).toBeInTheDocument();
  });

  // Yeni sözleşme: yeniden render (server action sonrası dahil) yeni anahtar üretmez.
  it("sayfa yeniden render edildiğinde de enroll çağrılmaz", async () => {
    const { mfa } = setupSupabase({ factors: [] });

    await renderPage();
    cleanup();
    await renderPage();

    expect(mfa.enroll).not.toHaveBeenCalled();
    expect(mfa.unenroll).not.toHaveBeenCalled();
  });

  // Yeni sözleşme: faktör yokken kurulum bileşeni (buton) görünür; QR/secret render'da yok.
  it("faktör yokken 'Kurulumu başlat' butonu görünür, QR ve secret render'da yoktur", async () => {
    setupSupabase({ factors: [] });

    await renderPage();

    expect(screen.getByRole("button", { name: /kurulumu başlat/i })).toBeInTheDocument();
    expect(document.querySelector("img")).toBeNull();
    expect(screen.queryByText(SECRET)).toBeNull();
    expect(hiddenFactorId()).toBeUndefined();
  });

  // AC-S3: faktörler argümansız mfa.listFactors() ile (oturum sahibinin) okunur.
  it("AC-S3: faktörler argümansız mfa.listFactors() ile okunur", async () => {
    const { mfa } = setupSupabase({ factors: [UNVERIFIED] });

    await renderPage();

    expect(mfa.listFactors).toHaveBeenCalledTimes(1);
    expect(mfa.listFactors).toHaveBeenCalledWith();
  });

  // AC-4: doğrulanmış faktör varsa kurulum yapılmaz, yalnız kod formu gösterilir.
  it("doğrulanmış faktör varsa enroll ÇAĞRILMAZ, QR/secret gösterilmez, yalnız kod formu görünür", async () => {
    const { mfa } = setupSupabase({ factors: [VERIFIED] });

    await renderPage();

    expect(mfa.enroll).not.toHaveBeenCalled();
    expect(mfa.unenroll).not.toHaveBeenCalled();
    expect(document.querySelector("img")).toBeNull();
    expect(screen.queryByText(SECRET)).toBeNull();
    expect(screen.getByLabelText(/doğrulama kodu/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /doğrula/i })).toBeInTheDocument();
    expect(hiddenFactorId()).toBe("factor-verified");
  });

  // AC-4: yanlış kod -> Türkçe hata metni, sayfa kalır, yönlendirme yok.
  it("yanlış kodda Türkçe hata metni gösterilir, sayfa kalır ve yönlendirme yapılmaz", async () => {
    vi.mocked(verifyMfa).mockResolvedValue({
      status: "error",
      message: "Kod geçersiz ya da süresi doldu.",
    });
    setupSupabase({ factors: [VERIFIED] });

    await renderPage();

    fireEvent.change(screen.getByLabelText(/doğrulama kodu/i), { target: { value: "000000" } });
    fireEvent.click(screen.getByRole("button", { name: /doğrula/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Kod geçersiz ya da süresi doldu.");
    expect(screen.getByLabelText(/doğrulama kodu/i)).toBeInTheDocument();
    expect(redirect).not.toHaveBeenCalled();
  });
});
