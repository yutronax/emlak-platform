import { beforeEach, describe, expect, it, vi } from "vitest";

import { createClient } from "@/lib/supabase/server";

import { resendConfirmation } from "./actions";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

function setupSupabase(result: { error: null | { status?: number; message?: string } }) {
  const resend = vi.fn().mockResolvedValue({ data: {}, ...result });
  vi.mocked(createClient).mockResolvedValue({ auth: { resend } } as never);
  return { resend };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://emlak.example.com");
  vi.spyOn(console, "info").mockImplementation(() => {});
});

describe("resendConfirmation", () => {
  it("kayıt onayını aynı dönüş adresiyle yeniden gönderir", async () => {
    const { resend } = setupSupabase({ error: null });

    expect(await resendConfirmation(" ayse@acme.com ")).toEqual({ status: "ok" });
    expect(resend).toHaveBeenCalledWith({
      type: "signup",
      email: "ayse@acme.com",
      options: { emailRedirectTo: "https://emlak.example.com/auth/callback?next=/e-posta-onay" },
    });
  });

  it("geçersiz e-postada Supabase çağrılmaz", async () => {
    const { resend } = setupSupabase({ error: null });

    expect(await resendConfirmation("yanlis")).toEqual({ status: "error", code: "invalid_email" });
    expect(resend).not.toHaveBeenCalled();
  });

  it("oran sınırı (429) rate_limited olarak döner", async () => {
    setupSupabase({ error: { status: 429, message: "over_email_send_rate_limit" } });

    expect(await resendConfirmation("ayse@acme.com")).toEqual({ status: "error", code: "rate_limited" });
  });

  // Hesabın varlığı açıklanmaz (signup AC-S3): kayıtsız adres / zaten onaylı hesap hatası da "ok".
  it("diğer Supabase hataları hesap varlığını sızdırmamak için ok döner", async () => {
    setupSupabase({ error: { status: 400, message: "User not found" } });

    expect(await resendConfirmation("yok@acme.com")).toEqual({ status: "ok" });
  });

  it("e-posta adresi loglanmaz, yalnız sonuç", async () => {
    setupSupabase({ error: null });

    await resendConfirmation("ayse@acme.com");

    const logged = JSON.stringify(vi.mocked(console.info).mock.calls);
    expect(logged).not.toContain("ayse@acme.com");
    expect(logged).toContain("confirmation_resend_requested");
  });
});
