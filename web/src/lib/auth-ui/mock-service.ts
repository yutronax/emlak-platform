import type { AuthService } from "./types";

// Yalnız dev/test: NEXT_PUBLIC_AUTH_MOCK=1. Fixture e-postalarıyla her durum denenebilir:
//   hatali@ornek.com → invalid_credentials, yavas@ornek.com → rate_limited, ag@ornek.com → network.
const wait = (ms = 700) => new Promise((r) => setTimeout(r, ms));

export const mockAuthService: AuthService = {
  kind: "mock",
  capabilities: { google: true },

  async signIn({ email }) {
    await wait();
    if (email === "hatali@ornek.com") return { status: "error", code: "invalid_credentials" };
    if (email === "yavas@ornek.com") return { status: "error", code: "rate_limited" };
    if (email === "ag@ornek.com") return { status: "error", code: "network" };
    return { status: "ok", redirectTo: "/agent/dashboard" };
  },

  async signUp({ email }) {
    await wait();
    if (email === "ag@ornek.com") return { status: "error", code: "network" };
    return { status: "check_email", email };
  },

  async signInWithGoogle() {
    await wait(400);
    return { status: "error", code: "oauth_cancelled" };
  },
};
