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

const PAYMENT_FAILED_EVENT = {
  event_id: "evt-failed-1",
  event_type: "PAYMENT_FAILED",
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
    fake.failNextUpdateWith(new Error("db unavailable"));
    const rawBody = JSON.stringify(PAYMENT_SUCCESS_EVENT);

    const res = await POST(webhookRequest(rawBody, VALID_SIGNATURE));

    expect(createServiceRoleClient).toHaveBeenCalled();
    expect(fake.update).toHaveBeenCalledTimes(2);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      received: true,
      subscription_id: "sub-1",
      status: "needs_review",
    });
  });

  it("AC-S1: abonelik zaten active ise koşullu update 0 satır etkiler, hiçbir alan değişmez", async () => {
    fake.tables.subscriptions = [
      { id: "sub-1", agent_id: "user-1", plan_id: PRO_PLAN_ID, status: "active", current_period_end: "2026-01-01T00:00:00.000Z" },
    ];
    const rawBody = JSON.stringify(PAYMENT_SUCCESS_EVENT);

    const res = await POST(webhookRequest(rawBody, VALID_SIGNATURE));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ received: true });
    expect(fake.tables.subscriptions[0]).toEqual({
      id: "sub-1",
      agent_id: "user-1",
      plan_id: PRO_PLAN_ID,
      status: "active",
      current_period_end: "2026-01-01T00:00:00.000Z",
    });
  });

  it("AC-3: abonelik failed iken success event'i gelirse needs_review'a çekilir", async () => {
    fake.tables.subscriptions = [
      { id: "sub-1", agent_id: "user-1", plan_id: PRO_PLAN_ID, status: "failed" },
    ];
    const rawBody = JSON.stringify(PAYMENT_SUCCESS_EVENT);

    const res = await POST(webhookRequest(rawBody, VALID_SIGNATURE));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ received: true });
    expect(fake.tables.subscriptions[0]).toMatchObject({ id: "sub-1", status: "needs_review" });
  });

  it("AC-S2: subscription_id DB'de hiç yoksa 200 received:true döner, hiçbir satır etkilenmez", async () => {
    const event = { ...PAYMENT_SUCCESS_EVENT, subscription_id: "sub-does-not-exist" };
    const rawBody = JSON.stringify(event);

    const res = await POST(webhookRequest(rawBody, VALID_SIGNATURE));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ received: true });
    expect(fake.tables.subscriptions).toEqual([
      { id: "sub-1", agent_id: "user-1", plan_id: PRO_PLAN_ID, status: "pending" },
    ]);
  });

  it("AC-5: ilk update hata verir ama needs_review update'i başarılı olursa 200 needs_review döner ve DB'ye de yazılır", async () => {
    fake.failNextUpdateWith(new Error("db unavailable"));
    const rawBody = JSON.stringify(PAYMENT_SUCCESS_EVENT);

    const res = await POST(webhookRequest(rawBody, VALID_SIGNATURE));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      received: true,
      subscription_id: "sub-1",
      status: "needs_review",
    });
    expect(fake.tables.subscriptions[0]).toMatchObject({ id: "sub-1", status: "needs_review" });
  });

  it("AC-5: hem ilk update hem needs_review update'i başarısız olursa 500 döner ve payment_events processing_error=true olur", async () => {
    fake.failNextUpdateWith(new Error("db unavailable")); // ilk koşullu update
    fake.failNextUpdateWith(new Error("db unavailable")); // needs_review update'i
    const rawBody = JSON.stringify(PAYMENT_SUCCESS_EVENT);

    const res = await POST(webhookRequest(rawBody, VALID_SIGNATURE));

    expect(res.status).toBe(500);
    const event = fake.tables.payment_events.find((row) => row.provider_event_id === "evt-1");
    expect(event).toMatchObject({ processing_error: true });
  });

  it("AC-6: bilinmeyen event_type için hiçbir update çağrılmaz, 200 received:true döner", async () => {
    const event = { ...PAYMENT_SUCCESS_EVENT, event_type: "SOME_UNKNOWN_TYPE" };
    const rawBody = JSON.stringify(event);

    const res = await POST(webhookRequest(rawBody, VALID_SIGNATURE));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ received: true });
    expect(fake.update).not.toHaveBeenCalled();
    expect(fake.tables.subscriptions[0]).toMatchObject({ status: "pending" });
  });

  it("AC-25: gövde geçersiz JSON ise 400 INVALID_INPUT döner, mesaj 'Geçersiz istek gövdesi' olur", async () => {
    const res = await POST(webhookRequest("{bozuk json,", VALID_SIGNATURE));

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "INVALID_INPUT", message: "Geçersiz istek gövdesi" });
    expect(fake.update).not.toHaveBeenCalled();
    expect(fake.insert).not.toHaveBeenCalled();
  });

  it("AC-25: gövde geçerli JSON ama zorunlu alan eksikse 400 INVALID_INPUT döner, mesaj 'Eksik olay alanı' olur (iki hata farklı mesajla ayrışır)", async () => {
    const res = await POST(
      webhookRequest(JSON.stringify({ event_id: "evt-1", event_type: "PAYMENT_SUCCESS" }), VALID_SIGNATURE),
    );

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "INVALID_INPUT", message: "Eksik olay alanı" });
    expect(fake.update).not.toHaveBeenCalled();
    expect(fake.insert).not.toHaveBeenCalled();
  });

  it("AC-5: pending aboneliğe PAYMENT_FAILED gelirse 200 received:true döner, status failed olur ve current_period_end hiç yazılmaz", async () => {
    const rawBody = JSON.stringify(PAYMENT_FAILED_EVENT);

    const res = await POST(webhookRequest(rawBody, VALID_SIGNATURE));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ received: true });

    const subscriptionUpdates = fake.update.mock.calls.filter(([table]) => table === "subscriptions");
    expect(subscriptionUpdates).toStrictEqual([["subscriptions", { status: "failed" }]]);
    expect(fake.tables.subscriptions[0]).toStrictEqual({
      id: "sub-1",
      agent_id: "user-1",
      plan_id: PRO_PLAN_ID,
      status: "failed",
    });
  });
});
