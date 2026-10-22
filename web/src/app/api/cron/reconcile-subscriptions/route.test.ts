import { NextRequest } from "next/server";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

import { createServiceRoleClient } from "@/lib/supabase/server";

import { GET } from "./route";

vi.mock("@/lib/supabase/server", () => ({
  createServiceRoleClient: vi.fn(),
}));

const CRON_URL = "http://localhost/api/cron/reconcile-subscriptions";
const VALID_SECRET = "test-cron-secret";

type UpdateResult = { data: { id: string }[] | null; error: { message: string } | null };

// subscriptions sorgu zinciri: .from("subscriptions").update({...}).eq("status","pending").lt("created_at", threshold).select("id")
function setupSupabase(updateResult: UpdateResult = { data: [], error: null }) {
  const select = vi.fn().mockResolvedValue(updateResult);
  const chain: Record<string, unknown> = {};
  chain.select = select;
  const lt = vi.fn((_column: string, _value: string) => chain);
  chain.lt = lt;
  const eq = vi.fn(() => chain);
  chain.eq = eq;
  const update = vi.fn(() => chain);
  chain.update = update;

  const from = vi.fn((table: string) => {
    if (table === "subscriptions") return chain;
    throw new Error(`Beklenmeyen tablo: ${table}`);
  });

  const supabase = { from };
  vi.mocked(createServiceRoleClient).mockReturnValue(supabase as never);
  return { supabase, from, update, eq, lt, select };
}

function cronRequest(authorizationHeader?: string): NextRequest {
  const headers: Record<string, string> = {};
  if (authorizationHeader !== undefined) {
    headers.authorization = authorizationHeader;
  }
  return new NextRequest(CRON_URL, { method: "GET", headers });
}

describe("GET /api/cron/reconcile-subscriptions", () => {
  const originalCronSecret = process.env.CRON_SECRET;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = VALID_SECRET;
  });

  afterEach(() => {
    if (originalCronSecret === undefined) {
      delete process.env.CRON_SECRET;
    } else {
      process.env.CRON_SECRET = originalCronSecret;
    }
  });

  // AC-S1: header yok veya yanlış, CRON_SECRET geçerli -> 401, hiçbir DB işlemi yapılmaz.
  it.each([
    { label: "header yok", header: undefined },
    { label: "yanlış secret", header: "Bearer wrong-secret" },
    { label: "Bearer öneki yok", header: VALID_SECRET },
  ])("AC-S1: $label ise 401 döner ve subscriptions sorgusu hiç çağrılmaz", async ({ header }) => {
    const { from } = setupSupabase();

    const res = await GET(cronRequest(header));

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "UNAUTHORIZED" });
    expect(from).not.toHaveBeenCalled();
  });

  // AC-S2: CRON_SECRET env hiç set edilmemiş -> 500, hiçbir header ile DB işlemi yapılmaz.
  it("AC-S2: CRON_SECRET env set edilmemişse 500 döner ve subscriptions sorgusu hiç çağrılmaz", async () => {
    delete process.env.CRON_SECRET;
    const { from } = setupSupabase();

    const res = await GET(cronRequest(`Bearer ${VALID_SECRET}`));

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "CONFIG_ERROR" });
    expect(from).not.toHaveBeenCalled();
  });

  // AC-3: geçerli secret, eşiği aşan pending kayıtlar güncellenir -> 200 + {updated: N}.
  it("AC-3: geçerli secret ile eşiği aşan 2 kayıt güncellenirse 200 + {updated: 2} döner", async () => {
    const { update, eq, lt, select } = setupSupabase({
      data: [{ id: "sub-1" }, { id: "sub-2" }],
      error: null,
    });

    const res = await GET(cronRequest(`Bearer ${VALID_SECRET}`));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ updated: 2 });
    expect(update).toHaveBeenCalledWith({ status: "needs_review" });
    expect(eq).toHaveBeenCalledWith("status", "pending");
    expect(select).toHaveBeenCalledWith("id");

    // AC-5/AC-6: eşik hesaplaması doğru parametreyle çağrılır (yaklaşık "1 saat önce", ISO string).
    expect(lt).toHaveBeenCalledWith("created_at", expect.any(String));
    const [, thresholdArg] = lt.mock.calls[0] as [string, string];
    const thresholdMs = new Date(thresholdArg).getTime();
    const expectedMs = Date.now() - 60 * 60 * 1000;
    expect(Math.abs(thresholdMs - expectedMs)).toBeLessThan(5000);
  });

  // AC-S3/AC-7: eşiği aşan kayıt yoksa (ikinci çağrı gibi) -> 200 + {updated: 0}, hata yok.
  it("AC-S3/AC-7: eşiği aşan kayıt yoksa 200 + {updated: 0} döner, hata oluşmaz", async () => {
    setupSupabase({ data: [], error: null });

    const res = await GET(cronRequest(`Bearer ${VALID_SECRET}`));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ updated: 0 });
  });

  // Gerçek DB hatası: update sorgusu hata dönerse 500, console.error çağrılır.
  it("gerçek bir DB hatası dönerse 500 döner ve console.error çağrılır", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    setupSupabase({ data: null, error: { message: "network error" } });

    const res = await GET(cronRequest(`Bearer ${VALID_SECRET}`));

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "INTERNAL_ERROR" });
    expect(consoleErrorSpy).toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
  });
});
