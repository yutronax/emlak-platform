import { describe, expect, it } from "vitest";

import { createMockBillingService } from "./mock-service";
import { selectBillingService } from "./service";

describe("selectBillingService", () => {
  it("dev'de açık bayrakla mock", () => {
    expect(selectBillingService({ nodeEnv: "development", mockFlag: "1" })?.kind).toBe("mock");
  });

  it("production'da mock bayrağı hata fırlatır", () => {
    expect(() => selectBillingService({ nodeEnv: "production", mockFlag: "1" })).toThrow(/mock/i);
  });

  it("bayraksız null → mevcut gerçek sayfa kullanılır", () => {
    expect(selectBillingService({ nodeEnv: "development", mockFlag: undefined })).toBeNull();
  });
});

describe("mock senaryoları", () => {
  it.each(["active", "trialing", "past_due", "pending", "needs_review", "failed", "canceled", "none"] as const)(
    "%s senaryosu o durumla yüklenir",
    async (scenario) => {
      const res = await createMockBillingService(scenario, 0).load();
      expect(res.status).toBe("ok");
      if (res.status === "ok") expect(res.subscription.status).toBe(scenario);
    },
  );

  it("bilinmeyen senaryo active'e düşer", async () => {
    const res = await createMockBillingService("xyz", 0).load();
    expect(res.status === "ok" && res.subscription.status).toBe("active");
  });
});
