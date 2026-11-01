import { createMockBillingService } from "./mock-service";
import type { BillingService } from "./types";

// Gerçek servis henüz yok: null → /account/subscription mevcut (sunucu) sürümüyle çalışmaya devam eder.
export function selectBillingService(env: {
  nodeEnv: string | undefined;
  mockFlag: string | undefined;
  scenario?: string;
}): BillingService | null {
  if (env.mockFlag === "1") {
    if (env.nodeEnv === "production") throw new Error("Abonelik mock servisi production'da kullanılamaz.");
    return createMockBillingService(env.scenario);
  }
  return null;
}

export function getBillingService(scenario?: string): BillingService | null {
  return selectBillingService({ nodeEnv: process.env.NODE_ENV, mockFlag: process.env.NEXT_PUBLIC_BILLING_MOCK, scenario });
}
