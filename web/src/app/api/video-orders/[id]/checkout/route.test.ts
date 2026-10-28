import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createCheckoutSession } from "@/lib/payments/iyzico";
import { createClient } from "@/lib/supabase/server";
import { createFakeSupabase, type FakeSupabase } from "@/test/fake-supabase";
import { POST } from "./route";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
  createServiceRoleClient: vi.fn(),
}));

vi.mock("@/lib/payments/iyzico", () => ({
  createCheckoutSession: vi.fn(),
  verifyWebhookSignature: vi.fn(),
}));

const ORDER_ID = "22222222-2222-2222-2222-222222222222";
const OTHER_ORDER_ID = "33333333-3333-3333-3333-333333333333";
const MISSING_ORDER_ID = "44444444-4444-4444-4444-444444444444";
const CHECKOUT_SESSION = {
  checkout_url: "https://sandbox-payment.example/checkout/tok-video",
  expires_at: "2026-10-28T12:00:00.000Z",
};

// Rate limit sayacı modül seviyesinde tutulduğu için her test kendi kullanıcısını kullanır.
let userSeq = 0;
let fake: FakeSupabase;
let userId: string;

function checkoutRequest(body?: unknown): NextRequest {
  return new NextRequest("http://localhost/api/video-orders/x/checkout", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

function call(id: string, body?: unknown) {
  return POST(checkoutRequest(body), { params: Promise.resolve({ id }) });
}

function orderRow(overrides: Record<string, unknown> = {}) {
  return {
    id: ORDER_ID,
    agent_id: userId,
    status: "awaiting_payment",
    price_minor_unit: 75000,
    currency: "TRY",
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();

  userSeq += 1;
  userId = `agent-${userSeq}`;

  fake = createFakeSupabase({
    user: { id: userId },
    tables: {
      video_orders: [orderRow()],
    },
  });

  vi.mocked(createClient).mockResolvedValue(fake.client);
  vi.mocked(createCheckoutSession).mockResolvedValue(CHECKOUT_SESSION);
});

describe("POST /api/video-orders/[id]/checkout", () => {
  it("awaiting_payment siparişte 201 döner ve sağlayıcıya DB fiyatı, sipariş id'si sepet olarak gider", async () => {
    const res = await call(ORDER_ID);

    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({
      order_id: ORDER_ID,
      checkout_url: CHECKOUT_SESSION.checkout_url,
      expires_at: CHECKOUT_SESSION.expires_at,
    });
    expect(createCheckoutSession).toHaveBeenCalledTimes(1);
    expect(createCheckoutSession).toHaveBeenCalledWith({
      amountMinor: 75000,
      currency: "TRY",
      basketId: ORDER_ID,
      conversationId: userId,
      paymentGroup: "PRODUCT",
    });
    expect(fake.update).not.toHaveBeenCalled();
    expect(fake.tables.video_orders[0]).toMatchObject({ status: "awaiting_payment" });
  });

  it("payment_failed siparişte de 201 döner, durum değiştirilmez", async () => {
    fake.tables.video_orders = [orderRow({ status: "payment_failed" })];

    const res = await call(ORDER_ID);

    expect(res.status).toBe(201);
    expect(createCheckoutSession).toHaveBeenCalledWith(
      expect.objectContaining({ paymentGroup: "PRODUCT", basketId: ORDER_ID, amountMinor: 75000 }),
    );
    expect(fake.update).not.toHaveBeenCalled();
    expect(fake.tables.video_orders[0]).toMatchObject({ status: "payment_failed" });
  });

  it("oturumsuz istekte 401 UNAUTHORIZED döner", async () => {
    fake.setUser(null);

    const res = await call(ORDER_ID);

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "UNAUTHORIZED" });
    expect(createCheckoutSession).not.toHaveBeenCalled();
  });

  it("AC-S1: başka emlakçının siparişi 404 NOT_FOUND döner, varlığı sızdırılmaz", async () => {
    fake.tables.video_orders = [orderRow({ id: OTHER_ORDER_ID, agent_id: "agent-someone-else" })];

    const res = await call(OTHER_ORDER_ID);

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "NOT_FOUND", message: "Sipariş bulunamadı" });
    expect(createCheckoutSession).not.toHaveBeenCalled();
    expect(fake.update).not.toHaveBeenCalled();
  });

  it("var olmayan sipariş id'si 404 NOT_FOUND döner", async () => {
    const res = await call(MISSING_ORDER_ID);

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "NOT_FOUND", message: "Sipariş bulunamadı" });
    expect(createCheckoutSession).not.toHaveBeenCalled();
  });

  it("UUID olmayan id 404 NOT_FOUND döner ve sorgu yapılmaz", async () => {
    const res = await call("not-a-uuid");

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "NOT_FOUND", message: "Sipariş bulunamadı" });
    expect(fake.queries).toEqual([]);
    expect(createCheckoutSession).not.toHaveBeenCalled();
  });

  it("quote_pending siparişte 409 QUOTE_PENDING döner", async () => {
    fake.tables.video_orders = [orderRow({ status: "quote_pending", price_minor_unit: null })];

    const res = await call(ORDER_ID);

    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "QUOTE_PENDING", message: "Fiyat teklifi bekleniyor" });
    expect(createCheckoutSession).not.toHaveBeenCalled();
  });

  it.each(["draft", "in_progress", "delivered", "canceled"])(
    "%s durumundaki siparişte 409 INVALID_STATE döner",
    async (status) => {
      fake.tables.video_orders = [orderRow({ status })];

      const res = await call(ORDER_ID);

      expect(res.status).toBe(409);
      expect(await res.json()).toEqual({ error: "INVALID_STATE", message: "Sipariş bu durumda ödenemez" });
      expect(createCheckoutSession).not.toHaveBeenCalled();
      expect(fake.update).not.toHaveBeenCalled();
    },
  );

  it("fiyatı null olan ödenebilir siparişte 409 INVALID_STATE döner", async () => {
    fake.tables.video_orders = [orderRow({ price_minor_unit: null })];

    const res = await call(ORDER_ID);

    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "INVALID_STATE", message: "Sipariş bu durumda ödenemez" });
    expect(createCheckoutSession).not.toHaveBeenCalled();
  });

  it("AC-S2: gövdede price gönderilse de sağlayıcıya yalnızca DB fiyatı geçer", async () => {
    const res = await call(ORDER_ID, { price_minor_unit: 1, price: 1, amountMinor: 1 });

    expect(res.status).toBe(201);
    expect(createCheckoutSession).toHaveBeenCalledWith(expect.objectContaining({ amountMinor: 75000 }));
    const [input] = vi.mocked(createCheckoutSession).mock.calls[0];
    expect(input.amountMinor).not.toBe(1);
  });

  it("sağlayıcı TimeoutError fırlatırsa 504 PAYMENT_TIMEOUT döner ve sipariş durumu değişmez", async () => {
    vi.mocked(createCheckoutSession).mockRejectedValue(
      Object.assign(new Error("timeout"), { name: "TimeoutError" }),
    );

    const res = await call(ORDER_ID);

    expect(res.status).toBe(504);
    expect(await res.json()).toEqual({
      error: "PAYMENT_TIMEOUT",
      order_id: ORDER_ID,
      status: "awaiting_payment",
    });
    expect(fake.update).not.toHaveBeenCalled();
    expect(fake.tables.video_orders[0]).toMatchObject({ status: "awaiting_payment" });
  });

  it("sağlayıcı zaman aşımı dışında hata verirse 502 PAYMENT_PROVIDER_ERROR retryable döner ve sipariş durumu değişmez", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(createCheckoutSession).mockRejectedValue(new Error("PAYMENT_PROVIDER_ERROR"));

    const res = await call(ORDER_ID);

    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: "PAYMENT_PROVIDER_ERROR", retryable: true });
    expect(fake.update).not.toHaveBeenCalled();
    expect(fake.tables.video_orders[0]).toMatchObject({ status: "awaiting_payment" });
    vi.mocked(console.error).mockRestore();
  });

  it("AC-S4: aynı kullanıcıdan 10 saniye içinde 10'dan fazla istekte en az biri 429 döner", async () => {
    const statuses: number[] = [];

    for (let i = 0; i < 11; i += 1) {
      const res = await call(ORDER_ID);
      statuses.push(res.status);
    }

    expect(statuses[0]).toBe(201);
    expect(statuses).toContain(429);
    expect(statuses.filter((status) => status === 429)).toHaveLength(1);
  });
});
