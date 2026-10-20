import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { verifyWebhookSignature } from "@/lib/payments/iyzico";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { createFakeSupabase, type FakeSupabase } from "@/test/fake-supabase";
import { POST } from "./route";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
  createServiceRoleClient: vi.fn(),
}));

// İmza doğruluğunun HMAC hesabı iyzico.test.ts içinde gerçek olarak test edilir.
// Burada route'un doğrulama sonucuna nasıl tepki verdiği test edilir.
vi.mock("@/lib/payments/iyzico", () => ({
  createCheckoutSession: vi.fn(),
  verifyWebhookSignature: vi.fn(),
}));

const WEBHOOK_URL = "http://localhost/api/webhooks/payment";
const SIGNATURE_HEADER = "x-iyzico-signature";
const VALID_SIGNATURE = "valid-signature";

// plans.id uuid'dir (migration 0003).
const PRO_PLAN_ID = "11111111-1111-1111-1111-111111111111";

const PAYMENT_SUCCESS_EVENT = {
  event_id: "evt-1",
  event_type: "PAYMENT_SUCCESS",
  subscription_id: "sub-1",
};

let fake: FakeSupabase;

function webhookRequest(rawBody: string, signature?: string): NextRequest {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (signature !== undefined) {
    headers[SIGNATURE_HEADER] = signature;
  }
  return new NextRequest(WEBHOOK_URL, {
    method: "POST",
    headers,
    body: rawBody,
  });
}

beforeEach(() => {
  vi.clearAllMocks();

  // subscriptions.agent_id (agents.id'ye FK), payment_events.provider_event_id unique.
  fake = createFakeSupabase({
    user: null,
    tables: {
      subscriptions: [{ id: "sub-1", agent_id: "user-1", plan_id: PRO_PLAN_ID, status: "pending" }],
      payment_events: [],
    },
    uniqueColumns: { payment_events: "provider_event_id" },
  });

  // Webhook yazmaları service-role client ile yapılır (RLS: normal kullanıcıya yazma yok).
  vi.mocked(createClient).mockResolvedValue(fake.client);
  vi.mocked(createServiceRoleClient).mockReturnValue(fake.client);
  vi.mocked(verifyWebhookSignature).mockImplementation(
    (_rawBody, signatureHeader) => signatureHeader === VALID_SIGNATURE,
  );
});

describe("POST /api/webhooks/payment", () => {
  it("geçerli imzalı ödeme başarılı event'inde 200 döner ve abonelik active yapılır", async () => {
    const rawBody = JSON.stringify(PAYMENT_SUCCESS_EVENT);

    const res = await POST(webhookRequest(rawBody, VALID_SIGNATURE));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ received: true });

    expect(verifyWebhookSignature).toHaveBeenCalledWith(rawBody, VALID_SIGNATURE);
    expect(createServiceRoleClient).toHaveBeenCalled();
    expect(fake.update).toHaveBeenCalled();
    expect(fake.update).toHaveBeenCalledWith(
      "subscriptions",
      expect.objectContaining({ status: "active" }),
    );
    expect(fake.tables.subscriptions[0]).toMatchObject({ id: "sub-1", status: "active" });
  });

  it.each([
    { label: "yanlış imza", signature: "wrong-signature" },
    { label: "imza header'ı eksik", signature: undefined },
  ])("AC-S3: $label ile 401 INVALID_SIGNATURE döner ve DB update hiç çağrılmaz", async ({ signature }) => {
    const rawBody = JSON.stringify(PAYMENT_SUCCESS_EVENT);

    const res = await POST(webhookRequest(rawBody, signature));

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "INVALID_SIGNATURE" });

    expect(fake.update).not.toHaveBeenCalled();
    expect(fake.tables.subscriptions[0]).toMatchObject({ status: "pending" });
    expect(fake.tables.payment_events).toEqual([]);
  });

  it("aynı event_id ikinci kez gelirse 200 duplicate döner ve DB update tekrar çağrılmaz", async () => {
    const rawBody = JSON.stringify(PAYMENT_SUCCESS_EVENT);

    const first = await POST(webhookRequest(rawBody, VALID_SIGNATURE));
    expect(first.status).toBe(200);
    expect(await first.json()).toEqual({ received: true });
    expect(fake.update).toHaveBeenCalledTimes(1);

    const second = await POST(webhookRequest(rawBody, VALID_SIGNATURE));

    expect(second.status).toBe(200);
    expect(await second.json()).toEqual({
      received: true,
      duplicate: true,
      event_id: "evt-1",
    });
    expect(fake.update).toHaveBeenCalledTimes(1);
  });

  it("imza geçerli ama DB update hata verirse 200 needs_review döner", async () => {
    fake.failUpdatesWith(new Error("db unavailable"));
    const rawBody = JSON.stringify(PAYMENT_SUCCESS_EVENT);

    const res = await POST(webhookRequest(rawBody, VALID_SIGNATURE));

    expect(createServiceRoleClient).toHaveBeenCalled();
    expect(fake.update).toHaveBeenCalledTimes(1);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      received: true,
      subscription_id: "sub-1",
      status: "needs_review",
    });
  });
});
