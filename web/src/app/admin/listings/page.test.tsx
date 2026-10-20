// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { requireAdmin } from "@/lib/auth/requireAdmin";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

import Page from "./page";

vi.mock("@/lib/auth/requireAdmin", () => ({
  requireAdmin: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn(() => {
    throw new Error("NEXT_REDIRECT");
  }),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
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

// Admin olarak doğrulanmış bir oturum için requireAdmin'in döndüreceği supabase client.
function setupAdminSession(rawListings: QueryResult) {
  const rawListingsQuery = makeQuery(rawListings);
  const from = vi.fn((table: string) => {
    if (table === "raw_listings") return rawListingsQuery;
    throw new Error(`Beklenmeyen tablo: ${table}`);
  });
  const supabase = { from };
  vi.mocked(requireAdmin).mockResolvedValue({
    ok: true,
    supabase: supabase as never,
    userId: "admin-1",
  });
  return { from, rawListingsQuery };
}

const sampleListing = {
  id: "raw-1",
  source_group: "Kadıköy Emlak Grubu",
  raw_text: "Kadıköy'de 2+1 daire satılık",
  parsed: {
    title: "Kadıköy 2+1 Daire",
    price: 2500000,
    currency: "TRY",
    rooms: "2+1",
    area_m2: 95,
    city: "İstanbul",
    district: "Kadıköy",
    neighborhood: "Moda",
    description: null,
  },
  quality_score: 80,
  created_at: "2026-10-01T10:00:00.000Z",
};

describe("AdminListingsPage", () => {
  // Yetkisiz erişimde raw_listings sorgusunun hiç yapılmadığını doğrulamak için
  // createClient üzerinden de bir spy tutulur (page yanlışlıkla sorgu yaparsa yakalanır).
  let fallbackFrom: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    fallbackFrom = vi.fn(() => {
      throw new Error("Yetkisiz erişimde sorgu yapılmamalı");
    });
    vi.mocked(createClient).mockResolvedValue({
      from: fallbackFrom,
    } as never);
  });

  afterEach(() => {
    cleanup();
  });

  // AC-S2 (Elevation): oturum yok → /login, raw_listings sorgusu yok.
  it("AC-S2: oturum yoksa (no-session) redirect('/login') çağrılır ve raw_listings sorgulanmaz", async () => {
    vi.mocked(requireAdmin).mockResolvedValue({
      ok: false,
      reason: "no-session",
    });

    await expect(Page()).rejects.toThrow("NEXT_REDIRECT");
    expect(redirect).toHaveBeenCalledWith("/login");
    expect(fallbackFrom).not.toHaveBeenCalled();
  });

  // AC-S2 (Elevation): oturum var ama admin değil → /agent/dashboard, sorgu yok.
  it("AC-S2: oturum var ama admin değilse (not-admin) redirect('/agent/dashboard') çağrılır ve raw_listings sorgulanmaz", async () => {
    vi.mocked(requireAdmin).mockResolvedValue({
      ok: false,
      reason: "not-admin",
    });

    await expect(Page()).rejects.toThrow("NEXT_REDIRECT");
    expect(redirect).toHaveBeenCalledWith("/agent/dashboard");
    expect(fallbackFrom).not.toHaveBeenCalled();
  });

  // AC-5: admin happy path — sayfa normal render edilir.
  it("AC-5: admin ise sayfa başlığını ve bekleyen ilan listesini render eder", async () => {
    const { from, rawListingsQuery } = setupAdminSession({
      data: [sampleListing],
      error: null,
    });

    const jsx = await Page();
    render(jsx);

    expect(redirect).not.toHaveBeenCalled();
    expect(from).toHaveBeenCalledWith("raw_listings");
    expect(rawListingsQuery.eq).toHaveBeenCalledWith("status", "pending");
    expect(
      screen.getByRole("heading", { name: /İlan Onay Paneli/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/1 incelenmemiş ilan/i)).toBeInTheDocument();
    expect(screen.getByText(sampleListing.raw_text)).toBeInTheDocument();
    expect(screen.getByText("Kadıköy Emlak Grubu")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Onayla/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Reddet/i })).toBeInTheDocument();
  });

  // AC-5 (boş-sonuç dalı): admin + boş liste → "İncelenmemiş ilan yok" mesajı.
  it("AC-5: admin ve bekleyen ilan yoksa 'İncelenmemiş ilan yok' mesajı gösterir, hata mesajı göstermez", async () => {
    setupAdminSession({ data: [], error: null });

    const jsx = await Page();
    render(jsx);

    expect(screen.getByText(/İncelenmemiş ilan yok/i)).toBeInTheDocument();
    expect(screen.queryByText(/yüklenemedi/i)).toBeNull();
  });

  // AC-S3 (Info disclosure): raw_listings hatasında DB detayı render edilmemeli.
  it("AC-S3: raw_listings sorgusu hata dönerse DB hata detayını göstermez, generic 'yüklenemedi' mesajı gösterir", async () => {
    setupAdminSession({
      data: null,
      error: { message: "relation does not exist" },
    });

    const jsx = await Page();
    render(jsx);

    expect(screen.queryByText(/relation does not exist/i)).toBeNull();
    expect(screen.getByText(/yüklenemedi/i)).toBeInTheDocument();
    expect(screen.getByText(/lütfen tekrar deneyin/i)).toBeInTheDocument();
  });
});
