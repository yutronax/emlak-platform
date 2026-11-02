// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createMockAdminService, selectAdminService } from "@/lib/admin-ui/service";
import type { AdminService } from "@/lib/admin-ui/types";

import { AgentDetailView } from "./agent-detail-view";

vi.mock("@/app/admin/agents/actions", () => ({}));
import { AgentsView } from "./agents-view";
import { AdminOverview } from "./admin-overview";

const svc = (overrides: Partial<AdminService> = {}): AdminService => {
  const base = createMockAdminService(0);
  return {
    ...base,
    overview: vi.fn(base.overview),
    listAgents: vi.fn(base.listAgents),
    getAgent: vi.fn(base.getAgent),
    setSuspended: vi.fn(base.setSuspended),
    setAdmin: vi.fn(base.setAdmin),
    ...overrides,
  };
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("AdminOverview", () => {
  it("dört özet kartı bağlantılarıyla; gecikmiş ödeme uyarı tonunda", async () => {
    render(<AdminOverview service={svc()} />);

    const pending = await screen.findByRole("link", { name: /26\s*Bekleyen ilan/ });
    expect(pending).toHaveAttribute("href", "/admin/listings");
    expect(screen.getByRole("link", { name: /3\s*Bekleyen video siparişi/ })).toHaveAttribute("href", "/admin/videos");
    expect(screen.getByRole("link", { name: /Aktif abone/ })).toHaveAttribute("href", "/admin/agents?abonelik=active");
    const pastDue = screen.getByRole("link", { name: /Gecikmiş ödeme/ });
    expect(pastDue).toHaveAttribute("href", "/admin/agents?abonelik=past_due");
    expect(pastDue).toHaveAttribute("data-tone", "warning");
    expect(within(screen.getByRole("region", { name: "Son katılan emlakçılar" })).getAllByRole("listitem")).toHaveLength(4);
  });

  it("hata: Tekrar dene", async () => {
    const base = createMockAdminService(0);
    const overview = vi.fn<AdminService["overview"]>().mockResolvedValueOnce({ status: "error" }).mockImplementation(base.overview);
    render(<AdminOverview service={svc({ overview })} />);

    expect(await screen.findByRole("alert")).toHaveTextContent("Özet yüklenemedi");
    fireEvent.click(screen.getByRole("button", { name: "Tekrar dene" }));
    expect(await screen.findByRole("link", { name: /Bekleyen ilan/ })).toBeInTheDocument();
  });
});

describe("AgentsView", () => {
  it("liste, rozetler, sayfa aralığı ve detay bağlantısı", async () => {
    render(<AgentsView service={svc()} initialQuery={{ page: 1 }} />);

    const table = await screen.findByRole("table", { name: "Emlakçılar" });
    const rows = within(table).getAllByRole("row").slice(1);
    expect(rows).toHaveLength(20);
    expect(rows[0]).toHaveTextContent("Karşıyaka Sahil Gayrimenkul");
    expect(rows[0]).toHaveTextContent("Admin");
    expect(within(rows[0]).getByRole("link", { name: "Karşıyaka Sahil Gayrimenkul" })).toHaveAttribute("href", "/admin/agents/a1");
    expect(rows[3]).toHaveTextContent("Ödeme gecikti");
    expect(screen.getByText("1–20 / 24")).toBeInTheDocument();
  });

  it("arama ve filtreler sorguya ve URL'ye yansır", async () => {
    const replace = vi.spyOn(window.history, "replaceState");
    const service = svc();
    render(<AgentsView service={service} initialQuery={{ page: 1 }} />);
    await screen.findByRole("table", { name: "Emlakçılar" });

    fireEvent.change(screen.getByLabelText("Ara"), { target: { value: "bodrum" } });
    fireEvent.submit(screen.getByRole("search"));
    await waitFor(() => expect(service.listAgents).toHaveBeenLastCalledWith({ page: 1, q: "bodrum" }));

    fireEvent.change(screen.getByLabelText("Durum"), { target: { value: "suspended" } });
    await waitFor(() => expect(service.listAgents).toHaveBeenLastCalledWith({ page: 1, q: "bodrum", sub: "suspended" }));
    expect(String(replace.mock.calls.at(-1)?.[2])).toContain("abonelik=suspended");
  });

  it("filtreli boş: temizle", async () => {
    const service = svc();
    render(<AgentsView service={service} initialQuery={{ page: 1, q: "yokboyle" }} />);

    expect(await screen.findByText("Bu filtrelere uyan emlakçı yok")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Filtreleri temizle" }));
    await waitFor(() => expect(service.listAgents).toHaveBeenLastCalledWith({ page: 1 }));
  });

  it("hata: boş listeden farklı", async () => {
    render(<AgentsView service={svc({ listAgents: vi.fn(async () => ({ status: "error" as const })) })} initialQuery={{ page: 1 }} />);

    expect(await screen.findByRole("alert")).toHaveTextContent("Emlakçılar yüklenemedi");
    expect(screen.queryByText(/uyan emlakçı yok/)).toBeNull();
  });
});

describe("AgentDetailView", () => {
  it("özet ve bölümler; boş bölümler kendi metniyle", async () => {
    render(<AgentDetailView service={svc()} id="a3" />);

    expect(await screen.findByRole("heading", { level: 1, name: /Çankaya Konut Danışmanlık/ })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Ödemeler" })).toHaveTextContent("299,00 ₺");
    expect(screen.getByRole("region", { name: "WhatsApp grupları" })).toHaveTextContent("Henüz grup yok.");
    expect(screen.getByRole("region", { name: "Son ilanlar" })).toHaveTextContent("Bornova 3+1 site içinde");
    expect(screen.getByRole("region", { name: "Video siparişleri" })).toHaveTextContent("Karşıyaka 3+1 tanıtım videosu");
  });

  it("bulunamadı", async () => {
    render(<AgentDetailView service={svc()} id="yok" />);
    expect(await screen.findByText("Emlakçı bulunamadı")).toBeInTheDocument();
  });

  it("askıya al: onay penceresi, sonra etiket ve ters aksiyon", async () => {
    const service = svc();
    render(<AgentDetailView service={service} id="a2" />);
    const actions = await screen.findByRole("region", { name: "Hesap aksiyonları" });

    fireEvent.click(within(actions).getByRole("button", { name: "Askıya al" }));
    const dialog = screen.getByRole("dialog", { name: "Hesabı askıya al" });
    expect(dialog).toHaveTextContent("panele giremez");
    expect(service.setSuspended).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole("button", { name: "Askıya al" }));

    await waitFor(() => expect(within(actions).getByRole("button", { name: "Yeniden etkinleştir" })).toBeInTheDocument());
    expect(service.setSuspended).toHaveBeenCalledWith("a2", true);
    expect(screen.getByText("Askıda")).toBeInTheDocument();
  });

  it("kendi admin yetkisini kaldırma pasif ve açıklamalı", async () => {
    render(<AgentDetailView service={svc()} id="a1" />);
    const actions = await screen.findByRole("region", { name: "Hesap aksiyonları" });

    const btn = within(actions).getByRole("button", { name: "Admin yetkisini kaldır" });
    expect(btn).toBeDisabled();
    expect(actions).toHaveTextContent("Kendi yetkinizi kaldıramazsınız.");
  });

  it("işlem hatası pencerede gösterilir", async () => {
    render(<AgentDetailView service={svc()} id="a7" />);
    const actions = await screen.findByRole("region", { name: "Hesap aksiyonları" });

    fireEvent.click(within(actions).getByRole("button", { name: "Admin yap" }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Admin yap" }));

    expect(await within(screen.getByRole("dialog")).findByRole("alert")).toHaveTextContent("İşlem tamamlanamadı");
  });
});

describe("selectAdminService", () => {
  it("production'da mock hata; bayraksız null", () => {
    expect(() => selectAdminService({ nodeEnv: "production", mockFlag: "1" })).toThrow(/mock/i);
    expect(selectAdminService({ nodeEnv: "development", mockFlag: undefined }).kind).toBe("real");
  });
});
