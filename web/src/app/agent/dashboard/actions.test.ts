import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createClient } from "@/lib/supabase/server";

import { markListingsSeen, refreshUnreadCount } from "./actions";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

const FUTURE = "2099-01-01T00:00:00.000Z";
const PAST = "2020-01-01T00:00:00.000Z";

type Result = { data?: unknown; count?: number | null; error: unknown };

const CHAIN_METHODS = [
  "select",
  "eq",
  "gt",
  "in",
  "order",
  "limit",
  "maybeSingle",
  "single",
  "or",
  "filter",
  "abortSignal",
] as const;

function makeBuilder(result: Result) {
  const builder: Record<string, unknown> = {};
  for (const method of CHAIN_METHODS) {
    builder[method] = vi.fn(() => builder);
  }
  builder.then = (
    resolve: (value: Result) => unknown,
    reject: (reason: unknown) => unknown,
  ) => Promise.resolve(result).then(resolve, reject);
  return builder;
}

type Setup = {
  user?: { id: string } | null;
  tables?: Record<string, Result>;
  rpc?: Result;
};

function setupSupabase({
  user = { id: "agent-A" },
  tables = {},
  rpc = { data: 1, error: null },
}: Setup = {}) {
  const builders: Record<string, ReturnType<typeof makeBuilder>> = {};
  const from = vi.fn((table: string) => {
    if (!builders[table]) {
      builders[table] = makeBuilder(
        tables[table] ?? { data: null, error: null },
      );
    }
    return builders[table];
  });
  const rpcFn = vi.fn().mockResolvedValue(rpc);
  const supabase = {
    from,
    rpc: rpcFn,
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }),
    },
  };
  vi.mocked(createClient).mockResolvedValue(supabase as never);
  return { from, rpc: rpcFn, builders, supabase };
}

describe("markListingsSeen (AC-14, AC-17, AC-S1)", () => {
  let consoleError: ReturnType<typeof vi.spyOn>;
  let consoleWarn: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("argüman almaz: rpc('mark_listings_seen') çağrılır, başka id gönderilmez", async () => {
    const { rpc } = setupSupabase({ rpc: { data: 1, error: null } });

    await markListingsSeen();

    expect(rpc).toHaveBeenCalledWith("mark_listings_seen");
  });

  it("başka bir agentId verilse bile rpc'ye bu id iletilmez (AC-S1)", async () => {
    const { rpc } = setupSupabase({
      user: { id: "agent-A" },
      rpc: { data: 1, error: null },
    });

    // Çağıran istemciden B id'si gönderse bile action bunu yok saymalı.
    await (markListingsSeen as (...args: unknown[]) => Promise<unknown>)(
      "agent-B",
    );

    expect(rpc).toHaveBeenCalledWith("mark_listings_seen");
    expect(JSON.stringify(rpc.mock.calls)).not.toContain("agent-B");
  });

  it("etkilenen satır 1 ise {ok:true} döner", async () => {
    setupSupabase({ rpc: { data: 1, error: null } });

    const result = await markListingsSeen();

    expect(result).toEqual({ ok: true });
    expect(consoleWarn).not.toHaveBeenCalled();
    expect(consoleError).not.toHaveBeenCalled();
  });

  it("etkilenen satır 0 ise başarı sayılmaz: {ok:false} + tam olarak bu warn yazılır (AC-17)", async () => {
    setupSupabase({ rpc: { data: 0, error: null } });

    const result = await markListingsSeen();

    expect(result).toEqual({ ok: false });
    expect(consoleWarn).toHaveBeenCalledWith(
      "[dashboard] seen_at update affected 0 rows",
    );
  });

  it("RPC hata dönerse {ok:false} + tam olarak bu error log yazılır (AC-16)", async () => {
    setupSupabase({
      rpc: { data: null, error: { code: "X", message: "secret db detail" } },
    });

    const result = await markListingsSeen();

    expect(result).toEqual({ ok: false });
    expect(consoleError).toHaveBeenCalledWith(
      "[dashboard] seen_at update failed",
      { code: "X" },
    );
    expect(JSON.stringify(consoleError.mock.calls)).not.toContain(
      "secret db detail",
    );
  });

  it("oturum yoksa rpc çağrılmaz ve {ok:false} döner (AC-S1)", async () => {
    const { rpc } = setupSupabase({ user: null });

    const result = await markListingsSeen();

    expect(rpc).not.toHaveBeenCalled();
    expect(result).toEqual({ ok: false });
  });
});

describe("refreshUnreadCount (AC-15, AC-S3)", () => {
  const NOW = new Date("2026-10-28T12:00:00.000Z");

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("abonelik yoksa listings sorgusu hiç yapılmaz (AC-S3)", async () => {
    const { from } = setupSupabase({
      tables: { subscriptions: { data: null, error: null } },
    });

    const result = await refreshUnreadCount();

    const tables = from.mock.calls.map((call) => call[0]);
    expect(tables).not.toContain("listings");
    expect(result).toMatchObject({ ok: false });
  });

  it("abonelik süresi dolmuşsa listings sorgusu hiç yapılmaz (AC-S3)", async () => {
    const { from } = setupSupabase({
      tables: {
        subscriptions: {
          data: { status: "active", current_period_end: PAST },
          error: null,
        },
      },
    });

    const result = await refreshUnreadCount();

    const tables = from.mock.calls.map((call) => call[0]);
    expect(tables).not.toContain("listings");
    expect(result).toMatchObject({ ok: false });
  });

  it("aktif abonelikte sayaç hesaplanır ve {ok:true, count} döner", async () => {
    const { from } = setupSupabase({
      tables: {
        subscriptions: {
          data: { status: "active", current_period_end: FUTURE },
          error: null,
        },
        agents: {
          data: { listings_seen_at: "2026-10-27T10:00:00.000Z" },
          error: null,
        },
        listings: { data: null, count: 4, error: null },
      },
    });

    const result = await refreshUnreadCount();

    expect(from.mock.calls.map((call) => call[0])).toContain("listings");
    expect(result).toEqual({ ok: true, count: 4 });
  });

  it("sayaç sorgusu hata verirse {ok:false} döner, DB mesajı sızmaz", async () => {
    setupSupabase({
      tables: {
        subscriptions: {
          data: { status: "trialing", current_period_end: FUTURE },
          error: null,
        },
        agents: { data: { listings_seen_at: null }, error: null },
        listings: {
          data: null,
          count: null,
          error: { code: "X", message: "secret db detail" },
        },
      },
    });

    const result = await refreshUnreadCount();

    expect(result).toMatchObject({ ok: false });
    expect(JSON.stringify(result)).not.toContain("secret db detail");
  });
});
