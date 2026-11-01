import { beforeEach, describe, expect, it, vi } from "vitest";

const supabase = vi.hoisted(() => ({ auth: { signOut: vi.fn() } }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn(async () => supabase) }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
}));

import { signOut } from "./actions";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("signOut", () => {
  it("oturumu kapatır ve /login'e yönlendirir", async () => {
    supabase.auth.signOut.mockResolvedValue({ error: null });

    await expect(signOut()).rejects.toThrow("REDIRECT:/login");
    expect(supabase.auth.signOut).toHaveBeenCalledWith({ scope: "local" });
  });

  it("sağlayıcı hata dönse de kullanıcıyı içeride bırakmaz", async () => {
    supabase.auth.signOut.mockResolvedValue({ error: { message: "x" } });
    vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(signOut()).rejects.toThrow("REDIRECT:/login");
  });
});
