// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { notFound, redirect } from "next/navigation";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createClient } from "@/lib/supabase/server";

import { getDeliveredVideoUrl } from "../actions";

import Page from "./page";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("../actions", () => ({
  getDeliveredVideoUrl: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn(() => {
    throw new Error("NEXT_REDIRECT");
  }),
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));

const ORDER_ID = "11111111-1111-4111-8111-111111111111";

type QueryResult = {
  data: unknown;
  error: { message: string } | null;
};

function makeQuery(result: QueryResult) {
  const query: Record<string, unknown> = {};
  for (const method of ["select", "eq", "maybeSingle"]) {
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
  order = { data: null, error: null },
}: {
  userId?: string | null;
  order?: QueryResult;
} = {}) {
  const query = makeQuery(order);
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

function orderRow(overrides: Record<string, unknown> = {}) {
  return {
    id: ORDER_ID,
    status: "awaiting_payment",
    service_code: "photos",
    price_minor_unit: 75000,
    created_at: "2026-10-20T09:00:00.000Z",
    due_at: null,
    delivered_at: null,
    rejection_reason: null,
    properties: { title: "Kadıköy 3+1 daire", address: "Caferağa Mah. 1. Sokak" },
    video_order_assets: [
      {
        id: "a-1",
        kind: "photo",
        storage_path: "agent-1/order/a-1.jpg",
        size_bytes: 2516582,
      },
    ],
    ...overrides,
  };
}

function params(id = ORDER_ID) {
  return { params: Promise.resolve({ id }) };
}

describe("VideoOrderDetailPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  // AC-S1: oturum yoksa /login'e yönlendirilir.
  it("oturum yoksa redirect('/login') çağırır ve sipariş sorgusu yapmaz", async () => {
    const { from } = setupSupabase({ userId: null });

    await expect(Page(params())).rejects.toThrow("NEXT_REDIRECT");

    expect(redirect).toHaveBeenCalledWith("/login");
    expect(from).not.toHaveBeenCalled();
  });

  // AC-S1 / davranış sözleşmesi: başkasının veya olmayan sipariş 404 döner.
  it("sipariş bulunamazsa notFound() çağırır", async () => {
    setupSupabase({ order: { data: null, error: null } });

    await expect(Page(params())).rejects.toThrow("NEXT_NOT_FOUND");

    expect(notFound).toHaveBeenCalled();
  });

  it("geçersiz id formatında notFound() çağırır ve sorgu yapmaz", async () => {
    const { from } = setupSupabase();

    await expect(Page(params("abc"))).rejects.toThrow("NEXT_NOT_FOUND");

    expect(from).not.toHaveBeenCalled();
  });

  // AC-5: teslim edilmiş siparişte sunucudan alınan imzalı URL ile oynatıcı ve indirme linki.
  it("delivered siparişte video oynatıcıyı imzalı URL ile ve indir linkini gösterir", async () => {
    const url = "https://storage.example/property-videos/final.mp4?token=abc";
    setupSupabase({
      order: {
        data: orderRow({
          status: "delivered",
          delivered_at: "2026-10-25T10:00:00.000Z",
          video_order_assets: [],
        }),
        error: null,
      },
    });
    vi.mocked(getDeliveredVideoUrl).mockResolvedValue({ ok: true, url });

    const { container } = render(await Page(params()));

    expect(getDeliveredVideoUrl).toHaveBeenCalledWith(ORDER_ID);
    expect(container.querySelector("video")).toHaveAttribute("src", url);
    expect(screen.getByRole("link", { name: "İndir" })).toHaveAttribute("href", url);
  });

  it("delivered ama URL alınamazsa oynatıcı yerine uyarı gösterir", async () => {
    setupSupabase({
      order: {
        data: orderRow({ status: "delivered", video_order_assets: [] }),
        error: null,
      },
    });
    vi.mocked(getDeliveredVideoUrl).mockResolvedValue({
      ok: false,
      error: "INTERNAL_ERROR",
      message: "Bir hata oluştu, lütfen tekrar deneyin.",
    });

    const { container } = render(await Page(params()));

    expect(container.querySelector("video")).toBeNull();
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  // AC-5: yerinde çekim fiyat teklifi bekliyor.
  it("quote_pending siparişte 'Fiyat teklifi bekleniyor' durumunu gösterir ve video istemez", async () => {
    setupSupabase({
      order: {
        data: orderRow({
          status: "quote_pending",
          service_code: "onsite",
          price_minor_unit: null,
          video_order_assets: [],
        }),
        error: null,
      },
    });

    const { container } = render(await Page(params()));

    expect(screen.getByText("Fiyat teklifi bekleniyor", { exact: true })).toBeInTheDocument();
    expect(container.querySelector("video")).toBeNull();
    expect(getDeliveredVideoUrl).not.toHaveBeenCalled();
    expect(container.textContent).not.toContain("Invalid Date");
  });

  // AC-5: iptal edilmiş yerinde çekimde red gerekçesi gösterilir.
  it("canceled siparişte red gerekçesini gösterir", async () => {
    setupSupabase({
      order: {
        data: orderRow({
          status: "canceled",
          rejection_reason: "Bu bölgede çekim yapamıyoruz",
          video_order_assets: [],
        }),
        error: null,
      },
    });

    render(await Page(params()));

    expect(screen.getByText(/Bu bölgede çekim yapamıyoruz/)).toBeInTheDocument();
  });

  // AC-12: ödeme bekleyen siparişte fiyatlı "Öde" butonu görünür.
  it("awaiting_payment siparişte fiyatlı 'Öde' butonunu gösterir", async () => {
    setupSupabase({ order: { data: orderRow(), error: null } });

    render(await Page(params()));

    expect(screen.getByText("Ödeme bekleniyor", { exact: true })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Öde (750,00 ₺)" })).toBeInTheDocument();
    expect(screen.queryByText(/Önceki ödeme alınamadı/)).toBeNull();
  });

  // AC-12: önceki ödeme başarısız olduysa tekrar deneme notu ve buton gösterilir.
  it("payment_failed siparişte tekrar deneme notunu ve 'Öde' butonunu gösterir", async () => {
    setupSupabase({ order: { data: orderRow({ status: "payment_failed" }), error: null } });

    render(await Page(params()));

    expect(screen.getByText("Önceki ödeme alınamadı, tekrar deneyebilirsiniz.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Öde (750,00 ₺)" })).toBeInTheDocument();
  });

  // AC-12: teslim edilmiş veya hazırlanan siparişte ödeme butonu yoktur.
  it.each(["in_progress", "delivered"])("%s siparişte 'Öde' butonu gösterilmez", async (status) => {
    setupSupabase({
      order: {
        data: orderRow({ status, video_order_assets: [] }),
        error: null,
      },
    });
    vi.mocked(getDeliveredVideoUrl).mockResolvedValue({ ok: true, url: "https://storage.example/v.mp4" });

    render(await Page(params()));

    expect(screen.queryByRole("button", { name: /Öde/ })).toBeNull();
  });

  // AC-5: yüklenen dosyalar tür ve MB olarak listelenir.
  it("yüklenen dosyaların türünü ve boyutunu MB olarak gösterir", async () => {
    setupSupabase({ order: { data: orderRow(), error: null } });

    render(await Page(params()));

    expect(screen.getByText("Fotoğraf")).toBeInTheDocument();
    expect(screen.getByText(/JPG · 2,4 MB/)).toBeInTheDocument();
  });
});
