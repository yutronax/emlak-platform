// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { redirect } from "next/navigation";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createClient } from "@/lib/supabase/server";

import Page from "./page";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

// Gerçek Next.js'te redirect() her zaman fırlatır; bu mock bunu simüle eder.
vi.mock("next/navigation", () => ({
  redirect: vi.fn(() => {
    throw new Error("NEXT_REDIRECT");
  }),
}));

// Sayfa, bildirim zilini (client bileşen) render eder; zil server action'ları
// test ortamında gerçek DB'ye gitmesin diye stublanır.
vi.mock("./actions", () => ({
  markListingsSeen: vi.fn(),
  refreshUnreadCount: vi.fn(),
}));

const FUTURE = "2099-01-01T00:00:00.000Z";
const PAST = "2020-01-01T00:00:00.000Z";

// Sabit "şimdi": 2026-10-28 12:00 UTC (= 15:00 Europe/Istanbul).
const NOW = new Date("2026-10-28T12:00:00.000Z");

type QueryError = { code?: string; message?: string } | null;
type QueryResult = {
  data: unknown;
  error: QueryError;
};

type CountResult = {
  count: number | null;
  error: QueryError;
};

// Zincirlenebilir (select/eq/order/...) ve await edilebilir bir Supabase sorgusu taklidi.
// Yasaklı metotlar (or/filter) da izlenir; çağrılmamaları assert edilir (AC-S4).
const CHAIN_METHODS = [
  "select",
  "eq",
  "neq",
  "in",
  "gte",
  "lte",
  "gt",
  "not",
  "order",
  "limit",
  "range",
  "returns",
  "single",
  "maybeSingle",
  "or",
  "filter",
  "abortSignal",
] as const;

function makeQuery(result: QueryResult) {
  const query: Record<string, unknown> = {};
  for (const method of CHAIN_METHODS) {
    query[method] = vi.fn(() => query);
  }
  query.then = (
    resolve: (value: QueryResult) => unknown,
    reject: (reason: unknown) => unknown,
  ) => Promise.resolve(result).then(resolve, reject);
  return query as Record<string, ReturnType<typeof vi.fn>> & {
    then: unknown;
  };
}

// Abonelik sorgusu için basit (tek sonuç) builder.
function makeSubQuery(result: QueryResult) {
  return makeQuery(result);
}

// Her from("listings") çağrısı KENDİ builder'ını alır (sayaç, seçenek ve ilan
// sorguları birbirinin zincirini kirletmez). Await anında sorgu türü kendi
// zincirine bakılarak ayırt edilir:
//  - head:true select  -> sayaç (count)
//  - limit(1000)       -> seçenek (distinct il/ilçe/grup) sorgusu
//  - aksi halde        -> ilan akışı (feed)
// Sayfa sırası: seçenekler -> ilanlar -> sayaç. Testler `listingsQuery` ile
// ilan (feed) builder'ının çağrılarını assert eder; bu handle, feed builder'ına
// lazy olarak yönlendirilir.
function makeListingsQueries(feed: QueryResult, count: CountResult) {
  const builders: Record<string, ReturnType<typeof vi.fn>>[] = [];
  const optionsResult: QueryResult = feed.error
    ? { data: [], error: null }
    : { data: feed.data ?? [], error: null };

  function create() {
    const query = makeQuery({ data: null, error: null });
    query.then = (
      resolve: (value: unknown) => unknown,
      reject: (reason: unknown) => unknown,
    ) => {
      const selectCalls = query.select.mock.calls as unknown[][];
      const isCount = selectCalls.some(
        (args) =>
          typeof args[1] === "object" &&
          args[1] !== null &&
          (args[1] as { head?: boolean }).head === true,
      );
      const limitCalls = query.limit.mock.calls as unknown[][];
      const isOptions = limitCalls.some((args) => args[0] === 1000);

      let result: unknown;
      if (isCount) {
        result = count;
      } else if (isOptions) {
        result = optionsResult;
      } else {
        result = feed;
      }
      return Promise.resolve(result).then(resolve, reject);
    };
    builders.push(query);
    return query;
  }

  // Feed builder'ı: range() çağrılmış olan (ilan akışı). Henüz çağrılmadıysa boş builder.
  function feedBuilder(): Record<string, ReturnType<typeof vi.fn>> {
    return (
      builders.find((b) => (b.range.mock.calls as unknown[][]).length > 0) ??
      makeQuery({ data: null, error: null })
    );
  }

  const listingsQuery = new Proxy(
    {} as Record<string, ReturnType<typeof vi.fn>>,
    {
      get: (_target, prop) => feedBuilder()[prop as string],
    },
  );

  return { create, listingsQuery };
}

type SetupOptions = {
  // subscriptions tablosunda ilk sorgu: açık (trialing/active/past_due) satır
  openSub?: QueryResult;
  // subscriptions tablosunda ikinci sorgu: en son satır (fallback)
  latestSub?: QueryResult;
  // listings: ilan akışı sonucu
  listings?: QueryResult;
  // listings: sayaç (head:true) sonucu
  unreadCount?: CountResult;
  // agents.listings_seen_at
  seenAt?: string | null;
  userId?: string | null;
};

function setupSupabase({
  openSub = { data: null, error: null },
  latestSub = { data: null, error: null },
  listings = { data: [], error: null },
  unreadCount = { count: 0, error: null },
  seenAt = null,
  userId = "user-1",
}: SetupOptions = {}) {
  const openSubQuery = makeSubQuery(openSub);
  const latestSubQuery = makeSubQuery(latestSub);
  const listingsFactory = makeListingsQueries(listings, unreadCount);
  const listingsQuery = listingsFactory.listingsQuery;
  const agentsQuery = makeSubQuery({
    data: { listings_seen_at: seenAt },
    error: null,
  });

  let subscriptionCalls = 0;
  const from = vi.fn((table: string) => {
    if (table === "subscriptions") {
      subscriptionCalls += 1;
      return subscriptionCalls === 1 ? openSubQuery : latestSubQuery;
    }
    if (table === "listings") return listingsFactory.create();
    if (table === "agents") return agentsQuery;
    throw new Error(`Beklenmeyen tablo: ${table}`);
  });

  const supabase = {
    from,
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: userId ? { id: userId } : null },
        error: null,
      }),
    },
  };
  vi.mocked(createClient).mockResolvedValue(supabase as never);
  return { from, openSubQuery, latestSubQuery, listingsQuery, agentsQuery };
}

// Sayfa, Next 16 kuralıyla searchParams'ı Promise olarak alır.
async function loadPage(params: Record<string, string | undefined> = {}) {
  return Page({ searchParams: Promise.resolve(params) } as never);
}

const ACTIVE_SUB = {
  data: { status: "active", current_period_end: FUTURE },
  error: null,
};

const LISTING_A = {
  id: "l-1",
  title: "Merkezde Güzel Daire",
  price: 2500000,
  currency: "TRY",
  rooms: "3+1",
  area_m2: 120,
  city: "İstanbul",
  district: "Kadıköy",
  source_group_name: "Grup A",
  created_at: "2026-10-28T11:48:00.000Z", // 12 dk önce
};

const LISTING_B = {
  id: "l-2",
  title: "Deniz Manzaralı Villa",
  price: 9900000,
  currency: "TRY",
  rooms: "5+2",
  area_m2: 300,
  city: "İzmir",
  district: "Çeşme",
  source_group_name: "Grup B",
  created_at: "2026-10-27T11:05:00.000Z", // 27 Eki 14:05 (Istanbul)
};

// Seçenek elemanlarının boş olmayan değerleri (placeholder hariç).
function optionValues(select: HTMLSelectElement | null): string[] {
  if (!select) return [];
  return Array.from(select.options)
    .map((option) => option.value)
    .filter((value) => value !== "");
}

function selectFor(container: HTMLElement, name: string) {
  return container.querySelector<HTMLSelectElement>(`select[name="${name}"]`);
}

describe("AgentDashboardPage", () => {
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    cleanup();
    errorSpy.mockRestore();
    vi.useRealTimers();
  });

  // AC-S1 (Critical): oturum yoksa /login'e yönlendirilir, sayfa içeriği render edilmez.
  it("oturum yoksa redirect('/login') çağırır ve subscriptions/listings sorgusu yapmaz", async () => {
    const { from } = setupSupabase({ userId: null });

    await expect(loadPage()).rejects.toThrow();

    expect(redirect).toHaveBeenCalledWith("/login");
    const tables = from.mock.calls.map((call) => call[0]);
    expect(tables).not.toContain("subscriptions");
    expect(tables).not.toContain("listings");
  });

  // AC-3 (Critical): açık abonelik satırı -> doğru Türkçe rozet.
  it.each([
    ["trialing", "Deneme sürümü"],
    ["active", "Aktif"],
    ["past_due", "Ödeme gecikmiş"],
  ])(
    "açık abonelik status=%s iken '%s' rozetini gösterir",
    async (status, label) => {
      setupSupabase({
        openSub: {
          data: { status, current_period_end: FUTURE },
          error: null,
        },
      });

      const jsx = await loadPage();
      render(jsx);

      expect(screen.getByText(label, { exact: true })).toBeInTheDocument();
    },
  );

  // AC-4 (High): açık satır yok, en son satır canceled -> "İptal edildi".
  it("açık satır yoksa ve en son satır canceled ise 'İptal edildi' rozetini gösterir", async () => {
    setupSupabase({
      openSub: { data: null, error: null },
      latestSub: {
        data: { status: "canceled", current_period_end: PAST },
        error: null,
      },
    });

    const jsx = await loadPage();
    render(jsx);

    expect(screen.getByText(/İptal edildi/)).toBeInTheDocument();
    expect(screen.queryByText(/Aboneliğiniz yok/)).toBeNull();
  });

  // AC-5 (Medium): hiç subscription satırı yok -> "Aboneliğiniz yok".
  it("hiç subscription satırı yoksa 'Aboneliğiniz yok' rozetini gösterir", async () => {
    setupSupabase({
      openSub: { data: null, error: null },
      latestSub: { data: null, error: null },
    });

    const jsx = await loadPage();
    render(jsx);

    expect(screen.getByText(/Aboneliğiniz yok/)).toBeInTheDocument();
  });

  // AC-1 + AC-2 (Critical): erişim var -> created_at desc, sayfa 1 = range(0,19),
  // kart alanları render edilir.
  it("erişim koşulu sağlanıyorsa listings kayıtlarını render eder ve doğru sorgu zincirini kullanır", async () => {
    const { from, listingsQuery } = setupSupabase({
      openSub: ACTIVE_SUB,
      listings: { data: [LISTING_A, LISTING_B], error: null },
    });

    const jsx = await loadPage();
    render(jsx);

    expect(from).toHaveBeenCalledWith("listings");
    expect(listingsQuery.select).toHaveBeenCalled();
    expect(listingsQuery.order).toHaveBeenCalledWith("created_at", {
      ascending: false,
    });
    expect(listingsQuery.range).toHaveBeenCalledWith(0, 19);

    expect(screen.getByText(/Merkezde Güzel Daire/)).toBeInTheDocument();
    expect(screen.getByText(/Deniz Manzaralı Villa/)).toBeInTheDocument();
    expect(screen.getAllByText(/İstanbul/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Kadıköy/).length).toBeGreaterThan(0);
    expect(screen.getByText(/2[.,]?500[.,]?000/)).toBeInTheDocument();
  });

  // AC-7 (High): erişim koşulu sağlanmıyor -> listings sorgusu HİÇ yapılmaz,
  // mesaj + /account/subscription linki.
  it.each([
    [
      "past_due",
      { status: "past_due", current_period_end: FUTURE },
    ],
    [
      "süresi dolmuş active",
      { status: "active", current_period_end: PAST },
    ],
  ])(
    "erişim koşulu sağlanmıyorsa (%s) listings sorgusu yapmaz ve abone-ol linki gösterir",
    async (_label, row) => {
      const { from } = setupSupabase({
        openSub: { data: row, error: null },
      });

      const jsx = await loadPage();
      render(jsx);

      const tables = from.mock.calls.map((call) => call[0]);
      expect(tables).not.toContain("listings");
      expect(
        screen.getByText(/İlanları görmek için aktif abonelik gerekir/),
      ).toBeInTheDocument();
      const link = screen.getByRole("link", { name: /abone olun/i });
      expect(link).toHaveAttribute("href", "/account/subscription");
    },
  );

  // AC-3 (Critical): abonelik yokken zil ve filtreler görünmez (AC-S3 ile birlikte).
  it("abonelik yoksa zil ve filtre formu görünmez", async () => {
    setupSupabase({
      openSub: { data: null, error: null },
      latestSub: { data: null, error: null },
    });

    const jsx = await loadPage();
    const { container } = render(jsx);

    expect(screen.queryByLabelText(/yeni ilan/)).toBeNull();
    expect(container.querySelector("form")).toBeNull();
    expect(screen.getByRole("link", { name: /abone olun/i })).toBeInTheDocument();
  });

  // AC-8 (Medium): erişim var, filtre yok, listings boş -> nötr mesaj, CTA yok.
  it("erişim koşulu sağlanıyor ama listings boşsa 'Şu an gösterilecek ilan yok' mesajını gösterir, CTA göstermez", async () => {
    setupSupabase({
      openSub: {
        data: { status: "trialing", current_period_end: FUTURE },
        error: null,
      },
      listings: { data: [], error: null },
    });

    const jsx = await loadPage();
    render(jsx);

    expect(screen.getByText(/Şu an gösterilecek ilan yok/)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /abone olun/i })).toBeNull();
    expect(
      screen.queryByText(/İlanları görmek için aktif abonelik gerekir/),
    ).toBeNull();
  });

  // AC-1 (Critical): kart alanları — grup adı, fiyat, oda, m², konum, geliş zamanı.
  // AC-11 (Medium): <24 saat göreli, aksi halde "27 Eki 14:05" (Europe/Istanbul).
  it("her kartta grup adı, fiyat, oda, m², konum ve geliş zamanı görünür", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
    setupSupabase({
      openSub: ACTIVE_SUB,
      listings: { data: [LISTING_A, LISTING_B], error: null },
    });

    const jsx = await loadPage();
    render(jsx);

    expect(screen.getAllByText("Grup A").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Grup B").length).toBeGreaterThan(0);
    expect(screen.getByText("2.500.000 TRY")).toBeInTheDocument();
    expect(screen.getByText("9.900.000 TRY")).toBeInTheDocument();
    expect(screen.getByText("3+1")).toBeInTheDocument();
    expect(screen.getByText("120 m²")).toBeInTheDocument();
    expect(screen.getByText("İstanbul / Kadıköy")).toBeInTheDocument();
    expect(screen.getByText("12 dk önce")).toBeInTheDocument();
    expect(screen.getByText("27 Eki 14:05")).toBeInTheDocument();
  });

  // AC-2 (Critical): filtreler server-side uygulanır; sayfa 2 = range(20,39).
  it("query param'ları eq/gte/lte ile uygulanır ve sayfa 2 range(20,39) kullanır", async () => {
    const { listingsQuery } = setupSupabase({
      openSub: ACTIVE_SUB,
      listings: { data: [LISTING_A], error: null },
    });

    const jsx = await loadPage({
      grup: "Grup A",
      fiyat_min: "1000",
      fiyat_max: "5000000",
      oda: "3+1",
      il: "İstanbul",
      ilce: "Kadıköy",
      sayfa: "2",
    });
    render(jsx);

    expect(listingsQuery.eq).toHaveBeenCalledWith("source_group_name", "Grup A");
    expect(listingsQuery.gte).toHaveBeenCalledWith("price", 1000);
    expect(listingsQuery.lte).toHaveBeenCalledWith("price", 5000000);
    expect(listingsQuery.eq).toHaveBeenCalledWith("rooms", "3+1");
    expect(listingsQuery.eq).toHaveBeenCalledWith("city", "İstanbul");
    expect(listingsQuery.eq).toHaveBeenCalledWith("district", "Kadıköy");
    expect(listingsQuery.range).toHaveBeenCalledWith(20, 39);
    expect(listingsQuery.order).toHaveBeenCalledWith("created_at", {
      ascending: false,
    });
  });

  // AC-7 (High): fiyat filtresi aktifken currency='TRY' ve price is not null.
  it("fiyat filtresi aktifken yalnız currency='TRY' ve price is not null ilanlar sorgulanır", async () => {
    const { listingsQuery } = setupSupabase({
      openSub: ACTIVE_SUB,
      listings: { data: [LISTING_A], error: null },
    });

    const jsx = await loadPage({ fiyat_min: "1000" });
    render(jsx);

    expect(listingsQuery.eq).toHaveBeenCalledWith("currency", "TRY");
    expect(listingsQuery.not).toHaveBeenCalledWith("price", "is", null);
  });

  // AC-4 (Critical): listings hatası -> "İlanlar yüklenemedi.", tam log, boş mesajı yok.
  it("listings hata dönerse 'İlanlar yüklenemedi.' gösterir, kodu loglar, boş mesajı göstermez", async () => {
    setupSupabase({
      openSub: ACTIVE_SUB,
      listings: {
        data: null,
        error: { code: "X", message: "db secret detail" },
      },
    });

    const jsx = await loadPage();
    const { container } = render(jsx);

    expect(screen.getByText("İlanlar yüklenemedi.")).toBeInTheDocument();
    expect(errorSpy).toHaveBeenCalledWith("[dashboard] listings query failed", {
      code: "X",
    });
    expect(screen.queryByText("Şu an gösterilecek ilan yok.")).toBeNull();
    expect(screen.queryByText("Filtreye uyan ilan yok.")).toBeNull();
    // AC-S6: DB hata mesajı UI'a sızmaz.
    expect(container.textContent).not.toContain("db secret detail");
  });

  // AC-5 (High): filtreye uyan ilan yok -> "Filtreye uyan ilan yok." + "Filtreleri temizle".
  it("filtre aktifken sonuç boşsa 'Filtreye uyan ilan yok.' ve 'Filtreleri temizle' linki gösterir", async () => {
    setupSupabase({
      openSub: ACTIVE_SUB,
      listings: { data: [], error: null },
    });

    const jsx = await loadPage({ fiyat_min: "1000" });
    render(jsx);

    expect(screen.getByText("Filtreye uyan ilan yok.")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Filtreleri temizle" }),
    ).toHaveAttribute("href", "/agent/dashboard");
    expect(screen.queryByText("Şu an gösterilecek ilan yok.")).toBeNull();
  });

  // AC-5 (High): filtre yokken boş -> "Şu an gösterilecek ilan yok.", temizle linki yok.
  it("filtre yokken sonuç boşsa 'Şu an gösterilecek ilan yok.' gösterir, temizle linki göstermez", async () => {
    setupSupabase({
      openSub: ACTIVE_SUB,
      listings: { data: [], error: null },
    });

    const jsx = await loadPage();
    render(jsx);

    expect(screen.getByText("Şu an gösterilecek ilan yok.")).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Filtreleri temizle" }),
    ).toBeNull();
    expect(screen.queryByText("Filtreye uyan ilan yok.")).toBeNull();
  });

  // AC-6 (High): geçersiz param -> uygulanmaz, not gösterilir.
  it("geçersiz filtre param'ı varsa 'Bazı filtreler geçersizdi, uygulanmadı' notu görünür ve geçerliler uygulanır", async () => {
    const { listingsQuery } = setupSupabase({
      openSub: ACTIVE_SUB,
      listings: { data: [LISTING_A], error: null },
    });

    const jsx = await loadPage({ fiyat_min: "abc", il: "İstanbul" });
    render(jsx);

    expect(
      screen.getByText("Bazı filtreler geçersizdi, uygulanmadı"),
    ).toBeInTheDocument();
    expect(listingsQuery.gte).not.toHaveBeenCalledWith("price", NaN);
    expect(listingsQuery.eq).toHaveBeenCalledWith("city", "İstanbul");
  });

  // AC-6 (High): min > max -> yer değiştirir, not gösterilmez.
  it("min > max ise değerler yer değiştirir ve 'geçersizdi' notu gösterilmez", async () => {
    const { listingsQuery } = setupSupabase({
      openSub: ACTIVE_SUB,
      listings: { data: [LISTING_A], error: null },
    });

    const jsx = await loadPage({ fiyat_min: "5000", fiyat_max: "1000" });
    render(jsx);

    expect(listingsQuery.gte).toHaveBeenCalledWith("price", 1000);
    expect(listingsQuery.lte).toHaveBeenCalledWith("price", 5000);
    expect(
      screen.queryByText("Bazı filtreler geçersizdi, uygulanmadı"),
    ).toBeNull();
  });

  // AC-6 + AC-S4 (High/Critical): allowlist dışı grup/il ve enjeksiyon girdileri.
  it("allowlist dışı grup ve enjeksiyon girdisi filtreye girmez, or()/filter() çağrılmaz", async () => {
    const { listingsQuery } = setupSupabase({
      openSub: ACTIVE_SUB,
      listings: { data: [LISTING_A], error: null },
    });

    const jsx = await loadPage({
      grup: "Olmayan Grup",
      il: "x,city.eq.y)",
      oda: "1+1);drop",
    });
    render(jsx);

    expect(
      screen.getByText("Bazı filtreler geçersizdi, uygulanmadı"),
    ).toBeInTheDocument();
    expect(listingsQuery.eq).not.toHaveBeenCalledWith(
      "source_group_name",
      "Olmayan Grup",
    );
    expect(listingsQuery.or).not.toHaveBeenCalled();
    expect(listingsQuery.filter).not.toHaveBeenCalled();
    for (const call of listingsQuery.eq.mock.calls) {
      expect(JSON.stringify(call)).not.toContain(").");
      expect(JSON.stringify(call)).not.toContain("drop");
    }
  });

  // AC-S5 (High): sayfa üst sınırı 1000'e kırpılır; negatif -> 1; limit istemciden alınmaz.
  it("sayfa=999999999 1000'e kırpılır (range(19980,19999))", async () => {
    const { listingsQuery } = setupSupabase({
      openSub: ACTIVE_SUB,
      listings: { data: [], error: null },
    });

    const jsx = await loadPage({ sayfa: "999999999" });
    render(jsx);

    expect(listingsQuery.range).toHaveBeenCalledWith(19980, 19999);
  });

  it("negatif sayfa 1'e kırpılır ve limit istemciden alınmaz (range(0,19))", async () => {
    const { listingsQuery } = setupSupabase({
      openSub: ACTIVE_SUB,
      listings: { data: [], error: null },
    });

    const jsx = await loadPage({ sayfa: "-4", limit: "5" });
    render(jsx);

    expect(listingsQuery.range).toHaveBeenCalledWith(0, 19);
    expect(listingsQuery.limit).not.toHaveBeenCalledWith(5);
  });

  // AC-8 (High): oda seçenekleri sabit.
  it("oda seçenekleri sabit: 1+0, 1+1, 2+1, 3+1, 4+1, 5+", async () => {
    setupSupabase({
      openSub: ACTIVE_SUB,
      listings: { data: [LISTING_A], error: null },
    });

    const jsx = await loadPage();
    const { container } = render(jsx);

    expect(optionValues(selectFor(container, "oda"))).toEqual([
      "1+0",
      "1+1",
      "2+1",
      "3+1",
      "4+1",
      "5+",
    ]);
  });

  // AC-9 (High): il/ilçe seçenekleri listings'ten distinct; ilçe seçili ile daralır.
  it("il seçenekleri listings'ten distinct gelir", async () => {
    setupSupabase({
      openSub: ACTIVE_SUB,
      listings: { data: [LISTING_A, LISTING_B], error: null },
    });

    const jsx = await loadPage();
    const { container } = render(jsx);

    expect(optionValues(selectFor(container, "il")).sort()).toEqual([
      "İstanbul",
      "İzmir",
    ]);
  });

  it("seçili il varken ilçe seçenekleri yalnız o ile ait ilçelerle daralır", async () => {
    setupSupabase({
      openSub: ACTIVE_SUB,
      listings: { data: [LISTING_A, LISTING_B], error: null },
    });

    const jsx = await loadPage({ il: "İstanbul" });
    const { container } = render(jsx);

    expect(optionValues(selectFor(container, "ilce"))).toEqual(["Kadıköy"]);
  });

  // AC-10 (Critical): null alanlar -> okunabilir metin, hiçbir karta null/NaN/Invalid Date sızmaz.
  it("null alanlı ilanlarda 'Fiyat belirtilmemiş', 'Konum belirtilmemiş', 'Bilinmeyen grup' gösterilir ve 'null'/'NaN'/'Invalid Date' görünmez", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
    const ROW_NULL_PRICE = {
      id: "l-3",
      title: "Eksik Bilgili İlan",
      price: null,
      currency: "TRY",
      rooms: null,
      area_m2: null,
      city: "İzmir",
      district: null,
      source_group_name: null,
      created_at: "2026-10-28T11:50:00.000Z",
    };
    const ROW_NO_LOCATION = {
      id: "l-4",
      title: "Konumsuz İlan",
      price: 1000000,
      currency: "TRY",
      rooms: null,
      area_m2: null,
      city: null,
      district: null,
      source_group_name: "Grup A",
      created_at: "2026-10-28T11:50:00.000Z",
    };
    setupSupabase({
      openSub: ACTIVE_SUB,
      listings: { data: [ROW_NULL_PRICE, ROW_NO_LOCATION], error: null },
    });

    const jsx = await loadPage();
    const { container } = render(jsx);

    expect(screen.getByText("Fiyat belirtilmemiş")).toBeInTheDocument();
    expect(screen.getByText("Bilinmeyen grup")).toBeInTheDocument();
    expect(screen.getByText("Konum belirtilmemiş")).toBeInTheDocument();
    expect(screen.getAllByText("İzmir").length).toBeGreaterThan(0);
    // rooms/area_m2 null -> o parçalar gizlenir.
    expect(screen.queryByText(/m²/)).toBeNull();

    const text = container.textContent ?? "";
    expect(text).not.toMatch(/null/);
    expect(text).not.toMatch(/NaN/);
    expect(text).not.toMatch(/Invalid Date/);
    expect(text).not.toMatch(/undefined/);
  });

  // AC-13 (Critical): sayaç sunucuda hesaplanır ve zilde gösterilir.
  it("yeni ilan sayısı > 0 ise zilde 'N yeni ilan' rozeti gösterilir", async () => {
    setupSupabase({
      openSub: ACTIVE_SUB,
      listings: { data: [LISTING_A], error: null },
      unreadCount: { count: 3, error: null },
    });

    const jsx = await loadPage();
    render(jsx);

    expect(screen.getByLabelText("3 yeni ilan")).toBeInTheDocument();
  });

  it("yeni ilan sayısı 0 ise rozet gösterilmez (9b)", async () => {
    setupSupabase({
      openSub: ACTIVE_SUB,
      listings: { data: [LISTING_A], error: null },
      unreadCount: { count: 0, error: null },
    });

    const jsx = await loadPage();
    render(jsx);

    expect(screen.queryByLabelText(/yeni ilan/)).toBeNull();
  });

  it("yeni ilan sayısı 100 ise rozet '99+' gösterir (9c)", async () => {
    setupSupabase({
      openSub: ACTIVE_SUB,
      listings: { data: [LISTING_A], error: null },
      unreadCount: { count: 100, error: null },
    });

    const jsx = await loadPage();
    render(jsx);

    expect(screen.getByLabelText("99+ yeni ilan")).toBeInTheDocument();
  });

  // AC-16 (High): kısmi başarı — ilanlar geldi, sayaç hata verdi.
  it("sayaç sorgusu hata verirse liste normal görünür, zilde sayı yoktur ve tam log yazılır", async () => {
    setupSupabase({
      openSub: ACTIVE_SUB,
      listings: { data: [LISTING_A], error: null },
      unreadCount: {
        count: null,
        error: { code: "X", message: "secret count detail" },
      },
    });

    const jsx = await loadPage();
    const { container } = render(jsx);

    expect(screen.getByText("Merkezde Güzel Daire")).toBeInTheDocument();
    expect(screen.queryByText("İlanlar yüklenemedi.")).toBeNull();
    expect(screen.queryByLabelText(/yeni ilan/)).toBeNull();
    expect(errorSpy).toHaveBeenCalledWith("[dashboard] unread count failed", {
      code: "X",
    });
    expect(container.textContent).not.toContain("secret count detail");
  });
});
