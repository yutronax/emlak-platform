import { beforeEach, describe, expect, it, vi } from "vitest";

import { createClient } from "@/lib/supabase/server";

import { requestWaAction } from "./actions";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

type RpcReply = { data?: unknown; error?: { message: string } | null } | "throw";

// rpc adına göre yanıt veren sahte Supabase istemcisi.
function setupSupabase(replies: Record<string, RpcReply>) {
  const rpc = vi.fn(async (name: string) => {
    const reply = replies[name];
    if (reply === undefined) throw new Error(`Beklenmeyen rpc: ${name}`);
    if (reply === "throw") throw new Error("network down");
    return { data: reply.data ?? null, error: reply.error ?? null };
  });
  vi.mocked(createClient).mockResolvedValue({ rpc } as never);
  return { rpc };
}

describe("requestWaAction — disconnect ve veri silme (EML-107 AC-12)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("disconnect: request_wa_action sonrası delete_my_wa_data çağrılır ve sonuç ok:true döner", async () => {
    const { rpc } = setupSupabase({
      request_wa_action: { data: { ok: true, status: "disconnected" } },
      delete_my_wa_data: { data: { ok: true } },
    });

    const res = await requestWaAction("disconnect");

    expect(rpc).toHaveBeenCalledWith("request_wa_action", { p_action: "disconnect" });
    expect(rpc).toHaveBeenCalledWith("delete_my_wa_data");
    expect(res).toEqual({ ok: true, status: "disconnected" });
  });

  it("disconnect: delete_my_wa_data error dönerse ok:false (rpc_failed) döner, başarı bildirilmez", async () => {
    setupSupabase({
      request_wa_action: { data: { ok: true, status: "disconnected" } },
      delete_my_wa_data: { error: { message: "permission denied" } },
    });

    const res = await requestWaAction("disconnect");

    expect(res).toEqual({ ok: false, error: "rpc_failed" });
  });

  it("disconnect: delete_my_wa_data throw ederse ok:false (rpc_failed) döner", async () => {
    setupSupabase({
      request_wa_action: { data: { ok: true, status: "disconnected" } },
      delete_my_wa_data: "throw",
    });

    const res = await requestWaAction("disconnect");

    expect(res).toEqual({ ok: false, error: "rpc_failed" });
  });

  it("disconnect: delete_my_wa_data ok:false dönerse ok:false döner", async () => {
    setupSupabase({
      request_wa_action: { data: { ok: true, status: "disconnected" } },
      delete_my_wa_data: { data: { ok: false, error: "unauthorized" } },
    });

    const res = await requestWaAction("disconnect");

    expect(res).toEqual({ ok: false, error: "rpc_failed" });
  });

  it("disconnect: bağlantı kesme gerçek bir hatayla başarısızsa delete_my_wa_data hiç çağrılmaz", async () => {
    const { rpc } = setupSupabase({
      request_wa_action: { data: { ok: false, error: "unauthorized" } },
    });

    const res = await requestWaAction("disconnect");

    expect(res).toEqual({ ok: false, error: "unauthorized" });
    expect(rpc).not.toHaveBeenCalledWith("delete_my_wa_data");
  });

  it("disconnect: request not_connected + silme başarılı → ok:true ve delete_my_wa_data çağrılır", async () => {
    const { rpc } = setupSupabase({
      request_wa_action: { data: { ok: false, error: "not_connected" } },
      delete_my_wa_data: { data: { ok: true } },
    });

    const res = await requestWaAction("disconnect");

    expect(rpc).toHaveBeenCalledWith("delete_my_wa_data");
    expect(res).toEqual({ ok: true, status: "disconnected" });
  });

  it("disconnect: request not_connected + silme başarısız → ok:false (rpc_failed)", async () => {
    setupSupabase({
      request_wa_action: { data: { ok: false, error: "not_connected" } },
      delete_my_wa_data: { error: { message: "permission denied" } },
    });

    const res = await requestWaAction("disconnect");

    expect(res).toEqual({ ok: false, error: "rpc_failed" });
  });

  it("connect: delete_my_wa_data çağrılmaz", async () => {
    const { rpc } = setupSupabase({
      request_wa_action: { data: { ok: true, status: "pending" } },
    });

    const res = await requestWaAction("connect");

    expect(res).toEqual({ ok: true, status: "pending" });
    expect(rpc).not.toHaveBeenCalledWith("delete_my_wa_data");
  });
});
