import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { createFakeSupabase, type FakeSupabase } from "@/test/fake-supabase";
import { createCheckoutSession, verifyWebhookSignature } from "./iyzico";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
  createServiceRoleClient: vi.fn(),
}));

const WEBHOOK_SECRET = "test-webhook-secret";
const PROVIDER_PAYMENT_PAGE = "https://sandbox-payment.example/checkout/tok-1";

// plans.id uuid'dir (migration 0003).
const PRO_PLAN_ID = "11111111-1111-1111-1111-111111111111";

function hmacHex(secret: string, body: string): string {
  return createHmac("sha256", secret).update(body).digest("hex");
}

describe("verifyWebhookSignature", () => {
  beforeEach(() => {
    vi.stubEnv("IYZICO_WEBHOOK_SECRET", WEBHOOK_SECRET);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  const body = JSON.stringify({ event_id: "evt-1", event_type: "PAYMENT_SUCCESS", subscription_id: "sub-1" });

  it("doğru HMAC imzasıyla true döner", () => {
    const signature = hmacHex(WEBHOOK_SECRET, body);

    expect(verifyWebhookSignature(body, signature)).toBe(true);
  });

  it("yanlış secret ile üretilmiş imzayla false döner", () => {
    const signature = hmacHex("baska-bir-secret", body);

    expect(verifyWebhookSignature(body, signature)).toBe(false);
  });

  it("imza doğru olsa da body değiştirilmişse false döner", () => {
    const signature = hmacHex(WEBHOOK_SECRET, body);
    const tamperedBody = body.replace('"PAYMENT_SUCCESS"', '"PAYMENT_FAILED"');

    expect(verifyWebhookSignature(tamperedBody, signature)).toBe(false);
  });

  it.each([null, undefined, ""])("imza değeri %s iken false döner", (missing) => {
    expect(verifyWebhookSignature(body, missing as unknown as string)).toBe(false);
  });
});

describe("createCheckoutSession", () => {
  let fake: FakeSupabase;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.stubEnv("IYZICO_API_KEY", "test-api-key");
    vi.stubEnv("IYZICO_SECRET_KEY", "test-secret-key");
    vi.stubEnv("IYZICO_BASE_URL", "https://sandbox-api.example");

    // plans.price_minor_unit kuruş cinsinden: 499 TL = 49900 kuruş.
    fake = createFakeSupabase({
      user: { id: "user-1" },
      tables: {
        plans: [{ id: PRO_PLAN_ID, name: "Pro", price_minor_unit: 49900, currency: "TRY" }],
      },
    });
    vi.mocked(createClient).mockResolvedValue(fake.client);
    vi.mocked(createServiceRoleClient).mockReturnValue(fake.client);

    fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          status: "success",
          token: "tok-1",
          paymentPageUrl: PROVIDER_PAYMENT_PAGE,
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("sağlayıcı API'sine plan fiyatı ve para birimiyle istek atar ve ödeme sayfası URL'sini döner", async () => {
    const result = await createCheckoutSession(PRO_PLAN_ID, "agent-1");

    expect(fake.queries).toContainEqual(
      expect.objectContaining({ table: "plans", op: "select", filters: { id: PRO_PLAN_ID } }),
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const sentBody = JSON.parse(String(init.body)) as { price: unknown; currency: unknown };

    // Sağlayıcı API'si TL bekler: price_minor_unit (49900 kuruş) -> 499 TL dönüşümü
    // implementasyonda yapılır.
    expect(Number(sentBody.price)).toBe(499);
    expect(sentBody.currency).toBe("TRY");

    expect(result.checkout_url).toBe(PROVIDER_PAYMENT_PAGE);
  });
});
