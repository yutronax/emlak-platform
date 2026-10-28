import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ParsedFilters } from "./filters";
import { fetchFeed, fetchFilterOptions } from "./query";

type QueryResult = {
  data: unknown;
  error: { code?: string; message?: string } | null;
};

// Zincirlenebilir Supabase query builder taklidi. Her metot çağrısı kaydedilir;
// await edildiğinde sabit sonucu döner (veya reject eder).
const CHAIN_METHODS = [
  "select",
  "eq",
  "gte",
  "lte",
  "in",
  "not",
  "order",
  "range",
  "limit",
  "abortSignal",
  // Yasaklı ama izlenen metotlar: çağrılmamalı.
  "or",
  "filter",
  "ilike",
  "like",
  "textSearch",
] as const;

function makeBuilder(result: QueryResult | Error) {
  const builder: Record<string, unknown> = {};
  for (const method of CHAIN_METHODS) {
    builder[method] = vi.fn(() => builder);
  }
  builder.then = (
    resolve: (value: QueryResult) => unknown,
    reject: (reason: unknown) => unknown,
  ) => {
    if (result instanceof Error) {
      return Promise.reject(result).then(resolve, reject);
    }
    return Promise.resolve(result).then(resolve, reject);
  };
  return builder as typeof builder & Record<(typeof CHAIN_METHODS)[number], ReturnType<typeof vi.fn>>;
}

function setupSupabase(result: QueryResult | Error) {
  const builder = makeBuilder(result);
  const from = vi.fn(() => builder);
  const supabase = { from };
  return { supabase, from, builder };
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

const ALLOWED_CHAIN_METHODS = new Set([
  "select",
  "eq",
  "gte",
  "lte",
  "in",
  "not",
  "order",
  "range",
  "limit",
  "abortSignal",
]);

// Sayfa çıktısının beklenen satır şekli (AC-1 alanları).
const ROW = {
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
};

describe("fetchFeed — sorgu oluşturma (AC-2, AC-S4)", () => {
  let consoleError: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("yalnız izinli metotları kullanır; or() ve filter() hiç çağrılmaz", async () => {
    const { supabase, builder } = setupSupabase({ data: [ROW], error: null });

    await fetchFeed(
      supabase as never,
      emptyFilters({ il: "İstanbul", fiyatMin: 1000, oda: "3+1" }),
    );

    expect(builder.or).not.toHaveBeenCalled();
    expect(builder.filter).not.toHaveBeenCalled();
    expect(builder.ilike).not.toHaveBeenCalled();
    expect(builder.like).not.toHaveBeenCalled();
    expect(builder.textSearch).not.toHaveBeenCalled();
    expect(builder.eq).toHaveBeenCalled();
  });

  it("created_at desc sıralar ve yalnız izinli metotlardan oluşan zincir kurar", async () => {
    const { supabase, builder } = setupSupabase({ data: [], error: null });

    await fetchFeed(supabase as never, emptyFilters());

    expect(builder.order).toHaveBeenCalledWith("created_at", {
      ascending: false,
    });
    const usedMethods = CHAIN_METHODS.filter(
      (m) => (builder[m] as ReturnType<typeof vi.fn>).mock.calls.length > 0,
    );
    for (const m of usedMethods) {
      expect(ALLOWED_CHAIN_METHODS.has(m)).toBe(true);
    }
  });

  it("sayfa 1 için range(0,19) (sayfa başına 20, offset sayfalama)", async () => {
    const { supabase, builder } = setupSupabase({ data: [], error: null });

    await fetchFeed(supabase as never, emptyFilters({ sayfa: 1 }));

    expect(builder.range).toHaveBeenCalledWith(0, 19);
  });

  it("sayfa 2 için range(20,39)", async () => {
    const { supabase, builder } = setupSupabase({ data: [], error: null });

    await fetchFeed(supabase as never, emptyFilters({ sayfa: 2 }));

    expect(builder.range).toHaveBeenCalledWith(20, 39);
  });

  it("istemciden gelen limit kullanılmaz; sabit 20 kayıt (range ile)", async () => {
    const { supabase, builder } = setupSupabase({ data: [], error: null });

    await fetchFeed(supabase as never, emptyFilters({ sayfa: 1 }));

    expect(builder.limit).not.toHaveBeenCalledWith(5);
    expect(builder.range).toHaveBeenCalledWith(0, 19);
  });

  it("her ilan sorgusu 5 sn zaman aşımı sinyali taşır", async () => {
    const { supabase, builder } = setupSupabase({ data: [], error: null });

    await fetchFeed(supabase as never, emptyFilters());

    expect(builder.abortSignal).toHaveBeenCalledWith(expect.any(AbortSignal));
  });

  it("filtre yoksa eq/gte/lte/in çağrılmaz", async () => {
    const { supabase, builder } = setupSupabase({ data: [], error: null });

    await fetchFeed(supabase as never, emptyFilters());

    expect(builder.eq).not.toHaveBeenCalled();
    expect(builder.gte).not.toHaveBeenCalled();
    expect(builder.lte).not.toHaveBeenCalled();
    expect(builder.in).not.toHaveBeenCalled();
  });

  it("il, ilçe ve grup değerleri eq() ile eşitlik filtresi olarak uygulanır", async () => {
    const { supabase, builder } = setupSupabase({ data: [], error: null });

    await fetchFeed(
      supabase as never,
      emptyFilters({ il: "İstanbul", ilce: "Kadıköy", grup: "Grup A" }),
    );

    expect(builder.eq).toHaveBeenCalledWith("city", "İstanbul");
    expect(builder.eq).toHaveBeenCalledWith("district", "Kadıköy");
    expect(builder.eq).toHaveBeenCalledWith("source_group_name", "Grup A");
  });

  it("fiyat min/max gte()/lte() ile uygulanır", async () => {
    const { supabase, builder } = setupSupabase({ data: [], error: null });

    await fetchFeed(
      supabase as never,
      emptyFilters({ fiyatMin: 1000, fiyatMax: 5000 }),
    );

    expect(builder.gte).toHaveBeenCalledWith("price", 1000);
    expect(builder.lte).toHaveBeenCalledWith("price", 5000);
  });
});

describe("fetchFeed — fiyat filtresi TRY ve null kuralı (AC-7)", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("fiyat min aktifken currency='TRY' ve price is not null uygulanır", async () => {
    const { supabase, builder } = setupSupabase({ data: [], error: null });

    await fetchFeed(supabase as never, emptyFilters({ fiyatMin: 1000 }));

    expect(builder.eq).toHaveBeenCalledWith("currency", "TRY");
    expect(builder.not).toHaveBeenCalledWith("price", "is", null);
  });

  it("fiyat max aktifken de currency='TRY' ve price is not null uygulanır", async () => {
    const { supabase, builder } = setupSupabase({ data: [], error: null });

    await fetchFeed(supabase as never, emptyFilters({ fiyatMax: 5000 }));

    expect(builder.eq).toHaveBeenCalledWith("currency", "TRY");
    expect(builder.not).toHaveBeenCalledWith("price", "is", null);
  });

  it("fiyat filtresi yokken currency/price-null koşulu eklenmez", async () => {
    const { supabase, builder } = setupSupabase({ data: [], error: null });

    await fetchFeed(supabase as never, emptyFilters({ il: "İstanbul" }));

    expect(builder.eq).not.toHaveBeenCalledWith("currency", "TRY");
    expect(builder.not).not.toHaveBeenCalledWith("price", "is", null);
  });
});

describe("fetchFeed — oda filtresi (AC-8)", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("'3+1' tam eşitlik ile eq('rooms','3+1') olarak uygulanır", async () => {
    const { supabase, builder } = setupSupabase({ data: [], error: null });

    await fetchFeed(supabase as never, emptyFilters({ oda: "3+1" }));

    expect(builder.eq).toHaveBeenCalledWith("rooms", "3+1");
    expect(builder.in).not.toHaveBeenCalled();
  });

  it("'5+' sabit liste ile in('rooms', [...]) olarak uygulanır (5 ve üstü)", async () => {
    const { supabase, builder } = setupSupabase({ data: [], error: null });

    await fetchFeed(supabase as never, emptyFilters({ oda: "5+" }));

    expect(builder.in).toHaveBeenCalledWith("rooms", [
      "5+1",
      "5+2",
      "6+1",
      "6+2",
      "7+1",
      "8+1",
    ]);
    expect(builder.eq).not.toHaveBeenCalledWith("rooms", "5+");
  });
});

describe("fetchFeed — sonuç ve hata (AC-4, AC-5, AC-S6)", () => {
  let consoleError: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("başarılı sorgu satırları {ok:true, items} olarak döner", async () => {
    const { supabase } = setupSupabase({ data: [ROW], error: null });

    const result = await fetchFeed(supabase as never, emptyFilters());

    expect(result).toEqual({ ok: true, items: [ROW] });
  });

  it("data=[] ve error=null → {ok:true, items:[]} (hata ile boş ayırt edilir)", async () => {
    const { supabase } = setupSupabase({ data: [], error: null });

    const result = await fetchFeed(supabase as never, emptyFilters());

    expect(result).toEqual({ ok: true, items: [] });
    expect(consoleError).not.toHaveBeenCalled();
  });

  it("error dönerse {ok:false, code} döner ve tam olarak bu log yazılır", async () => {
    const { supabase } = setupSupabase({
      data: null,
      error: { code: "X", message: "db internals secret detail" },
    });

    const result = await fetchFeed(supabase as never, emptyFilters());

    expect(result).toEqual({ ok: false, code: "X" });
    expect(consoleError).toHaveBeenCalledWith(
      "[dashboard] listings query failed",
      { code: "X" },
    );
  });

  it("hata logu ve dönüş değeri DB mesajını içermez (AC-S6)", async () => {
    const { supabase } = setupSupabase({
      data: null,
      error: { code: "X", message: "db internals secret detail" },
    });

    const result = await fetchFeed(supabase as never, emptyFilters());

    expect(JSON.stringify(result)).not.toContain("secret detail");
    expect(JSON.stringify(consoleError.mock.calls)).not.toContain(
      "secret detail",
    );
  });

  it("timeout/istisna fırlatılırsa exception dışarı sızmaz, {ok:false} döner ve loglanır", async () => {
    const { supabase } = setupSupabase(
      Object.assign(new Error("The operation was aborted due to timeout"), {
        name: "TimeoutError",
      }),
    );

    const result = await fetchFeed(supabase as never, emptyFilters());

    expect(result).toMatchObject({ ok: false });
    expect(consoleError).toHaveBeenCalledWith(
      "[dashboard] listings query failed",
      expect.objectContaining({ code: expect.any(String) }),
    );
    expect(JSON.stringify(consoleError.mock.calls)).not.toContain(
      "due to timeout",
    );
  });
});

describe("fetchFilterOptions — distinct seçenekler (AC-9)", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const ROWS = [
    { city: "İstanbul", district: "Kadıköy", source_group_name: "Grup A" },
    { city: "İstanbul", district: "Kadıköy", source_group_name: "Grup A" },
    { city: "İstanbul", district: "Beşiktaş", source_group_name: "Grup B" },
    { city: "İzmir", district: "Çeşme", source_group_name: null },
    { city: "İzmir", district: null, source_group_name: null },
  ];

  it("il, ilçe ve grup değerlerini distinct olarak döner, null değerleri dışarıda bırakır", async () => {
    const { supabase } = setupSupabase({ data: ROWS, error: null });

    const options = await fetchFilterOptions(supabase as never, null);

    expect(options.cities).toHaveLength(2);
    expect(options.cities).toEqual(expect.arrayContaining(["İstanbul", "İzmir"]));
    expect(options.groups).toEqual(expect.arrayContaining(["Grup A", "Grup B"]));
    expect(options.groups).toHaveLength(2);
    expect(options.districts).toEqual(
      expect.arrayContaining(["Kadıköy", "Beşiktaş", "Çeşme"]),
    );
    expect(options.districts).toHaveLength(3);
    expect(options.districts).not.toContain(null);
    expect(options.groups).not.toContain(null);
  });

  it("seçili il varken ilçe listesi yalnız o ile ait ilçelerle daralır", async () => {
    const { supabase } = setupSupabase({ data: ROWS, error: null });

    const options = await fetchFilterOptions(supabase as never, "İstanbul");

    expect(options.districts).toEqual(
      expect.arrayContaining(["Kadıköy", "Beşiktaş"]),
    );
    expect(options.districts).toHaveLength(2);
    expect(options.districts).not.toContain("Çeşme");
  });

  it("seçenek sorgusu limit(1000) ile sınırlanır", async () => {
    const { supabase, builder } = setupSupabase({ data: ROWS, error: null });

    await fetchFilterOptions(supabase as never, null);

    expect(builder.limit).toHaveBeenCalledWith(1000);
    expect(builder.or).not.toHaveBeenCalled();
    expect(builder.filter).not.toHaveBeenCalled();
  });
});
