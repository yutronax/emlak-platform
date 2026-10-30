import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createClient } from "@/lib/supabase/server";

import { markListingsSeen, refreshUnreadCount } from "./actions";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

const FUTURE = "2099-01-01T00:00:00.000Z";
const PAST = "2020-01-01T00:00:00.000Z";

type Result = { data?: unknown; error: unknown };

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
  // mark_listings_seen ve diğer (argümansız) RPC'ler için sonuç
  rpc?: Result;
  // feed_unread_count RPC'si için sonuç (sayaç)
  unread?: Result;
};

function setupSupabase({
  user = { id: "agent-A" },
  tables = {},
  rpc = { data: 1, error: null },
  unread = { data: 1, error: null },
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
  // RPC'ler ada göre yönlendirilir: feed_unread_count -> unread, diğerleri -> rpc.
  const rpcFn = vi.fn((name: string) =>
    name === "feed_unread_count" ? makeBuilder(unread) : makeBuilder(rpc),
  );
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

// Belirli bir RPC'nin ilk çağrısının argümanları (yoksa undefined).
function rpcArgs(rpc: ReturnType<typeof vi.fn>, name: string) {
  const call = rpc.mock.calls.find((c) => c[0] === name);
  return call?.[1] as Record<string, unknown> | undefined;
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

  // Eski: from('listings') sayımı. Yeni: feed_unread_count RPC'si (sunucu tarafı yetki).
  it("abonelik yoksa feed_unread_count RPC'si hiç çağrılmaz (AC-S3)", async () => {
    const { from, rpc } = setupSupabase({
      tables: { subscriptions: { data: null, error: null } },
    });

    const result = await refreshUnreadCount();

    const tables = from.mock.calls.map((call) => call[0]);
    expect(tables).not.toContain("listings");
    expect(rpc).not.toHaveBeenCalledWith("feed_unread_count", expect.anything());
    expect(result).toMatchObject({ ok: false });
  });

  it("abonelik süresi dolmuşsa feed_unread_count RPC'si hiç çağrılmaz (AC-S3)", async () => {
    const { from, rpc } = setupSupabase({
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
    expect(rpc).not.toHaveBeenCalledWith("feed_unread_count", expect.anything());
    expect(result).toMatchObject({ ok: false });
  });

  // Eski: listings head:true count. Yeni: feed_unread_count({p_since: listings_seen_at}).
  it("aktif abonelikte feed_unread_count p_since=listings_seen_at ile çağrılır ve {ok:true, count} döner", async () => {
    const SEEN = "2026-10-27T10:00:00.000Z";
    const { from, rpc } = setupSupabase({
      tables: {
        subscriptions: {
          data: { status: "active", current_period_end: FUTURE },
          error: null,
        },
        agents: {
          data: { listings_seen_at: SEEN },
          error: null,
        },
      },
      unread: { data: 4, error: null },
    });

    const result = await refreshUnreadCount();

    expect(from.mock.calls.map((call) => call[0])).not.toContain("listings");
    expect(rpc).toHaveBeenCalledWith("feed_unread_count", { p_since: SEEN });
    expect(result).toEqual({ ok: true, count: 4 });
  });

  // Eski: seenAt null -> coalesce. Yeni: p_since = şimdi - 7 gün.
  it("listings_seen_at null ise p_since = şimdi - 7 gün (coalesce)", async () => {
    const { rpc } = setupSupabase({
      tables: {
        subscriptions: {
          data: { status: "trialing", current_period_end: FUTURE },
          error: null,
        },
        agents: { data: { listings_seen_at: null }, error: null },
      },
      unread: { data: 0, error: null },
    });

    await refreshUnreadCount();

    const args = rpcArgs(rpc, "feed_unread_count") as { p_since: string };
    const sevenDaysAgo = NOW.getTime() - 7 * 24 * 60 * 60 * 1000;
    expect(new Date(args.p_since).getTime()).toBe(sevenDaysAgo);
  });

  // Eski: sayım hatası. Yeni: feed_unread_count RPC hatası -> {ok:false}, DB mesajı sızmaz.
  it("feed_unread_count RPC hata verirse {ok:false} döner, DB mesajı sızmaz", async () => {
    setupSupabase({
      tables: {
        subscriptions: {
          data: { status: "trialing", current_period_end: FUTURE },
          error: null,
        },
        agents: { data: { listings_seen_at: null }, error: null },
      },
      unread: {
        data: null,
        error: { code: "X", message: "secret db detail" },
      },
    });

    const result = await refreshUnreadCount();

    expect(result).toMatchObject({ ok: false });
    expect(JSON.stringify(result)).not.toContain("secret db detail");
  });
});
