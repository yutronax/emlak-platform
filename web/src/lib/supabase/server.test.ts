import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Regresyon: e-posta/şifre girişinden sonra oturum çerezi (sb-<ref>-auth-token)
// server action yanıtına yazılmalı; yalnız PKCE code-verifier yazılırsa panel
// yeniden girişe atar. Gerçek @supabase/ssr + sahte fetch ile çerez yolunu sınar.
const jar = new Map<string, { value: string; options: Record<string, unknown> }>();
const cookieStore = {
  getAll: () => [...jar].map(([name, { value }]) => ({ name, value })),
  set: vi.fn((name: string, value: string, options: Record<string, unknown> = {}) => {
    jar.set(name, { value, options });
  }),
};

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => cookieStore),
}));

import { createClient } from "./server";

const URL_ = "https://abcdefghijklmnop.supabase.co";

function base64url(obj: unknown) {
  return Buffer.from(JSON.stringify(obj)).toString("base64url");
}

beforeEach(() => {
  jar.clear();
  cookieStore.set.mockClear();
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", URL_);
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-key");
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const accessToken = `${base64url({ alg: "HS256" })}.${base64url({ sub: "u1", exp })}.sig`;
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      new Response(
        JSON.stringify({
          access_token: accessToken,
          token_type: "bearer",
          expires_in: 3600,
          expires_at: exp,
          refresh_token: "refresh",
          user: { id: "u1", aud: "authenticated", email: "a@b.c", app_metadata: {}, user_metadata: {} },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    ),
  );
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("createClient (server) — giriş sonrası oturum çerezi", () => {
  it("signInWithPassword sonrası sb-<ref>-auth-token çerezi yazılır", async () => {
    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithPassword({ email: "a@b.c", password: "x" });
    expect(error).toBeNull();

    // setAll ilk kaydırılmış mikro-görevde çalışabilir.
    await new Promise((r) => setTimeout(r, 0));

    const names = [...jar.keys()];
    expect(names.some((n) => /^sb-abcdefghijklmnop-auth-token(\.\d+)?$/.test(n))).toBe(true);
  });

  it("çerez localhost'ta çalışır: domain yok, secure zorlanmaz, path /", async () => {
    const supabase = await createClient();
    await supabase.auth.signInWithPassword({ email: "a@b.c", password: "x" });
    await new Promise((r) => setTimeout(r, 0));

    const [, { options }] = [...jar].find(([n]) => n.includes("auth-token"))!;
    expect(options.domain).toBeUndefined();
    expect(options.secure).not.toBe(true);
    expect(options.path).toBe("/");
  });
});
