import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getUnreadCount } from "./unread";

/**
 * EML-98 / EML-99 — okunmamış sayısı artık feed_unread_count RPC'sinden gelir.
 * Doğrudan from('listings') çağrısı YOK (AC-7, AC-S1). Zil kilitli ilanları da sayar.
 *
 * Bu testler KIRMIZI olmalı: unread.ts henüz rpc çağırmıyor.
 */

type RpcResult = { data: unknown; error: unknown };

function makeRpcBuilder(result: RpcResult | Error) {
  const builder: Record<string, unknown> = {};
  builder.abortSignal = vi.fn(() => builder);
  builder.then = (resolve: (value: RpcResult) => unknown, reject: (reason: unknown) => unknown) => {
    if (result instanceof Error) {
      return Promise.reject(result).then(resolve, reject);
    }
    return Promise.resolve(result).then(resolve, reject);
  };
  return builder as { abortSignal: ReturnType<typeof vi.fn> } & Record<string, unknown>;
}

// Eski yola düşülürse (from('listings')) boş sonuç döner; başarısızlık anlamlı kalır.
function makeLegacyChain(): unknown {
  const chain: unknown = new Proxy(function () {}, {
    get: (_t, prop) => {
      if (prop === "then") {
        return (resolve: (v: unknown) => unknown, reject: (r: unknown) => unknown) =>
          Promise.resolve({ count: 0, error: null }).then(resolve, reject);
      }
      return () => chain;
    },
    apply: () => chain,
  });
  return chain;
}

function setup(result: RpcResult | Error) {
  const builder = makeRpcBuilder(result);
  const rpc = vi.fn((...args: unknown[]) => {
    void args;
    return builder;
  });
  const from = vi.fn(() => makeLegacyChain());
  return { supabase: { rpc, from } as never, rpc, from, builder };
}

describe("getUnreadCount (AC-7)", () => {
  const NOW = new Date("2026-10-28T12:00:00.000Z");
  let consoleError: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
    consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("feed_unread_count RPC'sini p_since ile çağırır", async () => {
    const { supabase, rpc } = setup({ data: 3, error: null });
    const seenAt = "2026-10-27T10:00:00.000Z";

    await getUnreadCount(supabase, "agent-1", seenAt);

    expect(rpc).toHaveBeenCalledWith("feed_unread_count", {
      p_since: expect.any(String),
    });
  });

  it("listings tablosu doğrudan okunmaz: from('listings') hiç çağrılmaz (AC-S1)", async () => {
    const { supabase, from } = setup({ data: 3, error: null });

    await getUnreadCount(supabase, "agent-1", null);

    expect(from).not.toHaveBeenCalled();
  });

  it("seenAt verilmişse p_since = seenAt (zaman olarak eşit)", async () => {
    const seenAt = "2026-10-27T10:00:00.000Z";
    const { supabase, rpc } = setup({ data: 3, error: null });

    await getUnreadCount(supabase, "agent-1", seenAt);

    const args = rpc.mock.calls[0][1] as { p_since: string };
    expect(new Date(args.p_since).getTime()).toBe(new Date(seenAt).getTime());
  });

  it("seenAt null ise p_since = şimdi - 7 gün (coalesce)", async () => {
    const { supabase, rpc } = setup({ data: 0, error: null });

    await getUnreadCount(supabase, "agent-1", null);

    const args = rpc.mock.calls[0][1] as { p_since: string };
    const sevenDaysAgo = NOW.getTime() - 7 * 24 * 60 * 60 * 1000;
    expect(new Date(args.p_since).getTime()).toBe(sevenDaysAgo);
  });

  it("başarılı RPC sonucunu sayı olarak döner", async () => {
    const { supabase } = setup({ data: 7, error: null });

    const count = await getUnreadCount(supabase, "agent-1", null);

    expect(count).toBe(7);
  });

  it("sorguda 5 sn zaman aşımı sinyali (abortSignal) uygulanır", async () => {
    const { supabase, builder } = setup({ data: 1, error: null });

    await getUnreadCount(supabase, "agent-1", null);

    expect(builder.abortSignal).toHaveBeenCalledWith(expect.any(AbortSignal));
  });

  it("RPC hata dönerse null döner ve '[dashboard] unread count failed' loglanır", async () => {
    const { supabase } = setup({
      data: null,
      error: { code: "X", message: "secret db detail" },
    });

    const result = await getUnreadCount(supabase, "agent-1", null);

    expect(result).toBeNull();
    expect(consoleError).toHaveBeenCalledWith("[dashboard] unread count failed", {
      code: "X",
    });
  });

  it("hata logu DB mesajını içermez (AC-S6)", async () => {
    const { supabase } = setup({
      data: null,
      error: { code: "X", message: "secret db detail" },
    });

    await getUnreadCount(supabase, "agent-1", null);

    expect(consoleError).toHaveBeenCalled();
    expect(JSON.stringify(consoleError.mock.calls)).not.toContain("secret db detail");
  });

  it("RPC AbortError ile reddedilirse null döner ve code 'timeout' ile loglanır", async () => {
    const abortError = Object.assign(new Error("aborted"), { name: "AbortError" });
    const { supabase } = setup(abortError);

    const result = await getUnreadCount(supabase, "agent-1", null);

    expect(result).toBeNull();
    expect(consoleError).toHaveBeenCalledWith("[dashboard] unread count failed", {
      code: "timeout",
    });
  });
});
