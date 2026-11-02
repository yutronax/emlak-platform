// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { selectReviewService } from "@/lib/review-ui/service";

vi.mock("@/app/admin/listings/review-actions", () => ({}));
import type { ReviewItem, ReviewService } from "@/lib/review-ui/types";

import { ReviewDesk } from "./review-desk";

const mk = (id: string, title: string, over: Partial<ReviewItem> = {}): ReviewItem => ({
  id,
  rawText: `SATILIK ${title}\nFiyat görüşülür`,
  sourceGroup: "İzmir Emlakçılar",
  owner: null,
  score: 0.62,
  createdAt: "2026-11-01T08:00:00Z",
  parsed: {
    title,
    price: 4_500_000,
    currency: "TRY",
    rooms: "3+1",
    areaM2: 120,
    city: "İzmir",
    district: "Bornova",
    neighborhood: "",
    description: "",
  },
  ...over,
});

const ITEMS = [mk("r1", "Bornova 3+1"), mk("r2", "Buca 2+1", { owner: { companyName: "Acme Emlak" }, score: 0.3 }), mk("r3", "Alsancak 1+1")];

function makeService(overrides: Partial<ReviewService> = {}): ReviewService {
  return {
    kind: "mock",
    list: vi.fn(async (q) => ({ status: "ok" as const, items: ITEMS, total: ITEMS.length, page: q.page, pageSize: 20 })),
    cities: vi.fn(async () => ["İzmir", "Muğla"]),
    approve: vi.fn(async () => ({ status: "ok" as const })),
    reject: vi.fn(async () => ({ status: "ok" as const })),
    getThreshold: vi.fn(async () => ({ value: 0.7, failed: false })),
    saveThreshold: vi.fn(async () => ({ ok: true as const })),
    ...overrides,
  };
}

async function renderDesk(service = makeService()) {
  render(<ReviewDesk service={service} />);
  // İnceleme bölgesi yükleme sırasında da var; kuyruğun gelmesini bekle.
  await screen.findByRole("list", { name: "Kuyruk" });
  return service;
}

const queue = () => screen.getByRole("list", { name: "Kuyruk" });
const pane = () => screen.getByRole("region", { name: "İnceleme" });

afterEach(() => {
  cleanup();
});

describe("ReviewDesk — kuyruk", () => {
  it("ilk ilan seçili gelir; ham mesaj ve alanlar görünür; aralık metni", async () => {
    await renderDesk();

    const first = within(queue()).getByRole("button", { name: /Bornova 3\+1/ });
    expect(first).toHaveAttribute("aria-current", "true");
    expect(pane()).toHaveTextContent("SATILIK Bornova 3+1");
    expect(within(pane()).getByLabelText("Başlık")).toHaveValue("Bornova 3+1");
    expect(screen.getByText("1–3 / 3")).toBeInTheDocument();
  });

  it("kişisel ilan ve skor rozeti metinle belirtilir", async () => {
    await renderDesk();

    const item = within(queue()).getByRole("button", { name: /Buca 2\+1/ });
    expect(item).toHaveTextContent("Kişisel — Acme Emlak");
    expect(item).toHaveTextContent("Düşük 0,30");
  });

  it("liste hatası boş kuyruktan farklı; Tekrar dene", async () => {
    const list = vi
      .fn<ReviewService["list"]>()
      .mockResolvedValueOnce({ status: "error" })
      .mockResolvedValue({ status: "ok", items: ITEMS, total: 3, page: 1, pageSize: 20 });
    render(<ReviewDesk service={makeService({ list })} />);

    expect(await screen.findByRole("alert")).toHaveTextContent("Kuyruk yüklenemedi");
    expect(screen.queryByText("İncelenecek ilan yok")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Tekrar dene" }));
    expect(await screen.findByRole("button", { name: /Bornova 3\+1/ })).toBeInTheDocument();
  });

  it("boş kuyruk ve filtreli boş ayrı metinler", async () => {
    const list = vi.fn<ReviewService["list"]>().mockResolvedValue({ status: "ok", items: [], total: 0, page: 1, pageSize: 20 });
    render(<ReviewDesk service={makeService({ list })} />);
    expect(await screen.findByText("İncelenecek ilan yok")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Kaynak"), { target: { value: "personal" } });
    expect(await screen.findByText("Bu filtrelere uyan ilan yok")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Filtreleri temizle" }));
    await waitFor(() => expect(list).toHaveBeenLastCalledWith({ order: "oldest", page: 1 }));
  });

  it("arama ve filtreler sorguya yansır, sayfa 1'e döner", async () => {
    const service = await renderDesk();

    fireEvent.change(screen.getByLabelText("Ara"), { target: { value: "bornova" } });
    fireEvent.submit(screen.getByRole("search"));
    await waitFor(() => expect(service.list).toHaveBeenLastCalledWith({ order: "oldest", page: 1, q: "bornova" }));

    fireEvent.change(screen.getByLabelText("Skor"), { target: { value: "low" } });
    await waitFor(() =>
      expect(service.list).toHaveBeenLastCalledWith({ order: "oldest", page: 1, q: "bornova", score: "low" }),
    );
  });

  it("sayfalama", async () => {
    const twenty = Array.from({ length: 20 }, (_, i) => mk(`p${i}`, `İlan ${i + 1}`));
    const list = vi.fn<ReviewService["list"]>(async (q) => ({ status: "ok", items: twenty, total: 45, page: q.page, pageSize: 20 }));
    await renderDesk(makeService({ list }));

    expect(screen.getByText("1–20 / 45")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Önceki sayfa" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Sonraki sayfa" }));
    await waitFor(() => expect(list).toHaveBeenLastCalledWith({ order: "oldest", page: 2 }));
    expect(await screen.findByText("21–40 / 45")).toBeInTheDocument();
  });
});

describe("ReviewDesk — inceleme", () => {
  it("düzenlenen alan işaretlenir; onay yalnız değişeni gönderir; ilan düşer ve sıradaki seçilir", async () => {
    const service = await renderDesk();

    fireEvent.change(within(pane()).getByLabelText("Başlık"), { target: { value: "Bornova'da 3+1 daire" } });
    expect(within(pane()).getByText("düzenlendi")).toBeInTheDocument();
    fireEvent.click(within(pane()).getByRole("button", { name: "Onayla" }));

    expect(await screen.findByText("Onaylandı.")).toBeInTheDocument();
    expect(service.approve).toHaveBeenCalledWith("r1", { title: "Bornova'da 3+1 daire" });
    expect(within(queue()).queryByRole("button", { name: /Bornova 3\+1/ })).toBeNull();
    expect(within(queue()).getByRole("button", { name: /Buca 2\+1/ })).toHaveAttribute("aria-current", "true");
  });

  it("doğrulama hatasında onay gönderilmez, hata alana bağlı", async () => {
    const service = await renderDesk();

    const title = within(pane()).getByLabelText("Başlık");
    fireEvent.change(title, { target: { value: "ab" } });
    fireEvent.click(within(pane()).getByRole("button", { name: "Onayla" }));

    expect(await within(pane()).findByText("Başlık 3-140 karakter olmalı.")).toBeInTheDocument();
    expect(title).toHaveAttribute("aria-invalid", "true");
    expect(service.approve).not.toHaveBeenCalled();
  });

  it("işlem hatası: alert, ilan ve düzenleme kalır", async () => {
    await renderDesk(makeService({ approve: vi.fn(async () => ({ status: "error" as const })) }));

    fireEvent.change(within(pane()).getByLabelText("Oda"), { target: { value: "4+1" } });
    fireEvent.click(within(pane()).getByRole("button", { name: "Onayla" }));

    expect(await within(pane()).findByRole("alert")).toHaveTextContent("İşlem tamamlanamadı");
    expect(within(pane()).getByLabelText("Oda")).toHaveValue("4+1");
    expect(within(queue()).getByRole("button", { name: /Bornova 3\+1/ })).toBeInTheDocument();
  });

  it("başka yönetici işlediyse bilgi verir ve kuyruktan düşer", async () => {
    await renderDesk(makeService({ approve: vi.fn(async () => ({ status: "gone" as const })) }));

    fireEvent.click(within(pane()).getByRole("button", { name: "Onayla" }));

    expect(await screen.findByText("Bu ilan başka bir yönetici tarafından işlendi.")).toBeInTheDocument();
    expect(within(queue()).queryByRole("button", { name: /Bornova 3\+1/ })).toBeNull();
  });

  it("red: gerekçe penceresi, seçilen gerekçe ve not gönderilir", async () => {
    const service = await renderDesk();

    fireEvent.click(within(pane()).getByRole("button", { name: "Reddet" }));
    const dialog = screen.getByRole("dialog", { name: "İlanı reddet" });
    fireEvent.click(within(dialog).getByRole("radio", { name: "Mükerrer ilan" }));
    fireEvent.change(within(dialog).getByLabelText("Not (isteğe bağlı)"), { target: { value: "r9 ile aynı" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Reddet" }));

    expect(await screen.findByText("Reddedildi.")).toBeInTheDocument();
    expect(service.reject).toHaveBeenCalledWith("r1", "duplicate", "r9 ile aynı");
  });
});

describe("ReviewDesk — klavye", () => {
  it("J sonraki, K önceki; A onaylar; yazı alanında kısayol çalışmaz", async () => {
    const service = await renderDesk();

    fireEvent.keyDown(document.body, { key: "j" });
    expect(within(queue()).getByRole("button", { name: /Buca 2\+1/ })).toHaveAttribute("aria-current", "true");
    fireEvent.keyDown(document.body, { key: "k" });
    expect(within(queue()).getByRole("button", { name: /Bornova 3\+1/ })).toHaveAttribute("aria-current", "true");

    fireEvent.keyDown(within(pane()).getByLabelText("Başlık"), { key: "a" });
    expect(service.approve).not.toHaveBeenCalled();

    fireEvent.keyDown(document.body, { key: "a" });
    await waitFor(() => expect(service.approve).toHaveBeenCalledWith("r1", {}));
  });
});

describe("selectReviewService", () => {
  it("production'da mock hata fırlatır; bayraksız null", () => {
    expect(() => selectReviewService({ nodeEnv: "production", mockFlag: "1" })).toThrow(/mock/i);
    expect(selectReviewService({ nodeEnv: "development", mockFlag: undefined }).kind).toBe("real");
    expect(selectReviewService({ nodeEnv: "development", mockFlag: "1" })?.kind).toBe("mock");
  });
});
