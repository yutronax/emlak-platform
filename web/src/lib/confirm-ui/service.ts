import type { ConfirmService } from "./types";

// Yalnız dev: NEXT_PUBLIC_CONFIRM_MOCK=1. "yavas@ornek.com" oran sınırını, "ag@ornek.com" ağ hatasını dener.
const mockConfirmService: ConfirmService = {
  kind: "mock",
  async resend(email) {
    await new Promise((r) => setTimeout(r, 600));
    if (email === "yavas@ornek.com") return { status: "error", code: "rate_limited" };
    if (email === "ag@ornek.com") return { status: "error", code: "network" };
    return { status: "ok" };
  },
};

// Gerçek servis henüz yok → null: ekran yeniden gönderme formunu göstermez.
export function selectConfirmService(env: { nodeEnv: string | undefined; mockFlag: string | undefined }) {
  if (env.mockFlag === "1") {
    if (env.nodeEnv === "production") throw new Error("Onay mock servisi production'da kullanılamaz.");
    return mockConfirmService;
  }
  return null;
}

export function getConfirmService(): ConfirmService | null {
  return selectConfirmService({ nodeEnv: process.env.NODE_ENV, mockFlag: process.env.NEXT_PUBLIC_CONFIRM_MOCK });
}
