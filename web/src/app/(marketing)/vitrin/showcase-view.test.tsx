// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SHOWCASE_FIXTURE } from "@/lib/showcase-ui/mock-service";
import type { ListResult, ShowcaseService } from "@/lib/showcase-ui/types";

import { ShowcaseView } from "./showcase-view";

const page = (items = SHOWCASE_FIXTURE.slice(0, 2), nextCursor: string | null = null, total = items.length): ListResult => ({
  status: "ok",
  items,
  nextCursor,
  total,
});

function makeService(list: ShowcaseService["list"] = vi.fn(async () => page())): ShowcaseService {
  return {
    kind: "mock",
    cities: vi.fn(async () => ["Ankara", "İzmir", "Muğla"]),
    list,
    get: vi.fn(),
  };
}

async function renderView(service = makeService(), initial = { sort: "yeni" as const }) {
  render(<ShowcaseView service={service} initialFilters={initial} />);
  await waitFor(() => expect(screen.getByRole("region", { name: "İlanlar" })).not.toHaveAttribute("aria-busy", "true"));
  return service;
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("ShowcaseView — sonuçlar", () => {
  it("yüklenirken aria-busy; sonra toplam ve kartlar", async () => {
    let resolve!: (v: ListResult) => void;
    const service = makeService(vi.fn(() => new Promise<ListResult>((r) => (resolve = r))));
    render(<ShowcaseView service={service} initialFilters={{ sort: "yeni" }} />);

    expect(screen.getByRole("region", { name: "İlanlar" })).toHaveAttribute("aria-busy", "true");
    resolve(page(SHOWCASE_FIXTURE.slice(0, 2), null, 2));

    expect(await screen.findByText("2 ilan")).toBeInTheDocument();
    const link = screen.getByRole("link", { name: SHOWCASE_FIXTURE[0].title });
    expect(link).toHaveAttribute("href", "/vitrin/a1");
    const card = link.closest("article")!;
    expect(card).toHaveTextContent("8.450.000 ₺");
    expect(card).toHaveTextContent("Karşıyaka, İzmir");
    expect(card).toHaveTextContent("3+1 · 135 m²");
    expect(within(card).getByText("Satılık")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: SHOWCASE_FIXTURE[1].title }).closest("article")).toHaveTextContent(
      "22.000 ₺ / ay",
    );
  });

  it("hata: boş durumdan farklı; Tekrar dene yeniden yükler", async () => {
    const list = vi.fn<ShowcaseService["list"]>().mockResolvedValueOnce({ status: "error" }).mockResolvedValueOnce(page());
    render(<ShowcaseView service={makeService(list)} initialFilters={{ sort: "yeni" }} />);

    expect(await screen.findByRole("alert")).toHaveTextContent("İlanlar yüklenemedi");
    expect(screen.queryByText(/uyan ilan yok/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Tekrar dene" }));
    expect(await screen.findByText("2 ilan")).toBeInTheDocument();
  });

  it("boş sonuç: mesaj ve Filtreleri temizle varsayılana döner", async () => {
    const list = vi.fn<ShowcaseService["list"]>().mockResolvedValueOnce(page([], null, 0)).mockResolvedValue(page());
    await renderView(makeService(list), { sort: "yeni", deal: "kiralik", city: "Muğla" } as never);

    expect(screen.getByText("Bu filtrelere uyan ilan yok")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Filtreleri temizle" }));
    await waitFor(() => expect(list).toHaveBeenLastCalledWith({ sort: "yeni" }, undefined));
  });

  it("Daha fazla göster ekler; hata olursa mevcut kartlar kalır", async () => {
    const list = vi
      .fn<ShowcaseService["list"]>()
      .mockResolvedValueOnce(page(SHOWCASE_FIXTURE.slice(0, 6), "6", 14))
      .mockResolvedValueOnce({ status: "error" })
      .mockResolvedValueOnce(page(SHOWCASE_FIXTURE.slice(6, 12), "12", 14));
    await renderView(makeService(list));

    expect(screen.getAllByRole("article")).toHaveLength(6);
    fireEvent.click(screen.getByRole("button", { name: "Daha fazla göster" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Daha fazla ilan yüklenemedi");
    expect(screen.getAllByRole("article")).toHaveLength(6);

    fireEvent.click(screen.getByRole("button", { name: "Daha fazla göster" }));
    await waitFor(() => expect(screen.getAllByRole("article")).toHaveLength(12));
    expect(list).toHaveBeenLastCalledWith({ sort: "yeni" }, "6");
  });
});

describe("ShowcaseView — filtreler", () => {
  it("Kiralık seçilince yeniden sorgular ve URL'yi günceller", async () => {
    const replace = vi.spyOn(window.history, "replaceState");
    const service = await renderView();

    fireEvent.click(screen.getByRole("radio", { name: "Kiralık" }));

    await waitFor(() => expect(service.list).toHaveBeenLastCalledWith({ sort: "yeni", deal: "kiralik" }, undefined));
    expect(String(replace.mock.calls.at(-1)?.[2])).toContain("islem=kiralik");
    expect(screen.getByRole("radio", { name: "Kiralık" })).toBeChecked();
  });

  it("şehir ve oda seçimi", async () => {
    const service = await renderView();
    await screen.findByRole("option", { name: "İzmir" });

    fireEvent.change(screen.getByLabelText("Şehir"), { target: { value: "İzmir" } });
    fireEvent.change(screen.getByLabelText("Oda"), { target: { value: "3+1" } });

    await waitFor(() =>
      expect(service.list).toHaveBeenLastCalledWith({ sort: "yeni", city: "İzmir", rooms: "3+1" }, undefined),
    );
  });

  it("fiyat: en az > en çok ise uyarır ve sorgulamaz; geçerliyse TL'den kuruşa", async () => {
    const service = await renderView();
    const calls = vi.mocked(service.list).mock.calls.length;

    fireEvent.change(screen.getByLabelText("En az fiyat (₺)"), { target: { value: "500000" } });
    fireEvent.change(screen.getByLabelText("En çok fiyat (₺)"), { target: { value: "100000" } });
    fireEvent.click(screen.getByRole("button", { name: "Uygula" }));

    expect(await screen.findByText("En az fiyat en çoktan büyük olamaz.")).toBeInTheDocument();
    expect(service.list).toHaveBeenCalledTimes(calls);

    fireEvent.change(screen.getByLabelText("En çok fiyat (₺)"), { target: { value: "900000" } });
    fireEvent.click(screen.getByRole("button", { name: "Uygula" }));
    await waitFor(() =>
      expect(service.list).toHaveBeenLastCalledWith({ sort: "yeni", minPrice: 50_000_000, maxPrice: 90_000_000 }, undefined),
    );
  });

  it("mobil filtre düğmesi aktif filtre sayısını gösterir ve paneli açar", async () => {
    await renderView(makeService(), { sort: "yeni", deal: "satilik", city: "İzmir" } as never);

    const toggle = screen.getByRole("button", { name: "Filtreler (2)" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
  });
});
