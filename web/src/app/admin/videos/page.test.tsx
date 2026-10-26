// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
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

vi.mock("./actions", () => ({
  uploadVideo: vi.fn(),
  publishVideo: vi.fn(),
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
function setupAdminSession(tables: {
  properties?: QueryResult;
  property_videos?: QueryResult;
}) {
  const queries: Record<string, ReturnType<typeof makeQuery>> = {
    properties: makeQuery(tables.properties ?? { data: [], error: null }),
    property_videos: makeQuery(
      tables.property_videos ?? { data: [], error: null },
    ),
  };
  const from = vi.fn((table: string) => {
    if (table in queries) return queries[table];
    throw new Error(`Beklenmeyen tablo: ${table}`);
  });
  const supabase = { from };
  vi.mocked(requireAdmin).mockResolvedValue({
    ok: true,
    supabase: supabase as never,
    userId: "admin-1",
  });
  return { from, queries };
}

// Next.js 16 searchParams Promise olarak gelir.
async function renderPage(searchParams: Record<string, string> = {}) {
  const jsx = await Page({
    searchParams: Promise.resolve(searchParams),
  } as never);
  render(jsx as never);
}

const sampleProperties = [
  {
    id: "prop-1",
    title: "Kadıköy 2+1 Daire",
    address: "Moda Cad. No:1, Kadıköy",
  },
  {
    id: "prop-2",
    title: "Beşiktaş Stüdyo",
    address: "Levent Mah. No:5, Beşiktaş",
  },
];

const sampleVideos = [
  {
    id: "v-draft",
    property_id: "prop-1",
    storage_path: "prop-1/11111111-1111-1111-1111-111111111111.mp4",
    status: "draft",
    published_at: null,
    created_at: "2026-10-21T10:00:00.000Z",
  },
  {
    id: "v-pub",
    property_id: "prop-1",
    storage_path: "prop-1/22222222-2222-2222-2222-222222222222.mp4",
    status: "published",
    published_at: "2026-10-20T10:00:00.000Z",
    created_at: "2026-10-19T10:00:00.000Z",
  },
];

describe("AdminVideosPage", () => {
  // Yetkisiz erişimde hiçbir tablo sorgusunun yapılmadığını doğrulamak için
  // createClient üzerinden bir spy tutulur (page yanlışlıkla sorgu yaparsa yakalanır).
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

  // AC-6 (Elevation): oturum yok → /login, hiçbir tablo sorgulanmaz.
  it("AC-6: oturum yoksa (no-session) redirect('/login') çağrılır ve sorgu yapılmaz", async () => {
    vi.mocked(requireAdmin).mockResolvedValue({
      ok: false,
      reason: "no-session",
    });

    await expect(
      Page({ searchParams: Promise.resolve({}) } as never),
    ).rejects.toThrow("NEXT_REDIRECT");
    expect(redirect).toHaveBeenCalledWith("/login");
    expect(fallbackFrom).not.toHaveBeenCalled();
  });

  // AC-6 (Elevation): oturum var ama admin değil → /agent/dashboard, sorgu yok.
  it("AC-6: oturum var ama admin değilse (not-admin) redirect('/agent/dashboard') çağrılır ve sorgu yapılmaz", async () => {
    vi.mocked(requireAdmin).mockResolvedValue({
      ok: false,
      reason: "not-admin",
    });

    await expect(
      Page({ searchParams: Promise.resolve({}) } as never),
    ).rejects.toThrow("NEXT_REDIRECT");
    expect(redirect).toHaveBeenCalledWith("/agent/dashboard");
    expect(fallbackFrom).not.toHaveBeenCalled();
  });

  // AC-5 / Davranış 5: admin, properties 2 satır → ikisi de property seçicide render edilir.
  it("admin ise properties tablosundaki her iki mülkün başlık ve adresini render eder", async () => {
    const { from } = setupAdminSession({
      properties: { data: sampleProperties, error: null },
    });

    await renderPage();

    expect(redirect).not.toHaveBeenCalled();
    expect(from).toHaveBeenCalledWith("properties");
    expect(screen.getAllByText("Kadıköy 2+1 Daire").length).toBeGreaterThan(0);
    expect(
      screen.getAllByText("Moda Cad. No:1, Kadıköy").length,
    ).toBeGreaterThan(0);
    expect(screen.getAllByText("Beşiktaş Stüdyo").length).toBeGreaterThan(0);
    expect(
      screen.getAllByText("Levent Mah. No:5, Beşiktaş").length,
    ).toBeGreaterThan(0);
  });

  // Boş-durum: properties boş → "Henüz mülk yok", sayfa çökmez.
  it("properties tablosu boşsa 'Henüz mülk yok' boş-durum mesajını render eder ve çökmez", async () => {
    setupAdminSession({ properties: { data: [], error: null } });

    await renderPage();

    expect(screen.getByText("Henüz mülk yok")).toBeInTheDocument();
  });

  // Rozet + Yayınla: seçili property'nin 2 videosu (draft + published).
  it("seçili mülkün videolarında draft satırda 'Taslak' + 'Yayınla' formu, published satırda 'Yayında' rozeti ve Yayınla yok", async () => {
    setupAdminSession({
      properties: { data: sampleProperties, error: null },
      property_videos: { data: sampleVideos, error: null },
    });

    await renderPage({ property_id: "prop-1" });

    const rows = screen.getAllByTestId("video-row");
    expect(rows).toHaveLength(2);

    const draftRow = rows.find(
      (row) => row.getAttribute("data-video-id") === "v-draft",
    );
    const publishedRow = rows.find(
      (row) => row.getAttribute("data-video-id") === "v-pub",
    );
    expect(draftRow).toBeDefined();
    expect(publishedRow).toBeDefined();

    // Draft satır: "Taslak" rozeti ve "Yayınla" butonu (publishVideo formu, video_id hidden).
    const draftScope = within(draftRow!);
    expect(draftScope.getByText("Taslak")).toBeInTheDocument();
    expect(draftScope.queryByText("Yayında")).toBeNull();
    const publishButton = draftScope.getByRole("button", { name: "Yayınla" });
    const publishForm = publishButton.closest("form");
    expect(publishForm).not.toBeNull();
    expect(
      publishForm!.querySelector('input[name="video_id"]'),
    ).toHaveValue("v-draft");

    // Published satır: "Yayında" rozeti, "Yayınla" butonu YOK.
    const publishedScope = within(publishedRow!);
    expect(publishedScope.getByText("Yayında")).toBeInTheDocument();
    expect(publishedScope.queryByText("Taslak")).toBeNull();
    expect(
      publishedScope.queryByRole("button", { name: "Yayınla" }),
    ).toBeNull();

    // Tüm sayfada tek bir Yayınla butonu (yalnızca draft için).
    expect(
      screen.getAllByRole("button", { name: "Yayınla" }),
    ).toHaveLength(1);
  });

  // Boş-durum: seçili mülkün videosu yok → "Bu mülke henüz video eklenmedi".
  it("seçili mülkün property_videos kaydı boşsa 'Bu mülke henüz video eklenmedi' mesajını gösterir", async () => {
    setupAdminSession({
      properties: { data: sampleProperties, error: null },
      property_videos: { data: [], error: null },
    });

    await renderPage({ property_id: "prop-1" });

    expect(
      screen.getByText("Bu mülke henüz video eklenmedi"),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Yayınla" })).toBeNull();
  });
});
