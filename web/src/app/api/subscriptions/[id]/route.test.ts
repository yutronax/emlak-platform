import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createClient } from "@/lib/supabase/server";
import { createFakeSupabase, type FakeSupabase } from "@/test/fake-supabase";
import { GET } from "./route";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
  createServiceRoleClient: vi.fn(),
}));

const AGENT_A = "agent-a";
const AGENT_B = "agent-b";

const PRO_PLAN_ID = "11111111-1111-1111-1111-111111111111";
const MISSING_SUB_ID = "99999999-9999-9999-9999-999999999999";

const SUB_A_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const SUB_B_ID = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";

const SUB_A = {
  id: SUB_A_ID,
  agent_id: AGENT_A,
  plan_id: PRO_PLAN_ID,
  status: "active",
  current_period_end: "2026-11-17T00:00:00.000Z",
};

// B'ye ait kayıt; provider_subscription_id gibi alanlar A'ya asla dönmemeli.
const SUB_B = {
  id: SUB_B_ID,
  agent_id: AGENT_B,
  plan_id: PRO_PLAN_ID,
  status: "active",
  current_period_end: "2026-12-01T00:00:00.000Z",
  provider_subscription_id: "iyz-secret-b-123",
};

// Var olmayan veya yetkisiz kaynak için tek ve ortak hata gövdesi.
const NOT_FOUND_BODY = { error: "NOT_FOUND" };

let fake: FakeSupabase;

function getRequest(id: string): NextRequest {
  return new NextRequest(`http://localhost/api/subscriptions/${id}`, { method: "GET" });
}

function callGet(id: string) {
  return GET(getRequest(id), { params: Promise.resolve({ id }) });
}

beforeEach(() => {
  vi.clearAllMocks();

  fake = createFakeSupabase({
    user: { id: AGENT_A },
    tables: {
      subscriptions: [structuredClone(SUB_A), structuredClone(SUB_B)],
    },
  });

  vi.mocked(createClient).mockResolvedValue(fake.client);
});

describe("GET /api/subscriptions/[id]", () => {
  it("kullanıcı kendi aboneliğini isteyince 200 ve abonelik verisini döner", async () => {
    const res = await callGet(SUB_A_ID);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      plan_id: PRO_PLAN_ID,
      status: "active",
      current_period_end: "2026-11-17T00:00:00.000Z",
    });
  });

  it("IDOR: A kullanıcısı B'ye ait subscription_id ile istek atınca 403/404 döner ve B'nin hiçbir verisi sızmaz", async () => {
    const res = await callGet(SUB_B_ID);

    expect([403, 404]).toContain(res.status);
    const body = await res.json();
    expect(body).toEqual(NOT_FOUND_BODY);
    expect(Object.keys(body)).toEqual(["error"]);
  });

  it("IDOR: yetkisiz kayıt ile var olmayan kayıt aynı status ve aynı body'yi döner (bilgi sızıntısı yok)", async () => {
    const unauthorizedRes = await callGet(SUB_B_ID);
    const unauthorizedBody = await unauthorizedRes.json();

    const missingRes = await callGet(MISSING_SUB_ID);
    const missingBody = await missingRes.json();

    expect(missingRes.status).toBe(unauthorizedRes.status);
    expect(missingBody).toEqual(unauthorizedBody);
  });

  it("oturumsuz istekte 401 UNAUTHORIZED döner", async () => {
    fake.setUser(null);

    const res = await callGet(SUB_A_ID);

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "UNAUTHORIZED" });
  });

  it("var olmayan subscription_id ile 404 döner ve body NOT_FOUND ile aynıdır", async () => {
    const res = await callGet(MISSING_SUB_ID);

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual(NOT_FOUND_BODY);
  });
});
