import { resendConfirmation } from "@/app/(marketing)/e-posta-onay/actions";

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

// Gerçek servis: Supabase auth.resend'i çağıran sunucu aksiyonu. Geçersiz e-posta istemcide zaten elenir;
// sunucu yine de reddederse kullanıcı "tekrar deneyin" görür.
const serverActionConfirmService: ConfirmService = {
  kind: "real",
  async resend(email) {
    try {
      const res = await resendConfirmation(email);
      if (res.status === "ok") return res;
      return res.code === "rate_limited" ? { status: "error", code: "rate_limited" } : { status: "error", code: "network" };
    } catch {
      return { status: "error", code: "network" };
    }
  },
};

export function selectConfirmService(env: { nodeEnv: string | undefined; mockFlag: string | undefined }): ConfirmService {
  if (env.mockFlag === "1") {
    if (env.nodeEnv === "production") throw new Error("Onay mock servisi production'da kullanılamaz.");
    return mockConfirmService;
  }
  return serverActionConfirmService;
}

export function getConfirmService(): ConfirmService {
  return selectConfirmService({ nodeEnv: process.env.NODE_ENV, mockFlag: process.env.NEXT_PUBLIC_CONFIRM_MOCK });
}
