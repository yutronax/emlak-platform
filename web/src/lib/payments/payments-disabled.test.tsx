// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { BuyButton } from "@/app/(marketing)/pricing/buy-button";
import { PayButton } from "@/app/agent/videos/[id]/pay-button";
import { POST as subscriptionCheckout } from "@/app/api/subscriptions/checkout/route";
import { POST as videoCheckout } from "@/app/api/video-orders/[id]/checkout/route";
import { createClient } from "@/lib/supabase/server";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn(), createServiceRoleClient: vi.fn() }));

// Kartla ödeme kapalıyken (şirket kurulana kadar) hiçbir uç sağlayıcıya gitmez; arayüz WhatsApp'a yönlendirir.
describe("ödeme kapalı", () => {
  beforeEach(() => vi.stubEnv("NEXT_PUBLIC_PAYMENTS_ENABLED", "0"));
  afterEach(() => {
    vi.unstubAllEnvs();
    cleanup();
  });

  it("checkout uçları 503 PAYMENTS_DISABLED döner, oturuma bile bakmaz", async () => {
    const req = new Request("http://x", { method: "POST", body: "{}" });
    const sub = await subscriptionCheckout(req as never);
    const vid = await videoCheckout(req as never, { params: Promise.resolve({ id: "x" }) });
    expect(sub.status).toBe(503);
    expect(vid.status).toBe(503);
    expect(await sub.json()).toEqual({ error: "PAYMENTS_DISABLED" });
    expect(createClient).not.toHaveBeenCalled();
  });

  it("abone ol ve öde düğmeleri WhatsApp bağlantısına döner", () => {
    render(<BuyButton planId="p1" label="Pro" />);
    expect(screen.getByRole("link", { name: /WhatsApp'tan abone ol/ })).toHaveAttribute(
      "href",
      expect.stringContaining("https://wa.me/"),
    );
    render(<PayButton orderId="o1" amountLabel="1.500 ₺" />);
    expect(screen.getByRole("link", { name: /Ödeme için WhatsApp'tan yazın/ })).toBeInTheDocument();
    expect(screen.queryByRole("button")).toBeNull();
  });
});
