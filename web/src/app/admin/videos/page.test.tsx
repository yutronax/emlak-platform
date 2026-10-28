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

vi.mock("next/navigation", () => ({
  redirect: vi.fn(() => {
    throw new Error("NEXT_REDIRECT");
  }),
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));

type Row = {
  id: string;
  status: string;
  service_code: string;
  created_at: string;
  due_at: string | null;
  delivered_at: string | null;
  properties: { title: string; address: string };
  agents: { company_name: string; phone: string };
};

const PAST = "2020-01-10T10:00:00.000Z";
const FUTURE = "2099-01-10T10:00:00.000Z";

function row(overrides: Partial<Row> & { id: string; status: string }): Row {
  return {
    service_code: "onsite",
    created_at: "2026-10-20T09:00:00.000Z",
    due_at: null,
    delivered_at: null,
    properties: { title: "Kadıköy 3+1 daire", address: "Caferağa Mah. 1. Sokak" },
    agents: { company_name: "Yıldız Emlak", phone: "0532 000 00 00" },
    ...overrides,
  };
}

// Zincirlenebilir sorgu: eq/in ile statü filtresini kaydeder, await'te o statülerin satırlarını döner.
function orderQuery(rowsByStatus: Record<string, Row[]>) {
  let statuses: string[] = [];
  const query: Record<string, unknown> = {};
  query.select = vi.fn(() => query);
  query.order = vi.fn(() => query);
  query.eq = vi.fn((_column: string, value: string) => {
    statuses = [value];
    return query;
  });
  query.in = vi.fn((_column: string, values: string[]) => {
    statuses = values;
    return query;
  });
  query.then = (
    resolve: (value: unknown) => unknown,
    reject: (reason: unknown) => unknown,
  ) => {
    const data = statuses.flatMap((status) => rowsByStatus[status] ?? []);
    return Promise.resolve({ data, count: data.length, error: null }).then(resolve, reject);
  };
  return query;
}

function setupAdmin(rowsByStatus: Record<string, Row[]> = {}) {
  const queries: ReturnType<typeof orderQuery>[] = [];
  const from = vi.fn((table: string) => {
    if (table !== "video_orders") throw new Error(`Beklenmeyen tablo: ${table}`);
    const query = orderQuery(rowsByStatus);
    queries.push(query);
    return query;
  });
  vi.mocked(createServiceRoleClient).mockReturnValue({ from } as never);
  vi.mocked(requireAdmin).mockResolvedValue({
    ok: true,
    supabase: {} as never,
    userId: "admin-1",
  });
  return { from, queries };
}

async function renderPage(tab?: string) {
  const jsx = await Page({
    searchParams: Promise.resolve(tab ? { tab } : {}),
  } as never);
  render(jsx as never);
}

describe("AdminVideosPage (sipariş kuyruğu)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  // AC-S4 / Elevation: oturum yok → /login, hiçbir sorgu yapılmaz.
  it("oturum yoksa redirect('/login') çağrılır ve sorgu yapılmaz", async () => {
    vi.mocked(requireAdmin).mockResolvedValue({ ok: false, reason: "no-session" });

    await expect(Page({ searchParams: Promise.resolve({}) } as never)).rejects.toThrow(
      "NEXT_REDIRECT",
    );

    expect(redirect).toHaveBeenCalledWith("/login");
    expect(createServiceRoleClient).not.toHaveBeenCalled();
  });

  // AC-S4: admin olmayan kullanıcıya sayfa yokmuş gibi davranılır.
  it("admin değilse notFound() çağrılır ve sorgu yapılmaz", async () => {
    vi.mocked(requireAdmin).mockResolvedValue({ ok: false, reason: "not-admin" });

    await expect(Page({ searchParams: Promise.resolve({}) } as never)).rejects.toThrow(
      "NEXT_NOT_FOUND",
    );

    expect(notFound).toHaveBeenCalled();
    expect(createServiceRoleClient).not.toHaveBeenCalled();
  });

  // AC-7: varsayılan sekme "Hazırlanacak" (in_progress) — sadece o statünün siparişleri listelenir.
  it("tab verilmezse in_progress siparişlerini (Hazırlanacak) listeler", async () => {
    const { from, queries } = setupAdmin({
      in_progress: [row({ id: "o-1", status: "in_progress", properties: { title: "Hazırlanan daire", address: "Moda Cad. 1" }, due_at: FUTURE })],
      quote_pending: [row({ id: "o-2", status: "quote_pending", properties: { title: "Teklifteki daire", address: "Levent 5" } })],
    });

    await renderPage();

    expect(from).toHaveBeenCalledWith("video_orders");
    expect(queries[0].eq).toHaveBeenCalledWith("status", "in_progress");
    expect(screen.getByText("Hazırlanan daire")).toBeInTheDocument();
    expect(screen.queryByText("Teklifteki daire")).toBeNull();
    expect(screen.getByRole("link", { name: /Hazırlanacak/ })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  // AC-7: sekme filtresi doğru statüyle çalışır.
  it("?tab=quote teklif bekleyen (quote_pending) siparişleri gösterir", async () => {
    setupAdmin({
      quote_pending: [row({ id: "o-q", status: "quote_pending", properties: { title: "Teklif daire", address: "Levent 5" } })],
      in_progress: [row({ id: "o-t", status: "in_progress", properties: { title: "Hazırlanan daire", address: "Moda 1" }, due_at: FUTURE })],
    });

    await renderPage("quote");

    expect(screen.getByText("Teklif daire")).toBeInTheDocument();
    expect(screen.queryByText("Hazırlanan daire")).toBeNull();
    expect(screen.getByText("Fiyat teklifi bekleniyor")).toBeInTheDocument();
  });

  it("?tab=done yalnızca teslim edilen (delivered) siparişleri gösterir", async () => {
    setupAdmin({
      delivered: [
        row({
          id: "o-d",
          status: "delivered",
          properties: { title: "Teslim daire", address: "Kadıköy 2" },
          delivered_at: "2026-10-25T10:00:00.000Z",
        }),
      ],
    });

    await renderPage("done");

    expect(screen.getByText("Teslim daire")).toBeInTheDocument();
    expect(screen.getByText(/Teslim edildi: 25 Ekim 2026/)).toBeInTheDocument();
  });

  it("?tab=canceled iptal edilen siparişleri gösterir", async () => {
    setupAdmin({
      canceled: [row({ id: "o-c", status: "canceled", properties: { title: "İptal daire", address: "Beyoğlu 3" } })],
    });

    await renderPage("canceled");

    expect(screen.getByText("İptal daire")).toBeInTheDocument();
    expect(screen.getByText("İptal edildi")).toBeInTheDocument();
  });

  // AC-7: geciken siparişler "Gecikti" ile vurgulanır, teslim tarihi gelecekte olanlar vurgulanmaz.
  it("hazırlanacak sekmesinde teslim tarihi geçmiş sipariş 'Gecikti' olarak işaretlenir", async () => {
    setupAdmin({
      in_progress: [
        row({ id: "o-late", status: "in_progress", properties: { title: "Geciken daire", address: "A" }, due_at: PAST }),
        row({ id: "o-ok", status: "in_progress", properties: { title: "Zamanında daire", address: "B" }, due_at: FUTURE }),
      ],
    });

    await renderPage("todo");

    const late = screen.getByText("Geciken daire").closest("a");
    const onTime = screen.getByText("Zamanında daire").closest("a");
    expect(late).toHaveTextContent("Gecikti");
    expect(onTime).not.toHaveTextContent("Gecikti");
    expect(screen.getAllByText("Gecikti")).toHaveLength(1);
  });

  // AC-7: boş sekme mesajı.
  it("hazırlanacak sipariş yoksa açıklayıcı boş mesajı gösterir", async () => {
    setupAdmin({});

    await renderPage("todo");

    expect(
      screen.getByText("Hazırlanacak sipariş yok. Ödemesi alınan siparişler burada görünür."),
    ).toBeInTheDocument();
  });

  // Ödeme bekleyen siparişler (draft/awaiting_payment/payment_failed) sadece sayı olarak görünür.
  it("ödeme bekleyen siparişleri toplam sayı olarak bilgi satırında gösterir", async () => {
    setupAdmin({
      draft: [row({ id: "d-1", status: "draft" })],
      awaiting_payment: [row({ id: "p-1", status: "awaiting_payment" }), row({ id: "p-2", status: "awaiting_payment" })],
      payment_failed: [row({ id: "f-1", status: "payment_failed" })],
    });

    await renderPage("todo");

    expect(screen.getByText("Ödeme bekleyen: 4")).toBeInTheDocument();
  });

  it("satırda emlakçı, telefon, hizmet ve link /admin/videos/<id> olarak render edilir", async () => {
    setupAdmin({
      quote_pending: [
        row({
          id: "order-42",
          status: "quote_pending",
          service_code: "onsite",
          properties: { title: "Beşiktaş stüdyo", address: "Levent Mah. 5" },
          agents: { company_name: "Kuzey Gayrimenkul", phone: "0212 111 22 33" },
        }),
      ],
    });

    await renderPage("quote");

    expect(screen.getByText(/Kuzey Gayrimenkul · 0212 111 22 33 · Yerinde çekim/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Beşiktaş stüdyo/ })).toHaveAttribute(
      "href",
      "/admin/videos/order-42",
    );
  });
});
