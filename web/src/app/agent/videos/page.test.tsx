// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { redirect } from "next/navigation";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createClient } from "@/lib/supabase/server";

import Page from "./page";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn(() => {
    throw new Error("NEXT_REDIRECT");
  }),
}));

type QueryResult = {
  data: unknown;
  error: { message: string } | null;
};

function makeQuery(result: QueryResult) {
  const query: Record<string, unknown> = {};
  for (const method of ["select", "eq", "order"]) {
    query[method] = vi.fn(() => query);
  }
  query.then = (
    resolve: (value: QueryResult) => unknown,
    reject: (reason: unknown) => unknown,
  ) => Promise.resolve(result).then(resolve, reject);
  return query;
}

function setupSupabase({
  userId = "user-1",
  orders = { data: [], error: null },
}: {
  userId?: string | null;
  orders?: QueryResult;
} = {}) {
  const query = makeQuery(orders);
  const from = vi.fn((table: string) => {
    if (table === "video_orders") return query;
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
  return { from, query };
}

const ORDERS = [
  {
    id: "o-1",
    status: "awaiting_payment",
    service_code: "photos",
    price_minor_unit: 75000,
    created_at: "2026-10-20T09:00:00.000Z",
    due_at: null,
    delivered_at: null,
    properties: { title: "Kadıköy 3+1 daire" },
  },
  {
    id: "o-2",
    status: "delivered",
    service_code: "raw_video",
    price_minor_unit: 75000,
    created_at: "2026-10-01T09:00:00.000Z",
    due_at: "2026-10-05T09:00:00.000Z",
    delivered_at: "2026-10-05T10:00:00.000Z",
    properties: { title: "Çankaya villa" },
  },
];

describe("AgentVideosPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  // AC-S1: oturum yoksa /login'e yönlendirilir, sipariş sorgusu yapılmaz.
  it("oturum yoksa redirect('/login') çağırır ve video_orders sorgusu yapmaz", async () => {
    const { from } = setupSupabase({ userId: null });

    await expect(Page()).rejects.toThrow("NEXT_REDIRECT");

    expect(redirect).toHaveBeenCalledWith("/login");
    expect(from).not.toHaveBeenCalled();
  });

  // AC-2: boş durumda ne yapılacağını anlatan mesaj ve yeni sipariş butonu.
  it("sipariş yoksa açıklayıcı boş durum mesajı ve yeni sipariş linkini gösterir", async () => {
    setupSupabase({ orders: { data: [], error: null } });

    render(await Page());

    expect(
      screen.getByText(/Henüz video siparişiniz yok\. İlanınızın fotoğraflarını yükleyin/),
    ).toBeInTheDocument();
    const links = screen.getAllByRole("link", { name: "Yeni video siparişi" });
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAttribute("href", "/agent/videos/new");
  });

  // AC-2: sorguyu agent_id ile sınırlar, en yeni önce sıralar.
  it("sorguyu agent_id ve created_at desc ile çalıştırır", async () => {
    const { query } = setupSupabase({ orders: { data: [], error: null } });

    render(await Page());

    expect(query.eq).toHaveBeenCalledWith("agent_id", "user-1");
    expect(query.order).toHaveBeenCalledWith("created_at", { ascending: false });
  });

  // AC-2: her satır mülk başlığı, durum rozeti, teslim bilgisi ve detay linki taşır.
  it("her sipariş için mülk başlığı, durum rozeti, teslim bilgisi ve detay linkini gösterir", async () => {
    setupSupabase({ orders: { data: ORDERS, error: null } });

    render(await Page());

    const awaiting = screen.getByRole("link", { name: /Kadıköy 3\+1 daire/ });
    expect(awaiting).toHaveAttribute("href", "/agent/videos/o-1");
    expect(within(awaiting).getByText("Ödeme bekleniyor")).toBeInTheDocument();
    expect(within(awaiting).queryByText(/Teslim/)).toBeNull();

    const delivered = screen.getByRole("link", { name: /Çankaya villa/ });
    expect(delivered).toHaveAttribute("href", "/agent/videos/o-2");
    expect(within(delivered).getByText("Teslim edildi")).toBeInTheDocument();
    expect(within(delivered).getByText(/Teslim edildi: /)).toBeInTheDocument();
  });

  // Null-safe: teslim tarihi yoksa "Invalid Date" sızmaz.
  it("delivered_at ve due_at null ise tarih metni üretmez, 'Invalid Date' göstermez", async () => {
    setupSupabase({
      orders: {
        data: [{ ...ORDERS[0], created_at: null, due_at: null, delivered_at: null }],
        error: null,
      },
    });

    const { container } = render(await Page());

    expect(container.textContent).not.toContain("Invalid Date");
    expect(screen.queryByText(/Teslim/)).toBeNull();
  });

  // AC-2 hata: sorgu hatasında Alert gösterilir.
  it("sorgu hatasında uyarı gösterir", async () => {
    setupSupabase({ orders: { data: null, error: { message: "boom" } } });

    render(await Page());

    expect(screen.getByRole("alert")).toHaveTextContent("Siparişler yüklenemedi");
  });
});
