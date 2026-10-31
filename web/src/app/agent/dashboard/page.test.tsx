// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { redirect } from "next/navigation";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { fetchFeed } from "@/lib/listings-feed/query";
import { createClient } from "@/lib/supabase/server";

import Page from "./page";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

// fetchFeed kısmi mock: varsayılan olarak gerçek uygulamaya devreder (RPC mock'u üzerinden
// çalışır); EML-98 testleri mockResolvedValueOnce ile sonucu doğrudan belirler.
vi.mock("@/lib/listings-feed/query", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/listings-feed/query")>();
  return { ...actual, fetchFeed: vi.fn(actual.fetchFeed) };
});

// Gerçek Next.js'te redirect() her zaman fırlatır; bu mock bunu simüle eder.
vi.mock("next/navigation", () => ({
  redirect: vi.fn(() => {
    throw new Error("NEXT_REDIRECT");
  }),
}));

// connection() istek kapsamı dışında throw eder; testte no-op'a çevrilir.
vi.mock("next/server", async (orig) => ({
  ...(await orig<typeof import("next/server")>()),
  connection: vi.fn(async () => {}),
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

// Zincirlenebilir (select/eq/order/...) ve await edilebilir tablo sorgusu taklidi.
// Yalnız subscriptions/agents tablosu için kullanılır; listings'e doğrudan erişim YOK (AC-S1).
const CHAIN_METHODS = [
  "select",
  "eq",
  "in",
  "order",
  "limit",
  "maybeSingle",
  "single",
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

// PostgREST rpc builder taklidi: abortSignal zincirlenir, await edilince sonuç döner
// (start_trial gibi abortSignal'siz çağrılar için de await çalışır).
function makeRpcBuilder(result: QueryResult | Error) {
  const builder: Record<string, unknown> = {};
  builder.abortSignal = vi.fn(() => builder);
  builder.then = (
    resolve: (value: QueryResult) => unknown,
    reject: (reason: unknown) => unknown,
  ) => {
    if (result instanceof Error) {
      return Promise.reject(result).then(resolve, reject);
    }
    return Promise.resolve(result).then(resolve, reject);
  };
  return builder as { abortSignal: ReturnType<typeof vi.fn> } & Record<string, unknown>;
}

// Sunucu filtre seçenekleri (feed_filter_options): il verilirse ilçeler o ile daralır.
const DISTRICTS_BY_CITY: Record<string, string[]> = {
  "İstanbul": ["Kadıköy"],
  "İzmir": ["Çeşme"],
};

function defaultOptions(il: string | null) {
  return {
    cities: ["İstanbul", "İzmir"],
    districts: il ? (DISTRICTS_BY_CITY[il] ?? []) : ["Kadıköy", "Çeşme"],
    groups: ["Grup A", "Grup B"],
  };
}

// feed_listings RPC gövdesi: { items, locked_count, limit, open_today, reason? }.
function feedData(
  items: unknown[] = [],
  extra: { locked_count?: number; limit?: number | null; open_today?: number; reason?: string } = {},
): QueryResult {
  return {
    data: {
      items,
      locked_count: 0,
      limit: null,
      open_today: items.length,
      ...extra,
    },
    error: null,
  };
}

type SetupOptions = {
  // subscriptions tablosunda ilk sorgu: açık (trialing/active/past_due) satır
  openSub?: QueryResult;
  // subscriptions tablosunda ikinci sorgu: en son satır (fallback)
  latestSub?: QueryResult;
  // feed_listings RPC sonucu
  feed?: QueryResult;
  // feed_filter_options RPC sonucu (verilmezse p_il'e göre varsayılan seçenekler)
  options?: QueryResult;
  // feed_unread_count RPC sonucu (sayaç)
  unreadCount?: QueryResult;
  // agents.listings_seen_at
  seenAt?: string | null;
  // agents.trial_started_at (null = deneme hiç başlatılmadı)
  trialStartedAt?: string | null;
  // start_trial() RPC sonucu
  rpcResult?: QueryResult;
  userId?: string | null;
};

function setupSupabase({
  openSub = { data: null, error: null },
  latestSub = { data: null, error: null },
  feed = feedData([]),
  options,
  unreadCount = { data: 0, error: null },
  seenAt = null,
  trialStartedAt = null,
  rpcResult = { data: true, error: null },
  userId = "user-1",
}: SetupOptions = {}) {
  const openSubQuery = makeQuery(openSub);
  const latestSubQuery = makeQuery(latestSub);
  const agentsQuery = makeQuery({
    data: { listings_seen_at: seenAt, trial_started_at: trialStartedAt },
    error: null,
  });

  let subscriptionCalls = 0;
  const from = vi.fn((table: string) => {
    if (table === "subscriptions") {
      subscriptionCalls += 1;
      return subscriptionCalls === 1 ? openSubQuery : latestSubQuery;
    }
    if (table === "agents") return agentsQuery;
    throw new Error(`Beklenmeyen tablo: ${table}`);
  });

  // RPC'ler ada göre yönlendirilir: feed_listings / feed_filter_options /
  // feed_unread_count ve geri kalan (start_trial) için ayrı sonuçlar.
  const rpc = vi.fn((name: string, args?: unknown) => {
    switch (name) {
      case "feed_listings":
        return makeRpcBuilder(feed);
      case "feed_filter_options":
        return makeRpcBuilder(
          options ?? {
            data: defaultOptions((args as { p_il?: string | null } | undefined)?.p_il ?? null),
            error: null,
          },
        );
      case "feed_unread_count":
        return makeRpcBuilder(unreadCount);
      default:
        return makeRpcBuilder(rpcResult);
    }
  });

  const supabase = {
    from,
    rpc,
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: userId ? { id: userId } : null },
        error: null,
      }),
    },
  };
  vi.mocked(createClient).mockResolvedValue(supabase as never);
  return { from, rpc, openSubQuery, latestSubQuery, agentsQuery };
}

// Belirli bir RPC'nin ilk çağrısının argümanları (yoksa undefined).
function rpcArgs(rpc: ReturnType<typeof vi.fn>, name: string) {
  const call = rpc.mock.calls.find((c) => c[0] === name);
  return call?.[1] as Record<string, unknown> | undefined;
}

// Sayfa, Next 16 kuralıyla searchParams'ı Promise olarak alır.
async function loadPage(params: Record<string, string | undefined> = {}) {
  return Page({ searchParams: Promise.resolve(params) } as never);
}

const ACTIVE_SUB = {
  data: { status: "active", current_period_end: FUTURE },
  error: null,
};

// Sunucu açık satır şekli: AC-1 alanları + locked:false.
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
  locked: false,
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
  locked: false,
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
  it("oturum yoksa redirect('/login') çağırır ve subscriptions/feed RPC'si yapmaz", async () => {
    const { from, rpc } = setupSupabase({ userId: null });

    await expect(loadPage()).rejects.toThrow();

    expect(redirect).toHaveBeenCalledWith("/login");
    const tables = from.mock.calls.map((call) => call[0]);
    expect(tables).not.toContain("subscriptions");
    expect(tables).not.toContain("listings");
    expect(rpc).not.toHaveBeenCalled();
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

  // AC-1 + AC-2 (Critical): erişim var -> feed_listings RPC'si sayfa 1 ile çağrılır,
  // kart alanları render edilir. (Eski: from('listings') + order/range zinciri.)
  it("erişim koşulu sağlanıyorsa feed_listings RPC'sini p_page=1 ile çağırır ve kayıtları render eder", async () => {
    const { from, rpc } = setupSupabase({
      openSub: ACTIVE_SUB,
      feed: feedData([LISTING_A, LISTING_B]),
    });

    const jsx = await loadPage();
    render(jsx);

    expect(from.mock.calls.map((c) => c[0])).not.toContain("listings");
    expect(rpc).toHaveBeenCalledWith("feed_listings", {
      p_filters: {
        il: null,
        ilce: null,
        grup: null,
        fiyatMin: null,
        fiyatMax: null,
        oda: null,
      },
      p_page: 1,
    });

    expect(screen.getByText(/Merkezde Güzel Daire/)).toBeInTheDocument();
    expect(screen.getByText(/Deniz Manzaralı Villa/)).toBeInTheDocument();
    expect(screen.getAllByText(/İstanbul/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Kadıköy/).length).toBeGreaterThan(0);
    expect(screen.getByText(/2[.,]?500[.,]?000/)).toBeInTheDocument();
  });

  // AC-7 (High): erişim koşulu sağlanmıyor (dönem bitmiş) -> feed RPC'si HİÇ çağrılmaz,
  // mesaj + /account/subscription linki. (past_due artık erişimli; bkz. EML-99 testleri.)
  it.each([
    [
      "süresi dolmuş active",
      { status: "active", current_period_end: PAST },
    ],
  ])(
    "erişim koşulu sağlanmıyorsa (%s) feed RPC'si yapmaz ve abone-ol linki gösterir",
    async (_label, row) => {
      const { from, rpc } = setupSupabase({
        openSub: { data: row, error: null },
      });

      const jsx = await loadPage();
      render(jsx);

      const tables = from.mock.calls.map((call) => call[0]);
      expect(tables).not.toContain("listings");
      expect(rpc).not.toHaveBeenCalledWith("feed_listings", expect.anything());
      expect(
        screen.getByText(/İlanları görmek için aktif abonelik gerekir/),
      ).toBeInTheDocument();
      const link = screen.getByRole("link", { name: /abone olun/i });
      expect(link).toHaveAttribute("href", "/account/subscription");
    },
  );

  // Şifre yenileme sonrası (/sifre-yenile -> ?password_updated=1) bilgi kutusu.
  it("password_updated=1 ile role=status 'Şifreniz güncellendi.' kutusu görünür", async () => {
    setupSupabase({
      openSub: ACTIVE_SUB,
      feed: feedData([]),
    });

    const jsx = await loadPage({ password_updated: "1" });
    render(jsx);

    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("Şifreniz güncellendi.");
  });

  it("password_updated parametresi yoksa 'Şifreniz güncellendi.' kutusu görünmez", async () => {
    setupSupabase({
      openSub: ACTIVE_SUB,
      feed: feedData([]),
    });

    const jsx = await loadPage();
    render(jsx);

    expect(screen.queryByText("Şifreniz güncellendi.")).toBeNull();
  });

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

  // AC-8 (Medium): erişim var, filtre yok, feed boş -> nötr mesaj, CTA yok.
  it("erişim koşulu sağlanıyor ama feed boşsa 'Şu an gösterilecek ilan yok' mesajını gösterir, CTA göstermez", async () => {
    setupSupabase({
      openSub: {
        data: { status: "trialing", current_period_end: FUTURE },
        error: null,
      },
      feed: feedData([]),
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
      feed: feedData([LISTING_A, LISTING_B]),
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

  // AC-2 (Critical): filtreler p_filters içinde RPC'ye iletilir; sayfa 2 -> p_page=2.
  // (Eski: eq/gte/lte + range(20,39) + order created_at desc; artık sunucu uygular.)
  it("query param'ları p_filters ile iletilir ve sayfa 2 p_page=2 olarak gönderilir", async () => {
    const { rpc } = setupSupabase({
      openSub: ACTIVE_SUB,
      feed: feedData([LISTING_A]),
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

    expect(rpc).toHaveBeenCalledWith("feed_listings", {
      p_filters: {
        il: "İstanbul",
        ilce: "Kadıköy",
        grup: "Grup A",
        fiyatMin: 1000,
        fiyatMax: 5000000,
        oda: "3+1",
      },
      p_page: 2,
    });
  });

  // AC-7 (High): fiyat filtresi p_filters.fiyatMin ile iletilir. Eski istemci tarafı
  // currency='TRY' ve price is not null kuralı artık sunucu RPC'sinde uygulanır;
  // istemci listings tablosuna doğrudan sorgu atmaz.
  it("fiyat filtresi p_filters.fiyatMin olarak gider; istemci listings'e doğrudan sorgu atmaz", async () => {
    const { from, rpc } = setupSupabase({
      openSub: ACTIVE_SUB,
      feed: feedData([LISTING_A]),
    });

    const jsx = await loadPage({ fiyat_min: "1000" });
    render(jsx);

    expect(rpcArgs(rpc, "feed_listings")).toEqual({
      p_filters: expect.objectContaining({ fiyatMin: 1000, fiyatMax: null }),
      p_page: 1,
    });
    expect(from.mock.calls.map((c) => c[0])).not.toContain("listings");
  });

  // AC-4 (Critical): feed RPC hatası -> "İlanlar yüklenemedi.", tam log, boş mesajı yok.
  it("feed RPC hata dönerse 'İlanlar yüklenemedi.' gösterir, kodu loglar, boş mesajı göstermez", async () => {
    setupSupabase({
      openSub: ACTIVE_SUB,
      feed: {
        data: null,
        error: { code: "X", message: "db secret detail" },
      },
    });

    const jsx = await loadPage();
    const { container } = render(jsx);

    expect(screen.getByText("İlanlar yüklenemedi.")).toBeInTheDocument();
    expect(errorSpy).toHaveBeenCalledWith("[dashboard] feed rpc failed", {
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
      feed: feedData([]),
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
      feed: feedData([]),
    });

    const jsx = await loadPage();
    render(jsx);

    expect(screen.getByText("Şu an gösterilecek ilan yok.")).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Filtreleri temizle" }),
    ).toBeNull();
    expect(screen.queryByText("Filtreye uyan ilan yok.")).toBeNull();
  });

  // AC-6 (High): geçersiz param -> p_filters'a girmez, not gösterilir.
  it("geçersiz filtre param'ı varsa 'Bazı filtreler geçersizdi, uygulanmadı' notu görünür ve geçerliler uygulanır", async () => {
    const { rpc } = setupSupabase({
      openSub: ACTIVE_SUB,
      feed: feedData([LISTING_A]),
    });

    const jsx = await loadPage({ fiyat_min: "abc", il: "İstanbul" });
    render(jsx);

    expect(
      screen.getByText("Bazı filtreler geçersizdi, uygulanmadı"),
    ).toBeInTheDocument();
    const args = rpcArgs(rpc, "feed_listings") as { p_filters: Record<string, unknown> };
    expect(args.p_filters.fiyatMin).toBeNull();
    expect(Number.isNaN(args.p_filters.fiyatMin)).toBe(false);
    expect(args.p_filters.il).toBe("İstanbul");
  });

  // AC-6 (High): min > max -> yer değiştirir, not gösterilmez.
  it("min > max ise p_filters'ta değerler yer değiştirir ve 'geçersizdi' notu gösterilmez", async () => {
    const { rpc } = setupSupabase({
      openSub: ACTIVE_SUB,
      feed: feedData([LISTING_A]),
    });

    const jsx = await loadPage({ fiyat_min: "5000", fiyat_max: "1000" });
    render(jsx);

    expect(rpcArgs(rpc, "feed_listings")).toEqual({
      p_filters: expect.objectContaining({ fiyatMin: 1000, fiyatMax: 5000 }),
      p_page: 1,
    });
    expect(
      screen.queryByText("Bazı filtreler geçersizdi, uygulanmadı"),
    ).toBeNull();
  });

  // AC-6 + AC-S4 (High/Critical): allowlist dışı grup/il ve enjeksiyon girdileri.
  // Eski: or()/filter() çağrılmaz. Yeni: enjeksiyon girdisi p_filters'a hiç girmez.
  it("allowlist dışı grup ve enjeksiyon girdisi p_filters'a girmez", async () => {
    const { rpc, from } = setupSupabase({
      openSub: ACTIVE_SUB,
      feed: feedData([LISTING_A]),
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
    const args = rpcArgs(rpc, "feed_listings") as { p_filters: Record<string, unknown> };
    expect(args.p_filters.grup).toBeNull();
    expect(args.p_filters.il).toBeNull();
    expect(args.p_filters.oda).toBeNull();
    const serialized = JSON.stringify(rpc.mock.calls);
    expect(serialized).not.toContain(").");
    expect(serialized).not.toContain("drop");
    expect(serialized).not.toContain("Olmayan Grup");
    expect(from.mock.calls.map((c) => c[0])).not.toContain("listings");
  });

  // AC-S5 (High): sayfa üst sınırı 1000'e kırpılır (eski range(19980,19999) -> p_page 1000).
  it("sayfa=999999999 1000'e kırpılır (p_page=1000)", async () => {
    const { rpc } = setupSupabase({
      openSub: ACTIVE_SUB,
      feed: feedData([]),
    });

    const jsx = await loadPage({ sayfa: "999999999" });
    render(jsx);

    expect(rpcArgs(rpc, "feed_listings")).toMatchObject({ p_page: 1000 });
  });

  // Negatif sayfa 1'e kırpılır; limit istemciden p_filters'a/p_page'e alınmaz.
  it("negatif sayfa 1'e kırpılır (p_page=1) ve limit istemciden alınmaz", async () => {
    const { rpc } = setupSupabase({
      openSub: ACTIVE_SUB,
      feed: feedData([]),
    });

    const jsx = await loadPage({ sayfa: "-4", limit: "5" });
    render(jsx);

    const args = rpcArgs(rpc, "feed_listings") as Record<string, unknown>;
    expect(args.p_page).toBe(1);
    expect(Object.keys(args.p_filters as object)).not.toContain("limit");
    expect(JSON.stringify(args)).not.toContain("5");
  });

  // AC-8 (High): oda seçenekleri sabit.
  it("oda seçenekleri sabit: 1+0, 1+1, 2+1, 3+1, 4+1, 5+", async () => {
    setupSupabase({
      openSub: ACTIVE_SUB,
      feed: feedData([LISTING_A]),
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

  // AC-9 (High): il/ilçe seçenekleri feed_filter_options RPC'sinden gelir (p_il=null).
  it("il seçenekleri feed_filter_options RPC'sinden gelir (p_il: null)", async () => {
    const { rpc } = setupSupabase({
      openSub: ACTIVE_SUB,
      feed: feedData([LISTING_A, LISTING_B]),
    });

    const jsx = await loadPage();
    const { container } = render(jsx);

    expect(rpc).toHaveBeenCalledWith("feed_filter_options", { p_il: null });
    expect(optionValues(selectFor(container, "il")).sort()).toEqual([
      "İstanbul",
      "İzmir",
    ]);
  });

  // AC-9: seçili il, RPC'ye p_il olarak gider; ilçe seçenekleri sunucudan daralmış gelir.
  it("seçili il varken feed_filter_options p_il ile çağrılır ve ilçe seçenekleri yalnız o ile ait ilçelerle daralır", async () => {
    const { rpc } = setupSupabase({
      openSub: ACTIVE_SUB,
      feed: feedData([LISTING_A, LISTING_B]),
    });

    const jsx = await loadPage({ il: "İstanbul" });
    const { container } = render(jsx);

    expect(rpc).toHaveBeenCalledWith("feed_filter_options", { p_il: "İstanbul" });
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
      locked: false,
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
      locked: false,
    };
    setupSupabase({
      openSub: ACTIVE_SUB,
      feed: feedData([ROW_NULL_PRICE, ROW_NO_LOCATION]),
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

  // AC-13 (Critical): sayaç feed_unread_count RPC'sinde hesaplanır ve zilde gösterilir.
  it("yeni ilan sayısı > 0 ise zilde 'N yeni ilan' rozeti gösterilir", async () => {
    const { rpc } = setupSupabase({
      openSub: ACTIVE_SUB,
      feed: feedData([LISTING_A]),
      unreadCount: { data: 3, error: null },
    });

    const jsx = await loadPage();
    render(jsx);

    expect(rpc).toHaveBeenCalledWith("feed_unread_count", {
      p_since: expect.any(String),
    });
    expect(screen.getByLabelText("3 yeni ilan")).toBeInTheDocument();
  });

  it("yeni ilan sayısı 0 ise rozet gösterilmez (9b)", async () => {
    setupSupabase({
      openSub: ACTIVE_SUB,
      feed: feedData([LISTING_A]),
      unreadCount: { data: 0, error: null },
    });

    const jsx = await loadPage();
    render(jsx);

    expect(screen.queryByLabelText(/yeni ilan/)).toBeNull();
  });

  it("yeni ilan sayısı 100 ise rozet '99+' gösterir (9c)", async () => {
    setupSupabase({
      openSub: ACTIVE_SUB,
      feed: feedData([LISTING_A]),
      unreadCount: { data: 100, error: null },
    });

    const jsx = await loadPage();
    render(jsx);

    expect(screen.getByLabelText("99+ yeni ilan")).toBeInTheDocument();
  });

  // AC-16 (High): kısmi başarı — ilanlar geldi, sayaç RPC'si hata verdi.
  it("sayaç RPC'si hata verirse liste normal görünür, zilde sayı yoktur ve tam log yazılır", async () => {
    setupSupabase({
      openSub: ACTIVE_SUB,
      feed: feedData([LISTING_A]),
      unreadCount: {
        data: null,
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

  // AC-6 (High): kısmi başarı sonrası dashboard ilk yüklemede start_trial()'ı tekrar dener.
  it("abonelik yok ve trial_started_at null ise rpc('start_trial') argümansız çağrılır", async () => {
    const { rpc } = setupSupabase({
      openSub: { data: null, error: null },
      latestSub: { data: null, error: null },
      trialStartedAt: null,
      rpcResult: { data: true, error: null },
    });

    const jsx = await loadPage();
    render(jsx);

    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("start_trial");
  });

  // AC-6 (High): RPC hatası -> uyarı + fiyat sayfası linki; hata detayı UI'a sızmaz.
  it("start_trial() hata dönerse 'Denemeniz başlatılamadı, destekle iletişime geçin' uyarısı ve /pricing linki gösterir", async () => {
    setupSupabase({
      openSub: { data: null, error: null },
      latestSub: { data: null, error: null },
      trialStartedAt: null,
      rpcResult: { data: null, error: { code: "P0001", message: "plan secret detail" } },
    });

    const jsx = await loadPage();
    const { container } = render(jsx);

    expect(
      screen.getByText("Denemeniz başlatılamadı, destekle iletişime geçin"),
    ).toBeInTheDocument();
    expect(container.querySelector('a[href="/pricing"]')).not.toBeNull();
    expect(errorSpy).toHaveBeenCalledWith(
      "trial_create_failed",
      expect.objectContaining({ agent_id: "user-1" }),
    );
    expect(container.textContent).not.toContain("plan secret detail");
  });

  // AC-6: RPC başarılıysa uyarı gösterilmez.
  it("start_trial() true dönerse 'Denemeniz başlatılamadı' uyarısı gösterilmez", async () => {
    setupSupabase({
      openSub: { data: null, error: null },
      latestSub: { data: null, error: null },
      trialStartedAt: null,
      rpcResult: { data: true, error: null },
    });

    const jsx = await loadPage();
    render(jsx);

    expect(screen.queryByText(/Denemeniz başlatılamadı/)).toBeNull();
  });

  // AC-5 (High): deneme zaten kullanılmış (trial_started_at dolu) -> start_trial çağrılmaz.
  it("trial_started_at dolu ise start_trial() çağrılmaz", async () => {
    const { rpc } = setupSupabase({
      openSub: { data: null, error: null },
      latestSub: { data: null, error: null },
      trialStartedAt: "2026-10-01T00:00:00.000Z",
    });

    const jsx = await loadPage();
    render(jsx);

    expect(rpc).not.toHaveBeenCalled();
  });

  // AC-5: açık abonelik varsa start_trial() çağrılmaz (feed RPC'si çağrılabilir).
  it("açık abonelik varsa start_trial() çağrılmaz", async () => {
    const { rpc } = setupSupabase({
      openSub: ACTIVE_SUB,
      trialStartedAt: null,
    });

    const jsx = await loadPage();
    render(jsx);

    expect(rpc).not.toHaveBeenCalledWith("start_trial");
  });
});

// EML-98 (faz2b-plan-limitleri): günlük ilan limiti. fetchFeed sözleşmesi (plan.md):
// {ok:true, items, lockedCount, limit, openToday, reason?} | {ok:false, code}.
// Kilitli satır yalnız {id, city, district, created_at, locked:true} taşır (AC-S2).
const OPEN_ITEMS = [
  { ...LISTING_A, locked: false },
  { ...LISTING_B, locked: false },
];

const LOCKED_ITEM = {
  id: "l-9",
  city: "İstanbul",
  district: "Ataşehir",
  created_at: "2026-10-28T10:00:00.000Z",
  locked: true,
};

function feedOk(overrides: {
  items?: unknown[];
  lockedCount?: number;
  limit?: number | null;
  openToday?: number;
}) {
  return {
    ok: true,
    items: overrides.items ?? OPEN_ITEMS,
    lockedCount: overrides.lockedCount ?? 0,
    limit: overrides.limit === undefined ? 10 : overrides.limit,
    openToday: overrides.openToday ?? 0,
  };
}

describe("AgentDashboardPage — günlük ilan limiti (EML-98)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  // AC-5 (High): limitli plan, kilit yok -> gösterge "Bugün X/N ilan açık", CTA yok.
  it("limit 10, openToday 7, lockedCount 0 iken 'Bugün 7/10 ilan açık' gösterir ve 'Planı yükselt' göstermez", async () => {
    setupSupabase({ openSub: ACTIVE_SUB });
    vi.mocked(fetchFeed).mockResolvedValueOnce(
      feedOk({ limit: 10, openToday: 7, lockedCount: 0 }) as never,
    );

    const jsx = await loadPage();
    render(jsx);

    expect(screen.getByText("Bugün 7/10 ilan açık")).toBeInTheDocument();
    expect(screen.queryByText("Planı yükselt")).toBeNull();
    expect(screen.queryByRole("link", { name: "Planı yükselt" })).toBeNull();
  });

  // AC-4 + AC-5 (High): limit aşıldı -> gösterge + kilitli kartlar + "Planı yükselt" → /pricing.
  it("limit 10, openToday 10, lockedCount 4 iken gösterge ve 'Planı yükselt' (/pricing) görünür", async () => {
    setupSupabase({ openSub: ACTIVE_SUB });
    vi.mocked(fetchFeed).mockResolvedValueOnce(
      feedOk({
        items: [...OPEN_ITEMS, LOCKED_ITEM],
        limit: 10,
        openToday: 10,
        lockedCount: 4,
      }) as never,
    );

    const jsx = await loadPage();
    render(jsx);

    expect(screen.getByText("Bugün 10/10 ilan açık")).toBeInTheDocument();
    const links = screen.getAllByRole("link", { name: "Planı yükselt" });
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) {
      expect(link).toHaveAttribute("href", "/pricing");
    }
  });

  // AC-3 (Critical): sınırsız plan (limit null) -> gösterge gizlenir, CTA yok.
  it("limit null iken 'ilan açık' göstergesi ve 'Planı yükselt' görünmez", async () => {
    setupSupabase({ openSub: ACTIVE_SUB });
    vi.mocked(fetchFeed).mockResolvedValueOnce(
      feedOk({ limit: null, openToday: 23, lockedCount: 0 }) as never,
    );

    const jsx = await loadPage();
    render(jsx);

    expect(screen.queryByText(/ilan açık/)).toBeNull();
    expect(screen.queryByText(/Bugün 23\/\d+/)).toBeNull();
    expect(screen.queryByRole("link", { name: "Planı yükselt" })).toBeNull();
  });

  // AC-9 (Medium): RPC hatası -> "İlanlar yüklenemedi" + "Tekrar dene".
  it("fetchFeed {ok:false} dönerse 'İlanlar yüklenemedi' ve 'Tekrar dene' gösterir", async () => {
    setupSupabase({ openSub: ACTIVE_SUB });
    vi.mocked(fetchFeed).mockResolvedValueOnce({
      ok: false,
      code: "TimeoutError",
    } as never);

    const jsx = await loadPage();
    render(jsx);

    expect(screen.getByText(/İlanlar yüklenemedi/)).toBeInTheDocument();
    expect(screen.getByText(/Tekrar dene/)).toBeInTheDocument();
  });
});

// EML-99 / AC-6: ödemesi gecikmiş (past_due) abone kendi planının günlük limitiyle
// ilan akışını görmeye devam eder. Erişim kararı feed_access() ile sunucuda verilir.
describe("AgentDashboardPage — past_due erişimi (EML-99)", () => {
  const PAST_DUE_SUB = {
    data: { status: "past_due", current_period_end: FUTURE },
    error: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("past_due + limit 10 iken akış ve 'Bugün X/10 ilan açık' görünür, aboneliksiz ekran görünmez", async () => {
    setupSupabase({
      openSub: PAST_DUE_SUB,
    });
    vi.mocked(fetchFeed).mockResolvedValueOnce(
      feedOk({ limit: 10, openToday: 3, lockedCount: 0 }) as never,
    );

    const jsx = await loadPage();
    render(jsx);

    expect(fetchFeed).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Ödeme gecikmiş")).toBeInTheDocument();
    expect(screen.getByText("Merkezde Güzel Daire")).toBeInTheDocument();
    expect(screen.getByText("Bugün 3/10 ilan açık")).toBeInTheDocument();
    expect(
      screen.queryByText(/İlanları görmek için aktif abonelik gerekir/),
    ).toBeNull();
    expect(screen.queryByRole("link", { name: /abone olun/i })).toBeNull();
  });

  it("past_due + limit 10 ve kilitli ilan varken 'Planı yükselt' (/pricing) görünür", async () => {
    setupSupabase({ openSub: PAST_DUE_SUB });
    vi.mocked(fetchFeed).mockResolvedValueOnce(
      feedOk({
        items: [...OPEN_ITEMS, LOCKED_ITEM],
        limit: 10,
        openToday: 10,
        lockedCount: 2,
      }) as never,
    );

    const jsx = await loadPage();
    render(jsx);

    expect(screen.getByText("Bugün 10/10 ilan açık")).toBeInTheDocument();
    const links = screen.getAllByRole("link", { name: "Planı yükselt" });
    for (const link of links) {
      expect(link).toHaveAttribute("href", "/pricing");
    }
  });

  it("sunucu reason='no_subscription' dönerse past_due satırında bile erişim ekranı gösterilir ve liste gizlenir", async () => {
    setupSupabase({ openSub: PAST_DUE_SUB });
    vi.mocked(fetchFeed).mockResolvedValueOnce({
      ok: true,
      items: [],
      lockedCount: 0,
      limit: 0,
      openToday: 0,
      reason: "no_subscription",
    } as never);

    const jsx = await loadPage();
    render(jsx);

    expect(
      screen.getByText(/İlanları görmek için aktif abonelik gerekir/),
    ).toBeInTheDocument();
    expect(screen.queryByText("Bugün 0/0 ilan açık")).toBeNull();
    expect(screen.queryByText("Merkezde Güzel Daire")).toBeNull();
  });
});
