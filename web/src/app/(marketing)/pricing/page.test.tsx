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

function setupSupabase(opts: {
  plans: QueryResult;
  subscriptions?: QueryResult;
}) {
  const plansQuery = makeQuery(opts.plans);
  const subscriptionsQuery = makeQuery(
    opts.subscriptions ?? { data: null, error: null },
  );
  const from = vi.fn((table: string) => {
    if (table === "plans") return plansQuery;
    if (table === "subscriptions") return subscriptionsQuery;
    throw new Error(`Beklenmeyen tablo: ${table}`);
  });
  const supabase = {
    from,
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: "user-1" } },
        error: null,
      }),
    },
  };
  vi.mocked(createClient).mockResolvedValue(supabase as never);
  return { from, subscriptionsQuery };
}

describe("PricingPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
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

  it("kullanıcının aktif planı varsa o planın kartında 'Satın Al' butonu görünmez", async () => {
    setupSupabase({
      plans: { data: PLANS, error: null },
      subscriptions: {
        data: { status: "active", plan_id: "plan-pro" },
        error: null,
      },
    });

    const jsx = await Page();
    render(jsx);

    // Üç plandan yalnızca aktif olan (Pro) için satın al butonu olmamalı.
    const buyButtons = screen.queryAllByRole("button", { name: /satın al/i });
    expect(buyButtons).toHaveLength(PLANS.length - 1);
  });
});
