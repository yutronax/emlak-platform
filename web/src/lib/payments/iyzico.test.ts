import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createCheckoutSession, verifyWebhookSignature } from "./iyzico";

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
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.stubEnv("IYZICO_API_KEY", "test-api-key");
    vi.stubEnv("IYZICO_SECRET_KEY", "test-secret-key");
    vi.stubEnv("IYZICO_BASE_URL", "https://sandbox-api.example");

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

  const input = {
    amountMinor: 49900,
    currency: "TRY",
    basketId: PRO_PLAN_ID,
    conversationId: "agent-1",
    paymentGroup: "SUBSCRIPTION" as const,
  };

  function sentBody(): Record<string, unknown> {
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    return JSON.parse(String(init.body)) as Record<string, unknown>;
  }

  it("sağlayıcı API'sine tutar, para birimi, sepet ve grup bilgisiyle istek atar ve ödeme sayfası URL'sini döner", async () => {
    const result = await createCheckoutSession(input);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://sandbox-api.example/payment/iyzipos/checkoutform/initialize/auth/ecom");

    const body = sentBody();
    // Sağlayıcı API'si TL bekler: 49900 kuruş -> 499.00 TL.
    expect(Number(body.price)).toBe(499);
    expect(body.currency).toBe("TRY");
    expect(body.basketId).toBe(PRO_PLAN_ID);
    expect(body.conversationId).toBe("agent-1");
    expect(body.paymentGroup).toBe("SUBSCRIPTION");
    expect(body.locale).toBe("tr");

    expect(result.checkout_url).toBe(PROVIDER_PAYMENT_PAGE);
    expect(Date.parse(result.expires_at)).toBeGreaterThan(Date.now());
  });

  it("PRODUCT grubu ve kuruştan TL'ye küçük tutarı doğru gönderir", async () => {
    await createCheckoutSession({ ...input, amountMinor: 75050, paymentGroup: "PRODUCT", basketId: "order-1" });

    const body = sentBody();
    expect(body.price).toBe("750.50");
    expect(body.paymentGroup).toBe("PRODUCT");
    expect(body.basketId).toBe("order-1");
  });

  it("sağlayıcı HTTP hatası dönerse PAYMENT_PROVIDER_ERROR fırlatır", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    fetchMock.mockResolvedValueOnce(new Response("upstream", { status: 500 }));

    await expect(createCheckoutSession(input)).rejects.toThrow("PAYMENT_PROVIDER_ERROR");
    vi.mocked(console.error).mockRestore();
  });

  it("sağlayıcı status != success dönerse PAYMENT_PROVIDER_ERROR fırlatır", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ status: "failure" }), { status: 200 }),
    );

    await expect(createCheckoutSession(input)).rejects.toThrow("PAYMENT_PROVIDER_ERROR");
    vi.mocked(console.error).mockRestore();
  });
});
