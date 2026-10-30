// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createClient } from "@/lib/supabase/server";

import Page from "./page";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

type QueryResult = {
  data: unknown;
  error: { message: string; code?: string } | null;
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

const PLANS = [
  { id: "plan-free", name: "Free", price_minor_unit: 0, sort_order: 1 },
  { id: "plan-start", name: "Başlangıç", price_minor_unit: 29900, sort_order: 2 },
  { id: "plan-pro", name: "Pro", price_minor_unit: 59900, sort_order: 3 },
];

// Sabit "şimdi": 2026-10-28 12:00 UTC.
const NOW = new Date("2026-10-28T12:00:00.000Z");
// NOW + 9,5 gün -> yukarı yuvarlanınca "10 gün kaldı".
const TRIAL_END_FUTURE = "2026-11-07T00:00:00.000Z";
const TRIAL_END_PAST = "2026-10-20T00:00:00.000Z";
const ACTIVE_END_FUTURE = "2026-11-28T00:00:00.000Z";

const AC8_TEXT =
  "14 gün ücretsiz. Kredi kartı istemiyoruz. Deneme bitince hesabınız kendiliğinden ücretlendirilmez. Devam etmek isterseniz bir plan seçip ödeme yaparsınız. Ödeme yapmazsanız erişiminiz duraklar, verileriniz silinmez.";

type SetupOptions = {
  plans: QueryResult;
  subscriptions?: QueryResult;
  // undefined -> giriş yapmış kullanıcı (user-1); null -> girişsiz ziyaretçi.
  user?: { id: string } | null;
};

function setupSupabase(opts: SetupOptions) {
  const plansQuery = makeQuery(opts.plans);
  const subscriptionsQuery = makeQuery(
    opts.subscriptions ?? { data: null, error: null },
  );
  const from = vi.fn((table: string) => {
    if (table === "plans") return plansQuery;
    if (table === "subscriptions") return subscriptionsQuery;
    throw new Error(`Beklenmeyen tablo: ${table}`);
  });
  const user = opts.user === undefined ? { id: "user-1" } : opts.user;
  const supabase = {
    from,
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user },
        error: null,
      }),
    },
  };
  vi.mocked(createClient).mockResolvedValue(supabase as never);
  return { from, subscriptionsQuery };
}

function expectNoSatinAlText() {
  expect(screen.queryByText(/Satın Al/i)).toBeNull();
}

describe("PricingPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("plan listesini DB'den okur ve her planın adını ve fiyatını gösterir", async () => {
    const { from } = setupSupabase({
      plans: { data: PLANS, error: null },
    });

    const jsx = await Page();
    render(jsx);

    expect(from).toHaveBeenCalledWith("plans");
    expect(screen.getByText(/Free/)).toBeInTheDocument();
    expect(screen.getByText(/Başlangıç/)).toBeInTheDocument();
    expect(screen.getByText(/Pro/)).toBeInTheDocument();
    expect(screen.getByText(/299[.,]00/)).toBeInTheDocument();
    expect(screen.getByText(/599[.,]00/)).toBeInTheDocument();
  });

  it("plans sorgusu hata dönerse sayfa çökmez ve kırmızı hata mesajı gösterir", async () => {
    setupSupabase({
      plans: { data: null, error: { message: "plans tablosu erişilemiyor" } },
    });

    const jsx = await Page();
    render(jsx);

    const errorText = screen.getByText(/yüklenemedi/i);
    expect(errorText).toBeInTheDocument();
    expect(errorText.closest('[role="alert"]')).not.toBeNull();
  });

  it("AC-4 / Davranış Sözleşmesi #3 — sort_order kolonu eksikse (PostgREST 42703) 'Planlar yüklenemedi' gösterir", async () => {
    setupSupabase({
      plans: {
        data: null,
        error: {
          message: "column plans.sort_order does not exist",
          code: "42703",
        },
      },
    });

    const jsx = await Page();
    render(jsx);

    const errorText = screen.getByText(/yüklenemedi/i);
    expect(errorText).toBeInTheDocument();
    expect(screen.queryAllByRole("button", { name: /satın al/i })).toHaveLength(0);
  });

  it("AC-3 / Davranış Sözleşmesi #2 — plans tablosu boşsa hata göstermez, boş liste render edilir", async () => {
    setupSupabase({
      plans: { data: [], error: null },
    });

    const jsx = await Page();
    render(jsx);

    expect(screen.queryByText(/yüklenemedi/i)).toBeNull();
    expect(screen.queryAllByRole("heading", { level: 2 })).toHaveLength(0);
  });

  it("AC-1 / Davranış Sözleşmesi #1 — DB'den sort_order artan sırada gelen planlar aynı sırayla render edilir", async () => {
    const { from } = setupSupabase({
      plans: { data: PLANS, error: null },
    });

    const jsx = await Page();
    render(jsx);

    expect(from).toHaveBeenCalledWith("plans");
    const headings = screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent);
    expect(headings).toEqual(["Free", "Başlangıç", "Pro"]);
  });

  // AC-7 (Critical): aktif aboneliği olan kullanıcı -> o planın kartında pasif "Mevcut planınız".
  it("AC-7: aktif aboneliği olan kullanıcıda aktif plan kartı pasif 'Mevcut planınız' butonu gösterir, 'Satın Al' yoktur", async () => {
    setupSupabase({
      plans: { data: PLANS, error: null },
      subscriptions: {
        data: { status: "active", plan_id: "plan-pro", current_period_end: ACTIVE_END_FUTURE },
        error: null,
      },
    });

    const jsx = await Page();
    render(jsx);

    const current = screen.getAllByRole("button", { name: "Mevcut planınız" });
    expect(current).toHaveLength(1);
    expect(current[0]).toBeDisabled();
    expect(current[0].closest("li")).toHaveTextContent("Pro");
    expectNoSatinAlText();
  });

  it("her plan kartında madde listesi ve '/ ay' dönem etiketi görünür", async () => {
    setupSupabase({
      plans: { data: PLANS, error: null },
    });

    const jsx = await Page();
    render(jsx);

    expect(screen.getAllByText("/ ay")).toHaveLength(PLANS.length);
    const cards = screen.getAllByRole("heading", { level: 2 }).map((h) => h.closest("li"));
    for (const card of cards) {
      const items = card?.querySelectorAll("ul > li") ?? [];
      expect(items.length).toBeGreaterThanOrEqual(3);
      expect(items.length).toBeLessThanOrEqual(4);
    }
  });

  it("plan sayısı 3'ten fazlaysa çökmez ve her kart madde listesi gösterir", async () => {
    const fourPlans = [
      ...PLANS,
      { id: "plan-extra", name: "Kurumsal", price_minor_unit: 99900, sort_order: 4 },
    ];
    setupSupabase({
      plans: { data: fourPlans, error: null },
    });

    const jsx = await Page();
    render(jsx);

    expect(screen.getAllByRole("heading", { level: 2 })).toHaveLength(4);
    expect(screen.getAllByText("/ ay")).toHaveLength(4);
    expect(screen.getByText("Kurumsal")).toBeInTheDocument();
  });

  // AC-7 (Critical) — girişsiz: her kartta "14 gün ücretsiz dene" -> düz /signup (plan parametresi yok).
  it("AC-7: girişsiz ziyaretçide her kartta '14 gün ücretsiz dene' linki düz /signup hedefine gider", async () => {
    setupSupabase({
      plans: { data: PLANS, error: null },
      user: null,
    });

    const jsx = await Page();
    render(jsx);

    const links = screen.getAllByRole("link", { name: "14 gün ücretsiz dene" });
    expect(links.map((link) => link.getAttribute("href"))).toEqual(
      PLANS.map(() => "/signup"),
    );
    expectNoSatinAlText();
  });

  // AC-7 (Critical) — denemede: kalan gün (yukarı yuvarlanır) + ikincil "Şimdi abone ol".
  it("AC-7: deneme sürerken 'Denemeniz sürüyor: X gün kaldı' ve 'Şimdi abone ol' gösterilir, 'Satın Al' yoktur", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
    setupSupabase({
      plans: { data: PLANS, error: null },
      subscriptions: {
        data: { status: "trialing", plan_id: "plan-start", current_period_end: TRIAL_END_FUTURE },
        error: null,
      },
    });

    const jsx = await Page();
    render(jsx);

    expect(screen.getAllByText("Denemeniz sürüyor: 10 gün kaldı").length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: "Şimdi abone ol" }).length).toBeGreaterThan(0);
    expect(screen.queryByRole("link", { name: "14 gün ücretsiz dene" })).toBeNull();
    expectNoSatinAlText();
  });

  // AC-7 (Critical) — deneme bitmiş: "Denemeniz bitti" + birincil "Abone ol" (checkout).
  it("AC-7: deneme bitmişse 'Denemeniz bitti' ve her kartta birincil 'Abone ol' gösterilir, 'Satın Al' yoktur", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
    setupSupabase({
      plans: { data: PLANS, error: null },
      subscriptions: {
        data: { status: "trialing", plan_id: "plan-start", current_period_end: TRIAL_END_PAST },
        error: null,
      },
    });

    const jsx = await Page();
    render(jsx);

    expect(screen.getAllByText("Denemeniz bitti").length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: "Abone ol" })).toHaveLength(PLANS.length);
    expect(screen.queryByRole("link", { name: "14 gün ücretsiz dene" })).toBeNull();
    expectNoSatinAlText();
  });

  // Ücretli abonelik bitmiş (canceled / past_due): "Aboneliğiniz sona erdi" + "Yeniden abone ol";
  // "Denemeniz bitti" YOK (expired yalnız trialing kaynaklı).
  it.each(["canceled", "past_due"])(
    "AC-7: abonelik durumu '%s' ise 'Aboneliğiniz sona erdi' ve her kartta 'Yeniden abone ol' gösterilir, 'Denemeniz bitti' yoktur",
    async (status) => {
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(NOW);
      setupSupabase({
        plans: { data: PLANS, error: null },
        subscriptions: {
          data: { status, plan_id: "plan-start", current_period_end: ACTIVE_END_FUTURE },
          error: null,
        },
      });

      const jsx = await Page();
      render(jsx);

      expect(screen.getAllByText("Aboneliğiniz sona erdi").length).toBeGreaterThan(0);
      expect(screen.getAllByRole("button", { name: "Yeniden abone ol" })).toHaveLength(PLANS.length);
      expect(screen.queryByText("Denemeniz bitti")).toBeNull();
      expect(screen.queryByRole("button", { name: "Abone ol" })).toBeNull();
      expect(screen.queryByRole("button", { name: "Mevcut planınız" })).toBeNull();
      expect(screen.queryByRole("link", { name: "14 gün ücretsiz dene" })).toBeNull();
      expectNoSatinAlText();
    },
  );

  // Ücretli abonelik bitmiş + tarih geçmiş (canceled): yine "lapsed", "expired" değil.
  it("AC-7: canceled ve bitiş tarihi geçmişse 'Aboneliğiniz sona erdi' gösterilir, 'Denemeniz bitti' gösterilmez", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
    setupSupabase({
      plans: { data: PLANS, error: null },
      subscriptions: {
        data: { status: "canceled", plan_id: "plan-pro", current_period_end: TRIAL_END_PAST },
        error: null,
      },
    });

    const jsx = await Page();
    render(jsx);

    expect(screen.getAllByText("Aboneliğiniz sona erdi").length).toBeGreaterThan(0);
    expect(screen.queryByText("Denemeniz bitti")).toBeNull();
    expect(screen.getAllByRole("button", { name: "Yeniden abone ol" })).toHaveLength(PLANS.length);
  });

  // AC-8 (High): fiyat sayfası metni birebir.
  it("AC-8: fiyat sayfasında AC-8 metni birebir gösterilir", async () => {
    setupSupabase({
      plans: { data: PLANS, error: null },
      user: null,
    });

    const jsx = await Page();
    render(jsx);

    expect(screen.getByText(AC8_TEXT)).toBeInTheDocument();
  });
});

// EML-98 AC-8: her plan kartında max_listings'ten okunan günlük ilan satırı.
// 10 -> "Günde 10 ilan", 50 -> "Günde 50 ilan", null -> "Sınırsız ilan".
const LIMIT_PLANS = [
  { id: "plan-temel", name: "Temel", price_minor_unit: 29900, sort_order: 1, max_listings: 10 },
  { id: "plan-pro", name: "Pro", price_minor_unit: 59900, sort_order: 2, max_listings: 50 },
  { id: "plan-kurumsal", name: "Kurumsal", price_minor_unit: 99900, sort_order: 3, max_listings: null },
];

describe("PricingPage — günlük ilan limiti (EML-98 AC-8)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  // AC-8 (Medium): üç limit metni birebir render edilir.
  it("max_listings 10 / 50 / null için 'Günde 10 ilan', 'Günde 50 ilan', 'Sınırsız ilan' gösterir", async () => {
    setupSupabase({
      plans: { data: LIMIT_PLANS, error: null },
    });

    const jsx = await Page();
    render(jsx);

    expect(screen.getByText("Günde 10 ilan")).toBeInTheDocument();
    expect(screen.getByText("Günde 50 ilan")).toBeInTheDocument();
    expect(screen.getByText("Sınırsız ilan")).toBeInTheDocument();
  });

  // AC-8 (Medium): satır kendi planının kartında (Temel 10, Pro 50, Kurumsal sınırsız).
  it("her satır kendi plan kartının içinde yer alır", async () => {
    setupSupabase({
      plans: { data: LIMIT_PLANS, error: null },
    });

    const jsx = await Page();
    render(jsx);

    const cardFor = (name: string) =>
      screen.getByRole("heading", { level: 2, name }).closest("li");
    expect(cardFor("Temel")).toHaveTextContent("Günde 10 ilan");
    expect(cardFor("Pro")).toHaveTextContent("Günde 50 ilan");
    expect(cardFor("Kurumsal")).toHaveTextContent("Sınırsız ilan");
  });

  // AC-8 (Medium): plans sorgusu max_listings kolonunu seçer.
  it("plans sorgusu select'e max_listings ekler", async () => {
    const { from } = setupSupabase({
      plans: { data: LIMIT_PLANS, error: null },
    });

    const jsx = await Page();
    render(jsx);

    const plansBuilder = from.mock.results[0]?.value as {
      select: ReturnType<typeof vi.fn>;
    };
    expect(plansBuilder.select).toHaveBeenCalledWith(
      expect.stringContaining("max_listings"),
    );
  });
});
