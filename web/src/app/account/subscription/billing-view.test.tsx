// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { BillingService, Plan, Subscription, SubscriptionStatus } from "@/lib/billing-ui/types";

import { BillingView } from "./billing-view";

const PLANS: Plan[] = [
  { id: "temel", name: "Temel", priceMinor: 9900, features: ["1 grup"] },
  { id: "pro", name: "Pro", priceMinor: 29900, features: ["5 grup"] },
  { id: "kurumsal", name: "Kurumsal", priceMinor: 59900, features: ["Sınırsız grup"] },
];

const sub = (over: Partial<Subscription> = {}): Subscription => ({
  status: "active",
  plan: PLANS[1],
  currentPeriodEnd: "2026-12-01T09:00:00Z",
  cancelAtPeriodEnd: false,
  trialEnd: null,
  ...over,
});

function makeService(subscription = sub(), overrides: Partial<BillingService> = {}): BillingService {
  return {
    kind: "mock",
    load: vi.fn(async () => ({
      status: "ok" as const,
      subscription,
      plans: PLANS,
      payments: [
        {
          id: "p1",
          date: "2026-11-01T09:00:00Z",
          description: "Pro · Kasım 2026",
          amountMinor: 29900,
          status: "paid" as const,
          receiptUrl: "https://example.test/makbuz/p1",
        },
        {
          id: "p2",
          date: "2026-10-01T09:00:00Z",
          description: "Pro · Ekim 2026",
          amountMinor: 29900,
          status: "failed" as const,
          receiptUrl: null,
        },
      ],
    })),
    changePlan: vi.fn(async (planId: string) => ({
      status: "ok" as const,
      subscription: sub({ plan: PLANS.find((p) => p.id === planId)! }),
      effective: "now" as const,
    })),
    cancel: vi.fn(async () => ({ status: "ok" as const, subscription: sub({ cancelAtPeriodEnd: true }) })),
    resume: vi.fn(async () => ({ status: "ok" as const, subscription: sub() })),
    updatePaymentMethod: vi.fn(async () => ({ status: "redirect" as const, url: "https://pay.test/kart" })),
    ...overrides,
  };
}

async function renderView(service = makeService()) {
  const navigate = vi.fn();
  render(<BillingView service={service} navigate={navigate} />);
  await screen.findByRole("heading", { name: "Mevcut plan" });
  return { service, navigate };
}

afterEach(() => {
  cleanup();
});

describe("BillingView — yükleme", () => {
  it("hata durumunda 'abonelik yok' yerine hata ve Tekrar dene gösterir", async () => {
    const load = vi
      .fn<BillingService["load"]>()
      .mockResolvedValueOnce({ status: "error" })
      .mockResolvedValueOnce(await makeService().load());
    render(<BillingView service={makeService(sub(), { load })} navigate={vi.fn()} />);

    expect(await screen.findByRole("alert")).toHaveTextContent("Abonelik bilgisi yüklenemedi");
    expect(screen.queryByText("Aktif aboneliğiniz yok")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Tekrar dene" }));
    expect(await screen.findByRole("heading", { name: "Mevcut plan" })).toBeInTheDocument();
  });
});

describe("BillingView — durumlar", () => {
  it.each<[SubscriptionStatus, string, string]>([
    ["active", "Aktif", "Yenilenme: 01.12.2026"],
    ["trialing", "Deneme", "Deneme 15.11.2026 tarihinde bitiyor"],
    ["past_due", "Ödeme gecikti", "Son ödemeniz alınamadı"],
    ["pending", "Onay bekliyor", "Ödemeniz onay bekliyor"],
    ["needs_review", "İnceleniyor", "Ödemeniz inceleniyor"],
    ["failed", "Başarısız", "Ödeme tamamlanamadı"],
  ])("%s → rozet '%s' ve '%s'", async (status, badge, sentence) => {
    await renderView(makeService(sub({ status, trialEnd: status === "trialing" ? "2026-11-15T09:00:00Z" : null })));

    const card = screen.getByRole("region", { name: "Mevcut plan" });
    expect(within(card).getByText(badge)).toBeInTheDocument();
    expect(card).toHaveTextContent(sentence);
    expect(within(card).getByText("Pro")).toBeInTheDocument();
  });

  it("past_due: uyarı alert ve ödeme yöntemi güncelleme ödeme sayfasına götürür", async () => {
    const { navigate, service } = await renderView(makeService(sub({ status: "past_due" })));

    expect(screen.getByRole("alert")).toHaveTextContent("ödeme yönteminizi güncelleyin");
    fireEvent.click(screen.getByRole("button", { name: "Ödeme yöntemini güncelle" }));
    await waitFor(() => expect(navigate).toHaveBeenCalledWith("https://pay.test/kart"));
    expect(service.updatePaymentMethod).toHaveBeenCalled();
  });

  it.each<SubscriptionStatus>(["pending", "needs_review"])(
    "%s: plan değiştirme ve iptal gösterilmez",
    async (status) => {
      await renderView(makeService(sub({ status })));

      expect(screen.queryByRole("button", { name: /Bu plana geç/ })).toBeNull();
      expect(screen.queryByRole("button", { name: "Aboneliği iptal et" })).toBeNull();
    },
  );

  it.each<SubscriptionStatus>(["none", "canceled"])("%s: boş durum ve 'Planı seç' kartları", async (status) => {
    const service = makeService(sub({ status, plan: status === "none" ? null : PLANS[0] }), {
      changePlan: vi.fn(async () => ({ status: "redirect" as const, url: "https://pay.test/odeme" })),
    });
    const { navigate } = await renderView(service);

    expect(screen.getByText("Aktif aboneliğiniz yok")).toBeInTheDocument();
    const buttons = screen.getAllByRole("button", { name: /Planı seç/ });
    expect(buttons).toHaveLength(3);
    fireEvent.click(buttons[1]);
    await waitFor(() => expect(navigate).toHaveBeenCalledWith("https://pay.test/odeme"));
    expect(service.changePlan).toHaveBeenCalledWith("pro");
  });
});

describe("BillingView — plan değiştirme", () => {
  it("mevcut plan işaretli ve seçilemez", async () => {
    await renderView();

    const plans = screen.getByRole("region", { name: "Planı değiştir" });
    expect(within(plans).getByText("Mevcut plan")).toBeInTheDocument();
    expect(within(plans).queryByRole("button", { name: "Bu plana geç: Pro" })).toBeNull();
  });

  it("düşürme: onay penceresi dönem sonu tarihini söyler; onaylanınca bilgi verir", async () => {
    const service = makeService(sub(), {
      changePlan: vi.fn(async () => ({
        status: "ok" as const,
        subscription: sub(),
        effective: "period_end" as const,
      })),
    });
    await renderView(service);

    fireEvent.click(screen.getByRole("button", { name: "Bu plana geç: Temel" }));
    const dialog = screen.getByRole("dialog", { name: "Temel planına geç" });
    expect(dialog).toHaveTextContent("01.12.2026 tarihinde geçerli olur");
    expect(within(dialog).getByRole("button", { name: "Vazgeç" })).toHaveFocus();

    fireEvent.click(within(dialog).getByRole("button", { name: "Planı değiştir" }));
    expect(await screen.findByText("01.12.2026 tarihinde Temel planına geçeceksiniz.")).toBeInTheDocument();
    expect(service.changePlan).toHaveBeenCalledWith("temel");
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("yükseltme: 'hemen geçerli' der; başarıda plan güncellenir", async () => {
    await renderView();

    fireEvent.click(screen.getByRole("button", { name: "Bu plana geç: Kurumsal" }));
    expect(screen.getByRole("dialog")).toHaveTextContent("hemen geçerli olur");
    fireEvent.click(screen.getByRole("button", { name: "Planı değiştir" }));

    expect(await screen.findByText("Planınız Kurumsal olarak güncellendi.")).toBeInTheDocument();
    expect(within(screen.getByRole("region", { name: "Mevcut plan" })).getByText("Kurumsal")).toBeInTheDocument();
  });

  it("Esc pencereyi kapatır ve odak tetikleyiciye döner", async () => {
    await renderView();

    const trigger = screen.getByRole("button", { name: "Bu plana geç: Temel" });
    fireEvent.click(trigger);
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(trigger).toHaveFocus();
  });

  it("hata pencerede gösterilir, pencere açık kalır", async () => {
    await renderView(
      makeService(sub(), { changePlan: vi.fn(async () => ({ status: "error" as const, code: "network" as const })) }),
    );

    fireEvent.click(screen.getByRole("button", { name: "Bu plana geç: Kurumsal" }));
    fireEvent.click(screen.getByRole("button", { name: "Planı değiştir" }));

    expect(await within(screen.getByRole("dialog")).findByRole("alert")).toHaveTextContent(
      "Bağlantı sorunu, tekrar deneyin.",
    );
  });
});

describe("BillingView — iptal", () => {
  it("iptal 'sona erecek' der, 'iptal edildi' demez; İptali geri al görünür", async () => {
    const { service } = await renderView();

    fireEvent.click(screen.getByRole("button", { name: "Aboneliği iptal et" }));
    const dialog = screen.getByRole("dialog", { name: "Aboneliği iptal et" });
    expect(dialog).toHaveTextContent("01.12.2026 tarihine kadar tüm özellikleri kullanmaya devam edersiniz.");
    fireEvent.click(within(dialog).getByRole("button", { name: "İptal et" }));

    const card = screen.getByRole("region", { name: "Mevcut plan" });
    await waitFor(() => expect(card).toHaveTextContent("01.12.2026 tarihinde sona erecek"));
    expect(service.cancel).toHaveBeenCalled();
    expect(screen.queryByText(/iptal edildi/i)).toBeNull();
    expect(screen.queryByRole("button", { name: "Aboneliği iptal et" })).toBeNull();

    fireEvent.click(within(card).getByRole("button", { name: "İptali geri al" }));
    await waitFor(() => expect(card).toHaveTextContent("Yenilenme: 01.12.2026"));
    expect(service.resume).toHaveBeenCalled();
  });
});

describe("BillingView — ödeme geçmişi", () => {
  it("satırlar tarih, açıklama, tutar ve metinli durum içerir; makbuz yeni sekmede", async () => {
    await renderView();

    const table = screen.getByRole("table", { name: "Ödeme geçmişi" });
    const rows = within(table).getAllByRole("row").slice(1);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent("01.11.2026");
    expect(rows[0]).toHaveTextContent("Pro · Kasım 2026");
    expect(rows[0]).toHaveTextContent("299,00 ₺");
    expect(rows[0]).toHaveTextContent("Ödendi");
    expect(within(rows[0]).getByRole("link", { name: /Makbuz/ })).toHaveAttribute("target", "_blank");
    expect(rows[1]).toHaveTextContent("Başarısız");
    expect(within(rows[1]).queryByRole("link")).toBeNull();
  });

  it("ödeme yoksa boş durum metni", async () => {
    const base = makeService();
    const data = await base.load();
    await renderView(
      makeService(sub(), { load: vi.fn(async () => (data.status === "ok" ? { ...data, payments: [] } : data)) }),
    );

    expect(screen.getByText("Henüz ödeme yok.")).toBeInTheDocument();
    expect(screen.queryByRole("table")).toBeNull();
  });
});
