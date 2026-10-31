import { describe, expect, it, vi } from "vitest";

import { acceptWaConsent, getMyWaStatus, requestWaAction } from "./status";

// EML-106 / EML-104 Davranış Sözleşmesi. RPC sarmalayıcıları agent_id ALMAZ (AC-S1);
// hata durumunda {ok:false,error:'rpc_failed'} döner.

type RpcResult = { data: unknown; error: { message: string } | null };

function makeSupabase(outcome: RpcResult | Error) {
  const rpc = vi.fn(async (..._args: unknown[]) => {
    if (outcome instanceof Error) throw outcome;
    return outcome;
  });
  return { supabase: { rpc } as never, rpc };
}

const PHONE = "+90 5** *** **12";

describe("getMyWaStatus (AC-2, AC-S2, AC-S1)", () => {
  it("get_my_wa_status RPC'sini çağırır ve agent_id göndermez", async () => {
    const { supabase, rpc } = makeSupabase({
      data: { status: "none" },
      error: null,
    });

    await getMyWaStatus(supabase);

    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc.mock.calls[0][0]).toBe("get_my_wa_status");
    expect(JSON.stringify(rpc.mock.calls[0])).not.toContain("agent_id");
  });

  it("QR varken status 'qr' ve qr/qr_expires_at alanlarını döner (sözleşme 2)", async () => {
    const { supabase } = makeSupabase({
      data: {
        status: "qr",
        qr: "2@abc",
        qr_expires_at: "2099-01-01T00:00:20.000Z",
      },
      error: null,
    });

    const result = await getMyWaStatus(supabase);

    expect(result).toMatchObject({
      ok: true,
      status: "qr",
      qr: "2@abc",
      qr_expires_at: "2099-01-01T00:00:20.000Z",
    });
  });

  it("bağlıyken status 'connected' ve maskeli numara döner; qr alanı yoktur (sözleşme 3)", async () => {
    const { supabase } = makeSupabase({
      data: { status: "connected", phone_masked: PHONE },
      error: null,
    });

    const result = await getMyWaStatus(supabase);

    expect(result).toMatchObject({
      ok: true,
      status: "connected",
      phone_masked: PHONE,
    });
    expect(result).not.toHaveProperty("qr");
  });

  it("RPC error dönerse {ok:false,error:'rpc_failed'} (hata eşlemesi)", async () => {
    const { supabase } = makeSupabase({
      data: null,
      error: { message: "boom" },
    });

    await expect(getMyWaStatus(supabase)).resolves.toEqual({
      ok: false,
      error: "rpc_failed",
    });
  });

  it("RPC throw ederse {ok:false,error:'rpc_failed'} (hata eşlemesi)", async () => {
    const { supabase } = makeSupabase(new Error("network"));

    await expect(getMyWaStatus(supabase)).resolves.toEqual({
      ok: false,
      error: "rpc_failed",
    });
  });
});

describe("requestWaAction (AC-2, AC-3, AC-1, AC-9, AC-S4, AC-S1)", () => {
  it("connect → request_wa_action {p_action:'connect'} (agent_id yok)", async () => {
    const { supabase, rpc } = makeSupabase({
      data: { ok: true, status: "pending" },
      error: null,
    });

    const result = await requestWaAction(supabase, "connect");

    expect(rpc).toHaveBeenCalledWith("request_wa_action", { p_action: "connect" });
    expect(result).toEqual({ ok: true, status: "pending" });
    expect(Object.keys(rpc.mock.calls[0][1] as object)).toEqual(["p_action"]);
  });

  it("disconnect → request_wa_action {p_action:'disconnect'}", async () => {
    const { supabase, rpc } = makeSupabase({
      data: { ok: true, status: "pending" },
      error: null,
    });

    await requestWaAction(supabase, "disconnect");

    expect(rpc).toHaveBeenCalledWith("request_wa_action", {
      p_action: "disconnect",
    });
  });

  it.each(["consent_required", "subscription_required", "rate_limited"])(
    "RPC'nin %s hata payload'ı olduğu gibi döner (sözleşme 4/5/7)",
    async (error) => {
      const { supabase } = makeSupabase({
        data: { ok: false, error },
        error: null,
      });

      await expect(requestWaAction(supabase, "connect")).resolves.toEqual({
        ok: false,
        error,
      });
    },
  );

  it("RPC error dönerse {ok:false,error:'rpc_failed'}", async () => {
    const { supabase } = makeSupabase({
      data: null,
      error: { message: "boom" },
    });

    await expect(requestWaAction(supabase, "connect")).resolves.toEqual({
      ok: false,
      error: "rpc_failed",
    });
  });

  it("RPC throw ederse {ok:false,error:'rpc_failed'}", async () => {
    const { supabase } = makeSupabase(new Error("network"));

    await expect(requestWaAction(supabase, "disconnect")).resolves.toEqual({
      ok: false,
      error: "rpc_failed",
    });
  });
});

describe("acceptWaConsent (AC-1, AC-S7)", () => {
  it("accept_wa_consent {p_version:'2026-10'} çağrılır (agent_id yok)", async () => {
    const { supabase, rpc } = makeSupabase({
      data: { ok: true },
      error: null,
    });

    const result = await acceptWaConsent(supabase, "2026-10");

    expect(rpc).toHaveBeenCalledWith("accept_wa_consent", { p_version: "2026-10" });
    expect(Object.keys(rpc.mock.calls[0][1] as object)).toEqual(["p_version"]);
    expect(result).toEqual({ ok: true });
  });

  it("geçersiz sürüm RPC'den invalid_version olarak döner ve olduğu gibi iletilir", async () => {
    const { supabase } = makeSupabase({
      data: { ok: false, error: "invalid_version" },
      error: null,
    });

    await expect(acceptWaConsent(supabase, "1999-01")).resolves.toEqual({
      ok: false,
      error: "invalid_version",
    });
  });

  it("RPC error dönerse {ok:false,error:'rpc_failed'}", async () => {
    const { supabase } = makeSupabase({
      data: null,
      error: { message: "boom" },
    });

    await expect(acceptWaConsent(supabase, "2026-10")).resolves.toEqual({
      ok: false,
      error: "rpc_failed",
    });
  });
});
