import { redirect } from "next/navigation";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createClient } from "@/lib/supabase/server";

import { updatePassword } from "./actions";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn(() => {
    throw new Error("NEXT_REDIRECT");
  }),
}));

const EXPIRED_MESSAGE = "Bağlantının süresi dolmuş";
const TOO_SHORT_MESSAGE = "En az 8 karakter";
const MISMATCH_MESSAGE = "Şifreler eşleşmiyor";

type UpdateError = { message: string; code?: string } | null;

// Oturum (recovery) durumu ve updateUser sonucu ayarlanır.
function setupSupabase(opts: { user: { id: string } | null; updateError?: UpdateError }) {
  const getUser = vi.fn().mockResolvedValue({ data: { user: opts.user }, error: null });
  const updateUser = vi.fn().mockResolvedValue({
    data: { user: opts.user },
    error: opts.updateError ?? null,
  });
  const supabase = { auth: { getUser, updateUser } };
  vi.mocked(createClient).mockResolvedValue(supabase as never);
  return { getUser, updateUser };
}

function makeFormData(fields: Record<string, string>) {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    fd.set(key, value);
  }
  return fd;
}

const RECOVERY_USER = { id: "user-1" };

describe("updatePassword (/sifre-yenile)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // AC-12 / AC-S7 (High): oturum yok / süresi dolmuş -> updateUser ÇAĞRILMAZ.
  it("AC-S7: oturum yoksa {error:'Bağlantının süresi dolmuş'} döner ve updateUser çağrılmaz", async () => {
    const { updateUser } = setupSupabase({ user: null });

    const result = await updatePassword(
      makeFormData({ password: "yenisifre123", password_confirm: "yenisifre123" }),
    );

    expect(result).toEqual({ error: EXPIRED_MESSAGE });
    expect(updateUser).not.toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalled();
  });

  // AC-12 / AC-S7: sunucuda da en az 8 karakter kontrolü.
  it("AC-12/AC-S7: şifre 8 karakterden kısaysa 'En az 8 karakter' döner ve updateUser çağrılmaz", async () => {
    const { updateUser } = setupSupabase({ user: RECOVERY_USER });

    const result = await updatePassword(
      makeFormData({ password: "1234567", password_confirm: "1234567" }),
    );

    expect(result).toEqual({ error: TOO_SHORT_MESSAGE });
    expect(updateUser).not.toHaveBeenCalled();
  });

  // AC-12 (High): iki alan eşleşmezse hata.
  it("AC-12: yeni şifre ve tekrarı eşleşmezse 'Şifreler eşleşmiyor' döner ve updateUser çağrılmaz", async () => {
    const { updateUser } = setupSupabase({ user: RECOVERY_USER });

    const result = await updatePassword(
      makeFormData({ password: "yenisifre123", password_confirm: "yenisifre124" }),
    );

    expect(result).toEqual({ error: MISMATCH_MESSAGE });
    expect(updateUser).not.toHaveBeenCalled();
  });

  // AC-12 (Critical): geçerli recovery oturumunda şifre güncellenir ve panele yönlendirilir.
  // Panelde "Şifreniz güncellendi." bilgisi için password_updated=1 işaretiyle.
  it("AC-12: geçerli oturumda updateUser({password}) çağrılır ve /agent/dashboard?password_updated=1'e yönlendirilir", async () => {
    const { updateUser } = setupSupabase({ user: RECOVERY_USER });

    await expect(
      updatePassword(makeFormData({ password: "yenisifre123", password_confirm: "yenisifre123" })),
    ).rejects.toThrow("NEXT_REDIRECT");

    expect(updateUser).toHaveBeenCalledWith({ password: "yenisifre123" });
    expect(redirect).toHaveBeenCalledWith("/agent/dashboard?password_updated=1");
  });

  // AC-12 (Medium): güncelleme hatası -> password_update_failed {reason} loglanır, şifre loglanmaz.
  it("AC-12: updateUser hata dönerse console.error('password_update_failed', {reason}) yazılır ve şifre loglanmaz", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    setupSupabase({
      user: RECOVERY_USER,
      updateError: { message: "Password should not contain secret", code: "weak_password" },
    });

    const result = await updatePassword(
      makeFormData({ password: "yenisifre123", password_confirm: "yenisifre123" }),
    );

    expect(result).toHaveProperty("error");
    const call = errorSpy.mock.calls.find((args) => args[0] === "password_update_failed");
    expect(call).toBeDefined();
    expect(call?.[1]).toEqual({ reason: expect.any(String) });
    expect(JSON.stringify(errorSpy.mock.calls)).not.toContain("yenisifre123");

    errorSpy.mockRestore();
  });
});
