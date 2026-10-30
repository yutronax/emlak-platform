import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ParsedFilters } from "./filters";
import { fetchFeed, fetchFilterOptions } from "./query";

/**
 * EML-98 / EML-99 — akış ve seçenekler artık RPC üzerinden (feed_listings,
 * feed_filter_options). Doğrudan `from('listings')` çağrısı YOK (AC-S1, AC-9).
 *
 * Bu testler KIRMIZI olmalı: query.ts henüz rpc çağırmıyor.
 */

type RpcResult = { data: unknown; error: { code?: string; message?: string } | null };

// PostgREST rpc builder taklidi: abortSignal zincirlenir, await edilince sonuç döner.
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

// Eski yola düşülürse (from('listings')) bu zincir boş sonuç döner; böylece
// başarısızlık TypeError yerine anlamlı bir assertion farkı olarak görünür.
function makeLegacyChain(): unknown {
  const chain: unknown = new Proxy(function () {}, {
    get: (_t, prop) => {
      if (prop === "then") {
        return (resolve: (v: unknown) => unknown, reject: (r: unknown) => unknown) =>
          Promise.resolve({ data: [], error: null }).then(resolve, reject);
      }
      return () => chain;
    },
    apply: () => chain,
  });
  return chain;
}

function setupSupabase(result: RpcResult | Error) {
  const builder = makeRpcBuilder(result);
  const rpc = vi.fn(() => builder);
  const from = vi.fn(() => makeLegacyChain());
  const supabase = { rpc, from };
  return { supabase, rpc, from, builder };
}

function emptyFilters(overrides: Partial<ParsedFilters> = {}): ParsedFilters {
  return {
    grup: null,
    fiyatMin: null,
    fiyatMax: null,
    oda: null,
    il: null,
    ilce: null,
    sayfa: 1,
    ...overrides,
  } as ParsedFilters;
}

// Sunucunun açık satır şekli (AC-1 alanları + locked:false).
const OPEN_ROW = {
  id: "l-1",
  title: "Merkezde Daire",
  price: 2500000,
  currency: "TRY",
  rooms: "3+1",
  area_m2: 120,
  city: "İstanbul",
  district: "Kadıköy",
  source_group_name: "Grup A",
  created_at: "2026-10-28T09:00:00.000Z",
  locked: false,
};

// Sunucunun kilitli satır şekli (AC-4 / AC-S2): yalnız bu 5 anahtar.
const LOCKED_ROW = {
  id: "l-9",
  city: "İstanbul",
  district: "Ataşehir",
  created_at: "2026-10-28T08:00:00.000Z",
  locked: true,
};

const LOCKED_FORBIDDEN_KEYS = [
  "title",
  "price",
  "currency",
  "rooms",
  "area_m2",
  "source_group_name",
];

describe("fetchFeed — RPC çağrısı (AC-1, AC-2, AC-S1, AC-S3)", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("feed_listings RPC'si p_filters ve p_page ile çağrılır", async () => {
    const { supabase, rpc } = setupSupabase({
      data: { items: [], locked_count: 0, limit: 10, open_today: 0 },
      error: null,
    });

    await fetchFeed(
      supabase as never,
      emptyFilters({ il: "İstanbul", fiyatMin: 1000, oda: "3+1", sayfa: 2 }),
    );

    expect(rpc).toHaveBeenCalledWith("feed_listings", {
      p_filters: expect.objectContaining({
        il: "İstanbul",
        fiyatMin: 1000,
        oda: "3+1",
      }),
      p_page: 2,
    });
  });

  it("listings tablosu doğrudan okunmaz: from('listings') hiç çağrılmaz (AC-S1)", async () => {
    const { supabase, from } = setupSupabase({
      data: { items: [], locked_count: 0, limit: 10, open_today: 0 },
      error: null,
    });

    await fetchFeed(supabase as never, emptyFilters());

    expect(from).not.toHaveBeenCalled();
  });

  it("RPC çağrısı 5 sn zaman aşımı sinyali taşır (abortSignal)", async () => {
    const { supabase, builder } = setupSupabase({
      data: { items: [], locked_count: 0, limit: 10, open_today: 0 },
      error: null,
    });

    await fetchFeed(supabase as never, emptyFilters());

    expect(builder.abortSignal).toHaveBeenCalledWith(expect.any(AbortSignal));
  });
});

describe("fetchFeed — yanıt eşleme (AC-1, AC-3, AC-4, AC-5, AC-10)", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("limit altında: açık satırlar ve openToday döner, lockedCount 0 (durum 1)", async () => {
    const { supabase } = setupSupabase({
      data: { items: [OPEN_ROW], locked_count: 0, limit: 10, open_today: 7 },
      error: null,
    });

    const result = await fetchFeed(supabase as never, emptyFilters());

    expect(result).toEqual({
      ok: true,
      items: [OPEN_ROW],
      lockedCount: 0,
      limit: 10,
      openToday: 7,
    });
  });

  it("limit aşıldı: kilitli satırlar korunur ve lockedCount doğru döner (durum 2)", async () => {
    const { supabase } = setupSupabase({
      data: {
        items: [OPEN_ROW, LOCKED_ROW],
        locked_count: 4,
        limit: 10,
        open_today: 10,
      },
      error: null,
    });

    const result = await fetchFeed(supabase as never, emptyFilters());

    expect(result).toMatchObject({
      ok: true,
      lockedCount: 4,
      limit: 10,
      openToday: 10,
    });
    if (!result.ok) throw new Error("beklenmeyen hata");
    expect(result.items).toHaveLength(2);
    expect(result.items[1]).toEqual(LOCKED_ROW);
  });

  it("kilitli satır sunucudan geldiği gibi kalır: başlık/fiyat/oda alanları eklenmez (AC-S2)", async () => {
    const { supabase } = setupSupabase({
      data: { items: [LOCKED_ROW], locked_count: 1, limit: 0, open_today: 0 },
      error: null,
    });

    const result = await fetchFeed(supabase as never, emptyFilters());

    expect(result).toMatchObject({ ok: true });
    if (!result.ok) throw new Error("beklenmeyen hata");
    expect(result.items).toHaveLength(1);
    const locked = result.items[0] as unknown as Record<string, unknown>;
    expect(Object.keys(locked).sort()).toEqual(
      ["city", "created_at", "district", "id", "locked"].sort(),
    );
    for (const key of LOCKED_FORBIDDEN_KEYS) {
      expect(locked).not.toHaveProperty(key);
    }
  });

  it("sınırsız plan (limit null): limit null döner, hiçbir satır kilitli değil (AC-3)", async () => {
    const { supabase } = setupSupabase({
      data: { items: [OPEN_ROW], locked_count: 0, limit: null, open_today: 23 },
      error: null,
    });

    const result = await fetchFeed(supabase as never, emptyFilters());

    expect(result).toMatchObject({ ok: true, limit: null, lockedCount: 0 });
  });

  it("geçersiz limit (0): tüm satırlar kilitli, hata değil, consoleError yok (AC-10)", async () => {
    const { supabase } = setupSupabase({
      data: {
        items: [LOCKED_ROW],
        locked_count: 1,
        limit: 0,
        open_today: 0,
      },
      error: null,
    });

    const result = await fetchFeed(supabase as never, emptyFilters());

    expect(result).toMatchObject({
      ok: true,
      limit: 0,
      lockedCount: 1,
      openToday: 0,
    });
    expect(console.error).not.toHaveBeenCalled();
  });

  it("aboneliksiz: reason 'no_subscription' ile boş döner, ilan alanı yok (AC-S5)", async () => {
    const { supabase } = setupSupabase({
      data: {
        items: [],
        locked_count: 0,
        limit: 0,
        reason: "no_subscription",
      },
      error: null,
    });

    const result = await fetchFeed(supabase as never, emptyFilters());

    expect(result).toMatchObject({
      ok: true,
      items: [],
      lockedCount: 0,
      limit: 0,
      reason: "no_subscription",
    });
  });

  it("filtre sonucu boşsa reason alanı yok (boş durum ↔ abonelik ayrımı)", async () => {
    const { supabase } = setupSupabase({
      data: { items: [], locked_count: 0, limit: 10, open_today: 3 },
      error: null,
    });

    const result = await fetchFeed(
      supabase as never,
      emptyFilters({ il: "İzmir" }),
    );

    expect(result).toMatchObject({ ok: true, items: [] });
    expect(result).not.toHaveProperty("reason");
  });

  it("RPC gövdesinde snake_case alanlar camelCase'e çevrilir (lockedCount, openToday)", async () => {
    const { supabase } = setupSupabase({
      data: { items: [], locked_count: 2, limit: 10, open_today: 8 },
      error: null,
    });

    const result = await fetchFeed(supabase as never, emptyFilters());

    expect(result).toMatchObject({ lockedCount: 2, openToday: 8 });
    expect(result).not.toHaveProperty("locked_count");
    expect(result).not.toHaveProperty("open_today");
  });
});

describe("fetchFeed — hata ve zaman aşımı (AC-9)", () => {
  let consoleError: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("RPC error → {ok:false, code} döner ve '[dashboard] feed rpc failed' loglanır", async () => {
    const { supabase } = setupSupabase({
      data: null,
      error: { code: "42501", message: "db internals secret detail" },
    });

    const result = await fetchFeed(supabase as never, emptyFilters());

    expect(result).toEqual({ ok: false, code: "42501" });
    expect(consoleError).toHaveBeenCalledWith("[dashboard] feed rpc failed", {
      code: "42501",
    });
  });

  it("RPC hatasında doğrudan listings select'ine fallback yok (AC-9)", async () => {
    const { supabase, from } = setupSupabase({
      data: null,
      error: { code: "X", message: "boom" },
    });

    await fetchFeed(supabase as never, emptyFilters());

    expect(from).not.toHaveBeenCalled();
  });

  it("hata logu ve dönüş değeri DB mesajını içermez (AC-S6)", async () => {
    const { supabase } = setupSupabase({
      data: null,
      error: { code: "X", message: "db internals secret detail" },
    });

    const result = await fetchFeed(supabase as never, emptyFilters());

    expect(consoleError).toHaveBeenCalled();
    expect(JSON.stringify(result)).not.toContain("secret detail");
    expect(JSON.stringify(consoleError.mock.calls)).not.toContain("secret detail");
  });

  it("zaman aşımı (TimeoutError) → {ok:false, code:'TimeoutError'} döner ve loglanır", async () => {
    const timeoutError = Object.assign(
      new Error("The operation was aborted due to timeout"),
      { name: "TimeoutError" },
    );
    const { supabase } = setupSupabase(timeoutError);

    const result = await fetchFeed(supabase as never, emptyFilters());

    expect(result).toEqual({ ok: false, code: "TimeoutError" });
    expect(consoleError).toHaveBeenCalledWith("[dashboard] feed rpc failed", {
      code: "TimeoutError",
    });
    expect(JSON.stringify(consoleError.mock.calls)).not.toContain("due to timeout");
  });
});

describe("fetchFilterOptions — RPC seçenekleri (AC-7, AC-S7)", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const PAYLOAD = {
    cities: ["İstanbul", "İzmir"],
    districts: ["Kadıköy", "Beşiktaş"],
    groups: ["Grup A", "Grup B"],
  };

  it("feed_filter_options RPC'sini p_il ile çağırır; listings'e dokunmaz", async () => {
    const { supabase, rpc, from } = setupSupabase({ data: PAYLOAD, error: null });

    await fetchFilterOptions(supabase as never, "İstanbul");

    expect(rpc).toHaveBeenCalledWith("feed_filter_options", { p_il: "İstanbul" });
    expect(from).not.toHaveBeenCalled();
  });

  it("il null iken p_il: null gönderilir", async () => {
    const { supabase, rpc } = setupSupabase({ data: PAYLOAD, error: null });

    await fetchFilterOptions(supabase as never, null);

    expect(rpc).toHaveBeenCalledWith("feed_filter_options", { p_il: null });
  });

  it("RPC payload'ı (cities/districts/groups) olduğu gibi döner", async () => {
    const { supabase } = setupSupabase({ data: PAYLOAD, error: null });

    const options = await fetchFilterOptions(supabase as never, null);

    expect(options).toEqual(PAYLOAD);
  });

  it("zaman aşımı sinyali taşır (abortSignal)", async () => {
    const { supabase, builder } = setupSupabase({ data: PAYLOAD, error: null });

    await fetchFilterOptions(supabase as never, null);

    expect(builder.abortSignal).toHaveBeenCalledWith(expect.any(AbortSignal));
  });

  it("RPC hatası → boş seçenekler döner ve loglanır", async () => {
    const { supabase, from } = setupSupabase({
      data: null,
      error: { code: "X", message: "secret db detail" },
    });

    const options = await fetchFilterOptions(supabase as never, null);

    expect(options).toEqual({ cities: [], districts: [], groups: [] });
    expect(from).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalled();
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain(
      "secret db detail",
    );
  });

  it("RPC istisna fırlatırsa boş seçenekler döner (exception dışarı sızmaz)", async () => {
    const { supabase } = setupSupabase(
      Object.assign(new Error("aborted"), { name: "TimeoutError" }),
    );

    const options = await fetchFilterOptions(supabase as never, null);

    expect(options).toEqual({ cities: [], districts: [], groups: [] });
  });
});
