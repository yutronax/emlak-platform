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

function setupSupabase(subscription: QueryResult) {
  const subscriptionsQuery = makeQuery(subscription);
  const from = vi.fn((table: string) => {
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

describe("AccountSubscriptionPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("giriş yapmış kullanıcının kendi aktif aboneliğini, planı ve dönem sonunu gösterir", async () => {
    const { from, subscriptionsQuery } = setupSupabase({
      data: [
        {
          status: "active",
          current_period_end: "2026-12-31T00:00:00.000Z",
          plan: { name: "Pro" },
        },
      ],
      error: null,
    });

    const jsx = await Page();
    render(jsx);

    expect(from).toHaveBeenCalledWith("subscriptions");
    // Yalnızca kendi kaydını okumalı (IDOR'a karşı kullanıcı filtresi).
    expect(subscriptionsQuery.eq).toHaveBeenCalledWith("agent_id", "user-1");
    expect(screen.getByText(/\bPro\b/)).toBeInTheDocument();
    expect(
      screen.getByText(/31\.12\.2026|31 Aralık 2026|2026-12-31/),
    ).toBeInTheDocument();
    // Aktif abonelikte ödeme uyarısı görünmemeli.
    expect(screen.queryByText(/ödeme.*(gecik|başarısız)/i)).toBeNull();
  });

  it("hiç abonelik kaydı yoksa (boş sonuç, hata değil) 'aboneliğiniz yok' mesajı gösterir", async () => {
    setupSupabase({ data: null, error: null });

    const jsx = await Page();
    render(jsx);

    expect(screen.getByText(/aboneliğiniz yok/i)).toBeInTheDocument();
    expect(screen.queryByText(/yüklenemedi/i)).toBeNull();
  });

  it("subscriptions sorgusu hata dönerse 'yüklenemedi' hata mesajı gösterir, 'abonelik yok' mesajı göstermez", async () => {
    setupSupabase({
      data: null,
      error: { message: "subscriptions tablosu erişilemiyor" },
    });

    const jsx = await Page();
    render(jsx);

    expect(screen.getByText(/yüklenemedi/i)).toBeInTheDocument();
    expect(screen.queryByText(/aboneliğiniz yok/i)).toBeNull();
  });

  it("abonelik past_due durumundaysa ödeme gecikmesi uyarısı gösterir", async () => {
    setupSupabase({
      data: [
        {
          status: "past_due",
          current_period_end: "2026-12-31T00:00:00.000Z",
          plan: { name: "Pro" },
        },
      ],
      error: null,
    });

    const jsx = await Page();
    render(jsx);

    expect(screen.getByText(/ödeme.*(gecik|başarısız)/i)).toBeInTheDocument();
  });

  // --- EML-39: birden fazla subscription satırı (atdd.md AC-1..AC-8) ---

  it("birden fazla subscription satırı varsa hata vermez ve aktif satırı gösterir (AC-1)", async () => {
    setupSupabase({
      data: [
        {
          status: "failed",
          current_period_end: null,
          plan: { name: "Basic" },
          created_at: "2026-06-01T00:00:00.000Z",
        },
        {
          status: "active",
          current_period_end: "2026-12-31T00:00:00.000Z",
          plan: { name: "Pro" },
          created_at: "2026-01-01T00:00:00.000Z",
        },
      ],
      error: null,
    });

    const jsx = await Page();
    render(jsx);

    expect(screen.queryByText(/yüklenemedi/i)).toBeNull();
    expect(screen.getByText("Aktif")).toBeInTheDocument();
    expect(screen.getByText(/\bPro\b/)).toBeInTheDocument();
  });

  it("öncelik sırasına göre 'active' satırı, canceled/past_due satırlarından önce seçer (AC-2)", async () => {
    setupSupabase({
      data: [
        {
          status: "canceled",
          current_period_end: null,
          plan: { name: "Basic" },
          created_at: "2026-06-01T00:00:00.000Z",
        },
        {
          status: "active",
          current_period_end: "2026-12-31T00:00:00.000Z",
          plan: { name: "Pro" },
          created_at: "2026-03-01T00:00:00.000Z",
        },
        {
          status: "past_due",
          current_period_end: null,
          plan: { name: "Basic" },
          created_at: "2026-02-01T00:00:00.000Z",
        },
      ],
      error: null,
    });

    const jsx = await Page();
    render(jsx);

    expect(screen.getByText("Aktif")).toBeInTheDocument();
    expect(screen.queryByText("İptal edildi")).toBeNull();
    expect(screen.queryByText("Gecikmiş")).toBeNull();
  });

  it("aynı öncelikteki birden fazla satırda dizideki ilk (en yeni, created_at desc) satırı seçer (AC-3)", async () => {
    setupSupabase({
      data: [
        {
          status: "canceled",
          current_period_end: "2026-07-01T00:00:00.000Z",
          plan: { name: "Yeni" },
          created_at: "2026-06-01T00:00:00.000Z",
        },
        {
          status: "canceled",
          current_period_end: "2026-02-01T00:00:00.000Z",
          plan: { name: "Eski" },
          created_at: "2026-01-01T00:00:00.000Z",
        },
      ],
      error: null,
    });

    const jsx = await Page();
    render(jsx);

    expect(screen.getByText("İptal edildi")).toBeInTheDocument();
    expect(screen.getByText(/\bYeni\b/)).toBeInTheDocument();
    expect(screen.queryByText(/\bEski\b/)).toBeNull();
  });

  it("boş dizi (data: []) için mevcut 'aboneliğiniz yok' davranışını korur (AC-4)", async () => {
    setupSupabase({ data: [], error: null });

    const jsx = await Page();
    render(jsx);

    expect(screen.getByText(/aboneliğiniz yok/i)).toBeInTheDocument();
    expect(screen.queryByText(/yüklenemedi/i)).toBeNull();
  });

  it("seçilen satır past_due ise uyarı role=\"alert\" ile vurgulanır ve /pricing linki gösterilir (AC-5)", async () => {
    setupSupabase({
      data: [
        {
          status: "past_due",
          current_period_end: "2026-12-31T00:00:00.000Z",
          plan: { name: "Pro" },
          created_at: "2026-06-01T00:00:00.000Z",
        },
        {
          status: "canceled",
          current_period_end: null,
          plan: { name: "Basic" },
          created_at: "2026-01-01T00:00:00.000Z",
        },
      ],
      error: null,
    });

    const jsx = await Page();
    const { container } = render(jsx);

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent(/ödeme.*(gecik|başarısız)/i);
    expect(container.querySelector('a[href="/pricing"]')).not.toBeNull();
  });

  it("yalnızca seçilen satırın plan adını gösterir, diğer satırların plan adını göstermez (AC-6)", async () => {
    setupSupabase({
      data: [
        {
          status: "active",
          current_period_end: "2026-12-31T00:00:00.000Z",
          plan: { name: "Pro" },
          created_at: "2026-06-01T00:00:00.000Z",
        },
        {
          status: "failed",
          current_period_end: null,
          plan: { name: "Basic" },
          created_at: "2026-01-01T00:00:00.000Z",
        },
      ],
      error: null,
    });

    const jsx = await Page();
    render(jsx);

    expect(screen.getByText(/\bPro\b/)).toBeInTheDocument();
    expect(screen.queryByText(/\bBasic\b/)).toBeNull();
  });

  it("seçilen satır trialing ise 'Deneme sürümü' etiketini gösterir (AC-7)", async () => {
    setupSupabase({
      data: [
        {
          status: "trialing",
          current_period_end: "2026-12-31T00:00:00.000Z",
          plan: { name: "Pro" },
          created_at: "2026-06-01T00:00:00.000Z",
        },
      ],
      error: null,
    });

    const jsx = await Page();
    render(jsx);

    expect(screen.getByText("Deneme sürümü")).toBeInTheDocument();
  });

  it("çoklu satır senaryosunda sorgu hâlâ agent_id = auth.user.id filtresini kullanır (AC-8 regresyon)", async () => {
    const { from, subscriptionsQuery } = setupSupabase({
      data: [
        {
          status: "failed",
          current_period_end: null,
          plan: { name: "Basic" },
          created_at: "2026-06-01T00:00:00.000Z",
        },
        {
          status: "active",
          current_period_end: "2026-12-31T00:00:00.000Z",
          plan: { name: "Pro" },
          created_at: "2026-01-01T00:00:00.000Z",
        },
      ],
      error: null,
    });

    const jsx = await Page();
    render(jsx);

    expect(from).toHaveBeenCalledWith("subscriptions");
    expect(subscriptionsQuery.eq).toHaveBeenCalledWith("agent_id", "user-1");
  });
});
