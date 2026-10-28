import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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

// Cuma 2026-10-30 10:00 (TR). 2 iş günü: Pazartesi yok sayılmaz, Cmt/Paz atlanır → Salı 2026-11-03 10:00 TR.
const VIDEO_ORDER_ID = "22222222-2222-2222-2222-222222222222";
const PAID_AT_UTC = "2026-10-30T07:00:00.000Z";
const DUE_AT_UTC = "2026-11-03T07:00:00.000Z";

const VIDEO_SUCCESS_EVENT = {
  event_id: "evt-video-1",
  event_type: "PAYMENT_SUCCESS",
  video_order_id: VIDEO_ORDER_ID,
};

const VIDEO_FAILED_EVENT = {
  event_id: "evt-video-failed-1",
  event_type: "PAYMENT_FAILED",
  video_order_id: VIDEO_ORDER_ID,
};

function videoOrder(status: string) {
  return {
    id: VIDEO_ORDER_ID,
    agent_id: "user-1",
    status,
    price_minor_unit: 75000,
    currency: "TRY",
    paid_at: null,
    due_at: null,
  };
}

describe("POST /api/webhooks/payment: video sipariş olayları", () => {
  beforeEach(() => {
    fake.tables.video_orders = [videoOrder("awaiting_payment")];
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("AC-S5: imza yanlışsa 401 döner ve payment_events ile video_orders'a dokunulmaz", async () => {
    const rawBody = JSON.stringify(VIDEO_SUCCESS_EVENT);

    const res = await POST(webhookRequest(rawBody, "wrong-signature"));

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "INVALID_SIGNATURE" });
    expect(fake.insert).not.toHaveBeenCalled();
    expect(fake.update).not.toHaveBeenCalled();
    expect(fake.tables.video_orders[0]).toMatchObject({ status: "awaiting_payment", paid_at: null });
  });

  it.each([
    {
      label: "subscription_id ve video_order_id birlikte",
      body: { event_id: "evt-both-1", event_type: "PAYMENT_SUCCESS", subscription_id: "sub-1", video_order_id: VIDEO_ORDER_ID },
    },
    {
      label: "ikisi de yok",
      body: { event_id: "evt-none-1", event_type: "PAYMENT_SUCCESS" },
    },
  ])("$label ise 400 INVALID_INPUT 'Eksik olay alanı' döner, DB'ye dokunulmaz", async ({ body }) => {
    const res = await POST(webhookRequest(JSON.stringify(body), VALID_SIGNATURE));

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "INVALID_INPUT", message: "Eksik olay alanı" });
    expect(fake.insert).not.toHaveBeenCalled();
    expect(fake.update).not.toHaveBeenCalled();
  });

  it("payment_events kaydı video_order_id ile yazılır ve subscription_id taşınmaz", async () => {
    await POST(webhookRequest(JSON.stringify(VIDEO_FAILED_EVENT), VALID_SIGNATURE));

    expect(fake.insert).toHaveBeenCalledWith(
      "payment_events",
      expect.objectContaining({ provider_event_id: "evt-video-failed-1", video_order_id: VIDEO_ORDER_ID }),
    );
    const [, row] = fake.insert.mock.calls[0] as unknown as [string, Record<string, unknown>];
    expect(row).not.toHaveProperty("subscription_id");
  });

  it("AC-11: awaiting_payment siparişte PAYMENT_SUCCESS → in_progress, paid_at ve iş günü hesaplı due_at yazılır (Cuma → Salı)", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(PAID_AT_UTC));

    const res = await POST(webhookRequest(JSON.stringify(VIDEO_SUCCESS_EVENT), VALID_SIGNATURE));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ received: true });
    expect(fake.tables.video_orders[0]).toMatchObject({
      status: "in_progress",
      paid_at: PAID_AT_UTC,
      due_at: DUE_AT_UTC,
    });
    expect(fake.update).toHaveBeenCalledWith("video_orders", expect.objectContaining({ status: "in_progress" }));
  });

  it("AC-11: payment_failed siparişte PAYMENT_SUCCESS → in_progress olur", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(PAID_AT_UTC));
    fake.tables.video_orders = [videoOrder("payment_failed")];

    const res = await POST(webhookRequest(JSON.stringify(VIDEO_SUCCESS_EVENT), VALID_SIGNATURE));

    expect(res.status).toBe(200);
    expect(fake.tables.video_orders[0]).toMatchObject({ status: "in_progress", due_at: DUE_AT_UTC });
  });

  it("AC-11: awaiting_payment siparişte PAYMENT_FAILED → payment_failed olur, paid_at yazılmaz", async () => {
    const res = await POST(webhookRequest(JSON.stringify(VIDEO_FAILED_EVENT), VALID_SIGNATURE));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ received: true });
    expect(fake.update).toHaveBeenCalledWith("video_orders", { status: "payment_failed" });
    expect(fake.tables.video_orders[0]).toMatchObject({ status: "payment_failed", paid_at: null, due_at: null });
  });

  it("AC-S5: aynı video olayı ikinci kez gelirse duplicate döner ve update tekrar çağrılmaz", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(PAID_AT_UTC));
    const rawBody = JSON.stringify(VIDEO_SUCCESS_EVENT);

    await POST(webhookRequest(rawBody, VALID_SIGNATURE));
    const second = await POST(webhookRequest(rawBody, VALID_SIGNATURE));

    expect(second.status).toBe(200);
    expect(await second.json()).toEqual({ received: true, duplicate: true, event_id: "evt-video-1" });
    expect(fake.update).toHaveBeenCalledTimes(1);
  });

  it("AC-S5: sipariş delivered iken PAYMENT_SUCCESS gelirse state değişmez, olay olası çift tahsilat olarak işaretlenir", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    fake.tables.video_orders = [videoOrder("delivered")];

    const res = await POST(webhookRequest(JSON.stringify(VIDEO_SUCCESS_EVENT), VALID_SIGNATURE));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ received: true });
    expect(fake.tables.video_orders[0]).toMatchObject({ status: "delivered", paid_at: null, due_at: null });
    expect(fake.tables.payment_events[0]).toMatchObject({ processing_error: true });
    expect(error).toHaveBeenCalled();
  });

  it("ödenmiş siparişe farklı event_id ile ikinci PAYMENT_SUCCESS gelirse durum değişmez ve ikinci olay işaretlenir", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});

    await POST(webhookRequest(JSON.stringify(VIDEO_SUCCESS_EVENT), VALID_SIGNATURE));
    const firstPaidAt = fake.tables.video_orders[0].paid_at;
    const second = { ...VIDEO_SUCCESS_EVENT, event_id: "evt-video-second-charge" };
    const res = await POST(webhookRequest(JSON.stringify(second), VALID_SIGNATURE));

    expect(res.status).toBe(200);
    expect(fake.tables.video_orders[0]).toMatchObject({ status: "in_progress", paid_at: firstPaidAt });
    const flagged = fake.tables.payment_events.filter((row) => row.processing_error === true);
    expect(flagged).toHaveLength(1);
    expect(flagged[0]).toMatchObject({ provider_event_id: "evt-video-second-charge" });
  });

  it("video_order_id uuid değilse DB'ye dokunmadan 400 döner (sağlayıcı sonsuz tekrar etmesin)", async () => {
    const res = await POST(
      webhookRequest(JSON.stringify({ ...VIDEO_SUCCESS_EVENT, video_order_id: "not-a-uuid" }), VALID_SIGNATURE),
    );

    expect(res.status).toBe(400);
    expect(fake.tables.payment_events).toEqual([]);
  });

  it("AC-S5: sipariş yoksa 200 döner ve hiçbir satır etkilenmez", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    fake.tables.video_orders = [];

    const res = await POST(webhookRequest(JSON.stringify(VIDEO_SUCCESS_EVENT), VALID_SIGNATURE));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ received: true });
    expect(fake.tables.video_orders).toEqual([]);
    expect(warn).toHaveBeenCalled();
  });

  it("AC-S5: gerçek DB'de olay kaydı FK ihlali (23503) verirse 500 değil 200 döner, sağlayıcı tekrar denemez", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const realFrom = fake.client.from.bind(fake.client);
    vi.spyOn(fake.client, "from").mockImplementation(((table: string) => {
      if (table !== "payment_events") return realFrom(table);
      return {
        insert: () => ({
          select: async () => ({ data: null, error: { code: "23503", message: "violates foreign key constraint" } }),
        }),
      };
    }) as typeof fake.client.from);

    const res = await POST(webhookRequest(JSON.stringify(VIDEO_SUCCESS_EVENT), VALID_SIGNATURE));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ received: true });
    expect(warn).toHaveBeenCalled();
  });

  it("DB update hata verirse 500 INTERNAL_ERROR döner ve payment_events processing_error=true olur (needs_review yok)", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    fake.failNextUpdateWith(new Error("db unavailable"));

    const res = await POST(webhookRequest(JSON.stringify(VIDEO_SUCCESS_EVENT), VALID_SIGNATURE));

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "INTERNAL_ERROR" });
    expect(fake.tables.video_orders[0]).toMatchObject({ status: "awaiting_payment" });
    const event = fake.tables.payment_events.find((row) => row.provider_event_id === "evt-video-1");
    expect(event).toMatchObject({ processing_error: true });
    expect(fake.update).not.toHaveBeenCalledWith("video_orders", expect.objectContaining({ status: "needs_review" }));
  });

  it("bilinmeyen event_type için video siparişi güncellenmez, 200 received:true döner", async () => {
    const event = { ...VIDEO_SUCCESS_EVENT, event_type: "SOME_UNKNOWN_TYPE" };

    const res = await POST(webhookRequest(JSON.stringify(event), VALID_SIGNATURE));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ received: true });
    expect(fake.update).not.toHaveBeenCalled();
    expect(fake.tables.video_orders[0]).toMatchObject({ status: "awaiting_payment" });
  });
});
