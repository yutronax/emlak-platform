import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createCheckoutSession } from "@/lib/payments/iyzico";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
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

const CHECKOUT_URL = "http://localhost/api/subscriptions/checkout";

// plans.id uuid'dir (migration 0003); planı ayırt etmek için name alanı kullanılır.
const PRO_PLAN_ID = "11111111-1111-1111-1111-111111111111";
const MISSING_PLAN_ID = "99999999-9999-9999-9999-999999999999";

// plans.price_minor_unit kuruş cinsinden integer'dır (499 TL = 49900 kuruş).
const PRO_PLAN = {
  id: PRO_PLAN_ID,
  name: "Pro",
  price_minor_unit: 49900,
  currency: "TRY",
};

const CHECKOUT_SESSION = {
  checkout_url: "https://sandbox-payment.example/checkout/tok-1",
  expires_at: "2026-10-17T12:00:00.000Z",
};

// Rate limit sayacı route modülünde tutulabileceği için her test kendi kullanıcısını kullanır.
let userSeq = 0;
let fake: FakeSupabase;
let userId: string;

function checkoutRequest(body: unknown): NextRequest {
  return new NextRequest(CHECKOUT_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();

  userSeq += 1;
  userId = `user-${userSeq}`;

  fake = createFakeSupabase({
    user: { id: userId },
    tables: {
      plans: [PRO_PLAN],
      subscriptions: [],
    },
  });

  // Okuma/oturum için normal kullanıcı client'ı; yazma için service-role client.
  // İkisi de aynı sahte nesneyi döner, ama yazmaların service-role üzerinden
  // yapıldığı createServiceRoleClient spy'ıyla ayrıca doğrulanır.
  vi.mocked(createClient).mockResolvedValue(fake.client);
  vi.mocked(createServiceRoleClient).mockReturnValue(fake.client);
  vi.mocked(createCheckoutSession).mockResolvedValue(CHECKOUT_SESSION);
});

describe("POST /api/subscriptions/checkout", () => {
  it("geçerli plan_id ile 201 döner ve body tam olarak beklenen alanları taşır", async () => {
    const res = await POST(checkoutRequest({ plan_id: PRO_PLAN_ID }));

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body).toEqual({
      subscription_id: expect.any(String),
      status: "pending",
      checkout_url: CHECKOUT_SESSION.checkout_url,
      expires_at: CHECKOUT_SESSION.expires_at,
    });

    // Yazma service-role client üzerinden yapılmalı (normal kullanıcıya INSERT policy'si yok).
    expect(createServiceRoleClient).toHaveBeenCalled();
    expect(fake.insert).toHaveBeenCalledWith(
      "subscriptions",
      expect.objectContaining({
        agent_id: userId,
        plan_id: PRO_PLAN_ID,
        status: "pending",
      }),
    );

    expect(fake.tables.subscriptions).toHaveLength(1);
    expect(fake.tables.subscriptions[0]).toMatchObject({ status: "pending" });
    expect(body.subscription_id).toBe(fake.tables.subscriptions[0].id);
    expect(createCheckoutSession).toHaveBeenCalledTimes(1);
  });

  it.each([
    { label: "plan_id alanı hiç yok", body: {} },
    { label: "plan_id boş string", body: { plan_id: "" } },
  ])("$label ise 400 INVALID_INPUT döner ve hiçbir kayıt oluşturulmaz", async ({ body }) => {
    const res = await POST(checkoutRequest(body));

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      error: "INVALID_INPUT",
      message: "plan_id zorunludur",
      field: "plan_id",
    });
    expect(fake.insert).not.toHaveBeenCalled();
    expect(createCheckoutSession).not.toHaveBeenCalled();
  });

  it("var olmayan plan_id ile 404 PLAN_NOT_FOUND döner", async () => {
    const res = await POST(checkoutRequest({ plan_id: MISSING_PLAN_ID }));

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({
      error: "PLAN_NOT_FOUND",
      message: "Seçilen plan bulunamadı",
    });
    expect(fake.insert).not.toHaveBeenCalled();
    expect(createCheckoutSession).not.toHaveBeenCalled();
  });

  it("oturumsuz istekte 401 UNAUTHORIZED döner", async () => {
    fake.setUser(null);

    const res = await POST(checkoutRequest({ plan_id: PRO_PLAN_ID }));

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "UNAUTHORIZED" });
    expect(fake.insert).not.toHaveBeenCalled();
    expect(createCheckoutSession).not.toHaveBeenCalled();
  });

  it("kullanıcının zaten aktif aboneliği varsa 409 ALREADY_SUBSCRIBED döner", async () => {
    fake.tables.subscriptions.push({
      id: "sub-active",
      agent_id: userId,
      plan_id: PRO_PLAN_ID,
      status: "active",
    });

    const res = await POST(checkoutRequest({ plan_id: PRO_PLAN_ID }));

    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({
      error: "ALREADY_SUBSCRIBED",
      current_plan: PRO_PLAN_ID,
    });
    expect(fake.insert).not.toHaveBeenCalled();
    expect(createCheckoutSession).not.toHaveBeenCalled();
  });

  it("AC-S1: istek body'sindeki price alanı yok sayılır, fiyat sunucudaki plan kaydından alınır", async () => {
    const res = await POST(checkoutRequest({ plan_id: PRO_PLAN_ID, price: 1 }));

    expect(res.status).toBe(201);

    // Plan kaydı sunucu tarafında, plan_id ile sorgulanmış olmalı.
    expect(fake.queries).toContainEqual(
      expect.objectContaining({
        table: "plans",
        op: "select",
        filters: { id: PRO_PLAN_ID },
      }),
    );

    // Checkout oluşturma çağrısına yalnızca plan_id ve agentId gider; istekteki price hiç geçmez.
    expect(createCheckoutSession).toHaveBeenCalledTimes(1);
    expect(createCheckoutSession).toHaveBeenCalledWith(PRO_PLAN_ID, expect.any(String));
    const passedArgs = vi.mocked(createCheckoutSession).mock.calls[0];
    expect(passedArgs).not.toContain(1);
  });

  it("AC-S4: aynı kullanıcıdan 10 saniye içinde 10'dan fazla istekte en az biri 429 döner", async () => {
    const statuses: number[] = [];

    for (let i = 0; i < 11; i += 1) {
      const res = await POST(checkoutRequest({ plan_id: PRO_PLAN_ID }));
      statuses.push(res.status);
    }

    expect(statuses[0]).toBe(201);
    expect(statuses).toContain(429);
  });

  it("AC-1: plan_id hiç gönderilmezse 400 INVALID_INPUT döner, DB yazması ve sağlayıcı çağrısı yapılmaz", async () => {
    const res = await POST(checkoutRequest({}));

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      error: "INVALID_INPUT",
      message: "plan_id zorunludur",
      field: "plan_id",
    });
    expect(fake.insert).not.toHaveBeenCalled();
    expect(fake.update).not.toHaveBeenCalled();
    expect(createCheckoutSession).not.toHaveBeenCalled();
  });

  it("AC-2: sağlayıcı TimeoutError fırlatırsa 504 PAYMENT_TIMEOUT döner ve subscription pending kalır", async () => {
    vi.mocked(createCheckoutSession).mockRejectedValue(
      Object.assign(new Error("timeout"), { name: "TimeoutError" }),
    );

    const res = await POST(checkoutRequest({ plan_id: PRO_PLAN_ID }));

    expect(res.status).toBe(504);
    expect(await res.json()).toEqual({
      error: "PAYMENT_TIMEOUT",
      subscription_id: fake.tables.subscriptions[0].id,
      status: "pending",
    });
    expect(fake.tables.subscriptions).toHaveLength(1);
    expect(fake.tables.subscriptions[0]).toStrictEqual({
      id: fake.tables.subscriptions[0].id,
      agent_id: userId,
      plan_id: PRO_PLAN_ID,
      status: "pending",
    });
    expect(fake.update).not.toHaveBeenCalled();
  });

  it("AC-3: sağlayıcı TimeoutError dışında hata fırlatırsa 502 PAYMENT_PROVIDER_ERROR döner ve subscription failed olur", async () => {
    vi.mocked(createCheckoutSession).mockRejectedValue(new Error("provider down"));

    const res = await POST(checkoutRequest({ plan_id: PRO_PLAN_ID }));

    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: "PAYMENT_PROVIDER_ERROR", retryable: true });

    expect(fake.update).toHaveBeenCalledTimes(1);
    expect(fake.update).toHaveBeenCalledWith("subscriptions", { status: "failed" });
    expect(fake.tables.subscriptions[0]).toStrictEqual({
      id: fake.tables.subscriptions[0].id,
      agent_id: userId,
      plan_id: PRO_PLAN_ID,
      status: "failed",
    });
  });

  it("AC-4: insert 23505 unique-violation dönerse 409 ALREADY_SUBSCRIBED döner (current_plan alanı yok)", async () => {
    // Mevcut 'cancelled' satır aktif-abonelik kontrolünü geçer (createClient tarafı fake'ten okunur).
    fake = createFakeSupabase({
      user: { id: userId },
      tables: {
        plans: [PRO_PLAN],
        subscriptions: [{ agent_id: userId, plan_id: PRO_PLAN_ID, status: "cancelled" }],
      },
    });
    vi.mocked(createClient).mockResolvedValue(fake.client);

    // fake-supabase'in insert+select+single zinciri 23505'i PGRST116 ile ezdiği için
    // (single() duplicate dalından sonra null-dalını çalıştırır), service-role insert zinciri
    // burada doğrudan 23505 döndürecek şekilde stublanır.
    const insertSpy = vi.fn(() => ({
      select: () => ({
        single: async () => ({
          data: null,
          error: { code: "23505", message: "duplicate key value violates unique constraint" },
        }),
      }),
    }));
    vi.mocked(createServiceRoleClient).mockReturnValue({
      from: vi.fn(() => ({ insert: insertSpy })),
    } as unknown as ReturnType<typeof createServiceRoleClient>);

    const res = await POST(checkoutRequest({ plan_id: PRO_PLAN_ID }));

    expect(res.status).toBe(409);
    expect(await res.json()).toStrictEqual({ error: "ALREADY_SUBSCRIBED" });
    expect(insertSpy).toHaveBeenCalledTimes(1);
    expect(insertSpy).toHaveBeenCalledWith({ agent_id: userId, plan_id: PRO_PLAN_ID, status: "pending" });
    expect(createCheckoutSession).not.toHaveBeenCalled();
  });
});
