// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { notFound, redirect } from "next/navigation";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { requireAdmin } from "@/lib/auth/requireAdmin";
import { createServiceRoleClient } from "@/lib/supabase/server";

import Page from "./page";

vi.mock("@/lib/auth/requireAdmin", () => ({
  requireAdmin: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createServiceRoleClient: vi.fn(),
}));

vi.mock("../actions", () => ({
  setQuote: vi.fn(),
  rejectOrder: vi.fn(),
  getAssetDownloadUrl: vi.fn(),
  requestDeliveryUploadUrl: vi.fn(),
  confirmDelivery: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn(() => {
    throw new Error("NEXT_REDIRECT");
  }),
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
  useRouter: vi.fn(() => ({ refresh: vi.fn() })),
}));

const ORDER_ID = "11111111-1111-4111-8111-111111111111";

type QueryResult = { data: unknown; error: { message: string } | null };

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

function setupAdmin({
  order = { data: null, error: null },
  videos = { data: [], error: null },
}: {
  order?: QueryResult;
  videos?: QueryResult;
} = {}) {
  const queries: Record<string, ReturnType<typeof makeQuery>> = {
    video_orders: makeQuery(order),
    property_videos: makeQuery(videos),
  };
  const from = vi.fn((table: string) => {
    if (table in queries) return queries[table];
    throw new Error(`Beklenmeyen tablo: ${table}`);
  });
  vi.mocked(createServiceRoleClient).mockReturnValue({ from } as never);
  vi.mocked(requireAdmin).mockResolvedValue({
    ok: true,
    supabase: {} as never,
    userId: "admin-1",
  });
  return { from };
}

function orderRow(overrides: Record<string, unknown> = {}) {
  return {
    id: ORDER_ID,
    status: "quote_pending",
    service_code: "onsite",
    price_minor_unit: null,
    onsite_preferred_time: "Hafta içi öğleden sonra",
    rejection_reason: null,
    created_at: "2026-10-20T09:00:00.000Z",
    paid_at: null,
    due_at: null,
    delivered_at: null,
    properties: { title: "Kadıköy 3+1 daire", address: "Caferağa Mah. 1. Sokak" },
    agents: { company_name: "Yıldız Emlak", phone: "0532 000 00 00" },
    video_order_assets: [],
    ...overrides,
  };
}

function params(id = ORDER_ID) {
  return { params: Promise.resolve({ id }) };
}

async function renderPage(id?: string) {
  const jsx = await Page(params(id) as never);
  render(jsx as never);
}

describe("AdminVideoDetailPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  // AC-S4: oturum yok → /login, sorgu yok.
  it("oturum yoksa redirect('/login') çağırır ve sorgu yapmaz", async () => {
    vi.mocked(requireAdmin).mockResolvedValue({ ok: false, reason: "no-session" });

    await expect(Page(params())).rejects.toThrow("NEXT_REDIRECT");

    expect(redirect).toHaveBeenCalledWith("/login");
    expect(createServiceRoleClient).not.toHaveBeenCalled();
  });

  it("admin değilse notFound() çağırır ve sorgu yapmaz", async () => {
    vi.mocked(requireAdmin).mockResolvedValue({ ok: false, reason: "not-admin" });

    await expect(Page(params())).rejects.toThrow("NEXT_NOT_FOUND");

    expect(notFound).toHaveBeenCalled();
    expect(createServiceRoleClient).not.toHaveBeenCalled();
  });

  it("geçersiz id formatında notFound() çağırır ve sorgu yapmaz", async () => {
    setupAdmin();

    await expect(Page(params("abc"))).rejects.toThrow("NEXT_NOT_FOUND");

    expect(createServiceRoleClient).not.toHaveBeenCalled();
  });

  // AC-7/8: sipariş yoksa 404.
  it("sipariş bulunamazsa notFound() çağırır", async () => {
    setupAdmin({ order: { data: null, error: null } });

    await expect(Page(params())).rejects.toThrow("NEXT_NOT_FOUND");

    expect(notFound).toHaveBeenCalled();
  });

  // AC-8: quote_pending → fiyat ve red formları görünür.
  it("quote_pending siparişte fiyat ve reddetme formlarını gösterir", async () => {
    setupAdmin({ order: { data: orderRow(), error: null } });

    await renderPage();

    expect(screen.getByText("Yıldız Emlak")).toBeInTheDocument();
    expect(screen.getByText("Hafta içi öğleden sonra")).toBeInTheDocument();
    expect(screen.getByLabelText("Fiyat (TL)")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Fiyatı gönder" })).toBeInTheDocument();
    expect(screen.getByLabelText("Reddetme gerekçesi")).toBeInTheDocument();
    expect(screen.queryByLabelText("Teslim videosunu seçin")).toBeNull();
  });

  // AC-8: in_progress → teslim yükleme alanı görünür.
  it("in_progress siparişte bitmiş video yükleme alanını gösterir, red formu yoktur", async () => {
    setupAdmin({
      order: {
        data: orderRow({
          status: "in_progress",
          service_code: "photos",
          price_minor_unit: 75000,
          onsite_preferred_time: null,
          due_at: "2026-10-30T09:00:00.000Z",
          paid_at: "2026-10-28T09:00:00.000Z",
          video_order_assets: [
            { id: "a-1", kind: "photo", storage_path: "p/o/a-1.jpg", size_bytes: 2516582 },
          ],
        }),
        error: null,
      },
    });

    await renderPage();

    expect(screen.getByLabelText("Teslim videosunu seçin")).toBeInTheDocument();
    expect(screen.queryByLabelText("Reddetme gerekçesi")).toBeNull();
    expect(screen.queryByLabelText("Fiyat (TL)")).toBeNull();
    expect(screen.getByRole("button", { name: "Fotoğraf indir" })).toBeInTheDocument();
    expect(screen.getByText("₺750,00")).toBeInTheDocument();
  });

  // AC-8: delivered → form yok, teslim tarihi gösterilir.
  it("delivered siparişte hiçbir yükleme/fiyat formu yok ve teslim tarihi gösterilir", async () => {
    setupAdmin({
      order: {
        data: orderRow({
          status: "delivered",
          service_code: "photos",
          price_minor_unit: 75000,
          onsite_preferred_time: null,
          delivered_at: "2026-10-27T10:00:00.000Z",
          video_order_assets: [],
        }),
        error: null,
      },
      videos: { data: [{ id: "v-1", published_at: "2026-10-27T10:00:00.000Z" }], error: null },
    });

    await renderPage();

    expect(screen.getByText(/Teslim edildi: 27 Ekim 2026/)).toBeInTheDocument();
    expect(screen.queryByLabelText("Teslim videosunu seçin")).toBeNull();
    expect(screen.queryByLabelText("Fiyat (TL)")).toBeNull();
    expect(screen.queryByLabelText("Reddetme gerekçesi")).toBeNull();
    expect(screen.queryByText("Teslim videosu kaydı bulunamadı. Kontrol edin.")).toBeNull();
  });

  // Null-safe: teslim edilmiş ama property_videos kaydı yoksa uyarı, çökme yok.
  it("delivered ama property_videos kaydı yoksa uyarı gösterir ve çökmez", async () => {
    setupAdmin({
      order: {
        data: orderRow({
          status: "delivered",
          delivered_at: null,
          onsite_preferred_time: null,
        }),
        error: null,
      },
      videos: { data: [], error: null },
    });

    await renderPage();

    expect(screen.getByText("Teslim videosu kaydı bulunamadı. Kontrol edin.")).toBeInTheDocument();
    expect(screen.queryByText(/Invalid Date/)).toBeNull();
  });

  it("canceled siparişte reddetme gerekçesini gösterir", async () => {
    setupAdmin({
      order: {
        data: orderRow({ status: "canceled", rejection_reason: "Adres kapsam dışı" }),
        error: null,
      },
    });

    await renderPage();

    expect(screen.getByText("Reddetme gerekçesi: Adres kapsam dışı")).toBeInTheDocument();
    expect(screen.queryByLabelText("Fiyat (TL)")).toBeNull();
  });
});
