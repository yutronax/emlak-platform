import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getUnreadCount } from "./unread";

const CHAIN_METHODS = ["select", "gt", "eq", "limit", "or", "filter", "abortSignal"] as const;

function makeBuilder(result: { count: number | null; error: unknown }) {
  const builder: Record<string, unknown> = {};
  for (const method of CHAIN_METHODS) {
    builder[method] = vi.fn(() => builder);
  }
  builder.then = (
    resolve: (value: unknown) => unknown,
    reject: (reason: unknown) => unknown,
  ) => Promise.resolve(result).then(resolve, reject);
  return builder as Record<string, ReturnType<typeof vi.fn>>;
}

function setup(result: { count: number | null; error: unknown }) {
  const builder = makeBuilder(result);
  const from = vi.fn(() => builder);
  return { supabase: { from } as never, from, builder };
}

describe("getUnreadCount (AC-13)", () => {
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

  it("listings tablosunu count:'exact', head:true ile sayar", async () => {
    const { supabase, from, builder } = setup({ count: 3, error: null });

    await getUnreadCount(supabase, "agent-1", new Date("2026-10-27T00:00:00.000Z").toISOString());

    expect(from).toHaveBeenCalledWith("listings");
    expect(builder.select).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ count: "exact", head: true }),
    );
  });

  it("seenAt verilmişse created_at > seenAt koşulu uygulanır", async () => {
    const seenAt = "2026-10-27T10:00:00.000Z";
    const { supabase, builder } = setup({ count: 3, error: null });

    await getUnreadCount(supabase, "agent-1", seenAt);

    expect(builder.gt).toHaveBeenCalledTimes(1);
    const [column, value] = builder.gt.mock.calls[0];
    expect(column).toBe("created_at");
    expect(new Date(value as string).getTime()).toBe(new Date(seenAt).getTime());
  });

  it("seenAt null ise created_at > şimdi - 7 gün koşulu uygulanır (coalesce)", async () => {
    const { supabase, builder } = setup({ count: 0, error: null });

    await getUnreadCount(supabase, "agent-1", null);

    expect(builder.gt).toHaveBeenCalledTimes(1);
    const [column, value] = builder.gt.mock.calls[0];
    const sevenDaysAgo = NOW.getTime() - 7 * 24 * 60 * 60 * 1000;
    expect(column).toBe("created_at");
    expect(new Date(value as string).getTime()).toBe(sevenDaysAgo);
  });

  it("sayım en fazla 100 ile sınırlanır (limit 100)", async () => {
    const { supabase, builder } = setup({ count: 100, error: null });

    await getUnreadCount(supabase, "agent-1", null);

    expect(builder.limit).toHaveBeenCalledWith(100);
  });

  it("başarılı sayımı sayı olarak döner", async () => {
    const { supabase } = setup({ count: 7, error: null });

    const count = await getUnreadCount(supabase, "agent-1", null);

    expect(count).toBe(7);
  });

  it("sorgu hata dönerse null döner ve tam olarak bu log yazılır", async () => {
    const { supabase } = setup({
      count: null,
      error: { code: "X", message: "secret db detail" },
    });

    const result = await getUnreadCount(supabase, "agent-1", null);

    expect(result).toBeNull();
    expect(consoleError).toHaveBeenCalledWith(
      "[dashboard] unread count failed",
      { code: "X" },
    );
  });

  it("hata logu DB mesajını içermez (AC-S6)", async () => {
    const { supabase } = setup({
      count: null,
      error: { code: "X", message: "secret db detail" },
    });

    await getUnreadCount(supabase, "agent-1", null);

    expect(JSON.stringify(consoleError.mock.calls)).not.toContain(
      "secret db detail",
    );
  });

  it("OR/filter ile metin birleştirme yapılmaz", async () => {
    const { supabase, builder } = setup({ count: 1, error: null });

    await getUnreadCount(supabase, "agent-1", null);

    expect(builder.or).not.toHaveBeenCalled();
    expect(builder.filter).not.toHaveBeenCalled();
  });

  it("sorgu zincirinde abortSignal (timeout) uygulanır", async () => {
    const { supabase, builder } = setup({ count: 1, error: null });

    await getUnreadCount(supabase, "agent-1", null);

    expect(builder.abortSignal).toHaveBeenCalledTimes(1);
    expect(builder.abortSignal).toHaveBeenCalledWith(expect.any(AbortSignal));
  });

  it("sorgu AbortError ile reddedilirse null döner ve code 'timeout' ile loglanır", async () => {
    const abortError = Object.assign(new Error("aborted"), { name: "AbortError" });
    const builder: Record<string, unknown> = {};
    for (const method of CHAIN_METHODS) {
      builder[method] = vi.fn(() => builder);
    }
    builder.then = (
      _resolve: (value: unknown) => unknown,
      reject: (reason: unknown) => unknown,
    ) => Promise.reject(abortError).then(undefined, reject);
    const supabase = { from: vi.fn(() => builder) } as never;

    const result = await getUnreadCount(supabase, "agent-1", null);

    expect(result).toBeNull();
    expect(consoleError).toHaveBeenCalledWith(
      "[dashboard] unread count failed",
      { code: "timeout" },
    );
  });
});
