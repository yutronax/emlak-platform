import { beforeEach, describe, expect, it, vi } from "vitest";

import { createClient } from "@/lib/supabase/server";

import { GET } from "./route";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

const ORIGIN = "https://emlak.example.com";
const DEFAULT_TARGET = "/agent/dashboard";

function setupSupabase() {
  const exchangeCodeForSession = vi.fn().mockResolvedValue({
    data: { session: { access_token: "tok" } },
    error: null,
  });
  vi.mocked(createClient).mockResolvedValue({
    auth: { exchangeCodeForSession },
  } as never);
  return { exchangeCodeForSession };
}

// next paramı verilmezse (undefined) query'ye eklenmez.
async function callCallback(params: { code?: string; next?: string }) {
  const url = new URL("/auth/callback", ORIGIN);
  if (params.code !== undefined) url.searchParams.set("code", params.code);
  if (params.next !== undefined) url.searchParams.set("next", params.next);
  return GET(new Request(url));
}

// Yönlendirme hedefini mutlak URL'e çözer; origin'in korunduğunu doğrulamak için.
function redirectTarget(response: Response): URL {
  const location = response.headers.get("location") ?? "";
  return new URL(location, ORIGIN);
}

describe("GET /auth/callback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // AC-12 (Critical): e-posta linkindeki code, oturuma çevrilir.
  it("code ile exchangeCodeForSession çağrılır", async () => {
    const { exchangeCodeForSession } = setupSupabase();

    await callCallback({ code: "abc", next: "/sifre-yenile" });

    expect(exchangeCodeForSession).toHaveBeenCalledWith("abc");
  });

  // AC-12 / AC-S5: güvenli göreli yol -> oraya yönlenir.
  it("next='/sifre-yenile' ise /sifre-yenile'ye yönlenir", async () => {
    setupSupabase();

    const response = await callCallback({ code: "abc", next: "/sifre-yenile" });

    const target = redirectTarget(response);
    expect(target.origin).toBe(ORIGIN);
    expect(target.pathname).toBe("/sifre-yenile");
  });

  // AC-S5 (Critical): açık yönlendirme (open redirect) girdileri -> /agent/dashboard.
  it.each([
    { label: "mutlak dış URL", next: "https://evil.com" },
    { label: "protokol-göreli //evil.com", next: "//evil.com" },
    { label: "ters eğik çizgi /\\evil.com", next: "/\\evil.com" },
  ])("AC-S5: next=$label ise /agent/dashboard'a yönlenir (dış origin'e değil)", async ({ next }) => {
    setupSupabase();

    const response = await callCallback({ code: "abc", next });

    const target = redirectTarget(response);
    expect(target.origin).toBe(ORIGIN);
    expect(target.pathname).toBe(DEFAULT_TARGET);
  });

  it("next verilmezse /agent/dashboard'a yönlenir", async () => {
    setupSupabase();

    const response = await callCallback({ code: "abc" });

    const target = redirectTarget(response);
    expect(target.origin).toBe(ORIGIN);
    expect(target.pathname).toBe(DEFAULT_TARGET);
  });
});
