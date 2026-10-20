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

const FUTURE = "2099-01-01T00:00:00.000Z";
const PAST = "2020-01-01T00:00:00.000Z";

type QueryResult = {
  data: unknown;
  error: { message: string } | null;
};

// Zincirlenebilir (select/eq/order/...) ve await edilebilir bir Supabase sorgusu taklidi.
function makeQuery(result: QueryResult) {
  const query: Record<string, unknown> = {};
  for (const method of [
    "select",
    "eq",
    "neq",
    "in",
    "order",
    "limit",
    "returns",
    "single",
    "maybeSingle",
  ]) {
    query[method] = vi.fn(() => query);
  }
  query.then = (
    resolve: (value: QueryResult) => unknown,
    reject: (reason: unknown) => unknown,
  ) => Promise.resolve(result).then(resolve, reject);
  return query;
}

type SetupOptions = {
  // subscriptions tablosunda ilk sorgu: açık (trialing/active/past_due) satır
  openSub?: QueryResult;
  // subscriptions tablosunda ikinci sorgu: en son satır (fallback)
  latestSub?: QueryResult;
  // listings tablosu sorgusu
  listings?: QueryResult;
  userId?: string | null;
};

function setupSupabase({
  openSub = { data: null, error: null },
  latestSub = { data: null, error: null },
  listings = { data: [], error: null },
  userId = "user-1",
}: SetupOptions = {}) {
  const openSubQuery = makeQuery(openSub);
  const latestSubQuery = makeQuery(latestSub);
  const listingsQuery = makeQuery(listings);

  let subscriptionCalls = 0;
  const from = vi.fn((table: string) => {
    if (table === "subscriptions") {
      subscriptionCalls += 1;
      return subscriptionCalls === 1 ? openSubQuery : latestSubQuery;
    }
    if (table === "listings") return listingsQuery;
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
  return { from, openSubQuery, latestSubQuery, listingsQuery };
}

describe("AgentDashboardPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  // AC-S1 (Critical): oturum yoksa /login'e yönlendirilir, sayfa içeriği render edilmez.
  it("oturum yoksa redirect('/login') çağırır ve subscriptions/listings sorgusu yapmaz", async () => {
    const { from } = setupSupabase({ userId: null });

    await expect(Page()).rejects.toThrow();

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

      const jsx = await Page();
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

    const jsx = await Page();
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

    const jsx = await Page();
    render(jsx);

    expect(screen.getByText(/Aboneliğiniz yok/)).toBeInTheDocument();
  });

  // AC-6 (Critical): erişim koşulu sağlanıyor -> listings render edilir,
  // order(created_at desc) + limit(20) uygulanır.
  it("erişim koşulu sağlanıyorsa listings kayıtlarını (title/price/city/district) render eder ve doğru sorgu zincirini kullanır", async () => {
    const { from, listingsQuery } = setupSupabase({
      openSub: {
        data: { status: "active", current_period_end: FUTURE },
        error: null,
      },
      listings: {
        data: [
          {
            id: "l-1",
            title: "Merkezde Güzel Daire",
            price: 2500000,
            currency: "TRY",
            rooms: "3+1",
            area_m2: 120,
            city: "İstanbul",
            district: "Kadıköy",
          },
          {
            id: "l-2",
            title: "Deniz Manzaralı Villa",
            price: 9900000,
            currency: "TRY",
            rooms: "5+2",
            area_m2: 300,
            city: "İzmir",
            district: "Çeşme",
          },
        ],
        error: null,
      },
    });

    const jsx = await Page();
    render(jsx);

    expect(from).toHaveBeenCalledWith("listings");
    expect(listingsQuery.select).toHaveBeenCalled();
    expect(listingsQuery.order).toHaveBeenCalledWith("created_at", {
      ascending: false,
    });
    expect(listingsQuery.limit).toHaveBeenCalledWith(20);

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

      const jsx = await Page();
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

  // AC-8 (Medium): erişim var, listings boş -> nötr mesaj, CTA yok.
  it("erişim koşulu sağlanıyor ama listings boşsa 'Şu an gösterilecek ilan yok' mesajını gösterir, CTA göstermez", async () => {
    setupSupabase({
      openSub: {
        data: { status: "trialing", current_period_end: FUTURE },
        error: null,
      },
      listings: { data: [], error: null },
    });

    const jsx = await Page();
    render(jsx);

    expect(screen.getByText(/Şu an gösterilecek ilan yok/)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /abone olun/i })).toBeNull();
    expect(
      screen.queryByText(/İlanları görmek için aktif abonelik gerekir/),
    ).toBeNull();
  });
});
