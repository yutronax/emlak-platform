// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createVideoOrder, submitVideoOrder } from "../actions";

import { OrderWizard, type ServiceOption } from "./order-wizard";

const { mockPush } = vi.hoisted(() => ({ mockPush: vi.fn() }));

vi.mock("../actions", () => ({
  createVideoOrder: vi.fn(),
  submitVideoOrder: vi.fn(),
  requestUploadUrl: vi.fn(),
  confirmUpload: vi.fn(),
  removeAsset: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

const SERVICES: ServiceOption[] = [
  { code: "photos", name: "Fotoğraflardan video", price_minor_unit: 75000 },
  { code: "raw_video", name: "Kendi videonuzdan", price_minor_unit: 75000 },
  { code: "onsite", name: "Yerinde çekim", price_minor_unit: null },
];

function renderWizard() {
  return render(<OrderWizard services={SERVICES} />);
}

function fillProperty() {
  fireEvent.change(screen.getByLabelText("Mülk başlığı"), {
    target: { value: "Kadıköy 3+1 daire" },
  });
  fireEvent.change(screen.getByLabelText("Adres"), {
    target: { value: "Caferağa Mah. 1. Sokak No: 5" },
  });
}

describe("OrderWizard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  // AC-3: hizmet seçilmeden ilerlenemez.
  it("hizmet seçmeden Devam pasif, bir hizmet seçilince aktif olur", () => {
    renderWizard();

    const next = screen.getByRole("button", { name: "Devam" });
    expect(next).toBeDisabled();

    fireEvent.click(screen.getByRole("radio", { name: /Fotoğraflardan video/ }));

    expect(screen.getByRole("button", { name: "Devam" })).toBeEnabled();
  });

  it("hizmet kartları radio semantiğiyle ve seçili durumla render edilir", () => {
    renderWizard();

    const radios = screen.getAllByRole("radio");
    expect(radios).toHaveLength(3);

    fireEvent.click(screen.getByRole("radio", { name: /Yerinde çekim/ }));

    expect(screen.getByRole("radio", { name: /Yerinde çekim/ })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(screen.getByRole("radio", { name: /Fotoğraflardan video/ })).toHaveAttribute(
      "aria-checked",
      "false",
    );
  });

  // AC-3: yerinde çekimde uygun zaman notu alanı görünür.
  it("yerinde çekim seçilince 'Size uygun gün ve saat' alanını gösterir", () => {
    renderWizard();

    fireEvent.click(screen.getByRole("radio", { name: /Yerinde çekim/ }));
    fireEvent.click(screen.getByRole("button", { name: "Devam" }));

    expect(screen.getByLabelText("Size uygun gün ve saat")).toBeInTheDocument();
  });

  it("fotoğraf akışında zaman notu alanı görünmez", () => {
    renderWizard();

    fireEvent.click(screen.getByRole("radio", { name: /Fotoğraflardan video/ }));
    fireEvent.click(screen.getByRole("button", { name: "Devam" }));

    expect(screen.queryByLabelText("Size uygun gün ve saat")).toBeNull();
  });

  // AC-3: sunucu hatası (ör. limit) form içinde açık Türkçe mesajla gösterilir.
  it("createVideoOrder hata dönerse mesajı Alert ile gösterir", async () => {
    vi.mocked(createVideoOrder).mockResolvedValue({
      ok: false,
      error: "LIMIT_REACHED",
      message: "Bu sipariş için dosya sınırına ulaştınız.",
    });
    renderWizard();

    fireEvent.click(screen.getByRole("radio", { name: /Fotoğraflardan video/ }));
    fireEvent.click(screen.getByRole("button", { name: "Devam" }));
    fillProperty();
    fireEvent.click(screen.getByRole("button", { name: "Devam" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Bu sipariş için dosya sınırına ulaştınız.",
    );
    expect(createVideoOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        serviceCode: "photos",
        title: "Kadıköy 3+1 daire",
        address: "Caferağa Mah. 1. Sokak No: 5",
      }),
    );
  });

  it("createVideoOrder başarılı olunca dosya adımına geçer", async () => {
    vi.mocked(createVideoOrder).mockResolvedValue({
      ok: true,
      orderId: "order-1",
      status: "draft",
    });
    renderWizard();

    fireEvent.click(screen.getByRole("radio", { name: /Fotoğraflardan video/ }));
    fireEvent.click(screen.getByRole("button", { name: "Devam" }));
    fillProperty();
    fireEvent.click(screen.getByRole("button", { name: "Devam" }));

    expect(await screen.findByText("0/30 fotoğraf")).toBeInTheDocument();
    expect(screen.getByText(/en az 3 fotoğraf yükleyin/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Devam" })).toBeDisabled();
  });

  // AC-S2: fiyat istemciden gönderilmez; yerinde çekimde sipariş quote_pending olarak açılır.
  it("yerinde çekimde createVideoOrder fiyat göndermeden çağrılır ve özet adımına geçilir", async () => {
    vi.mocked(createVideoOrder).mockResolvedValue({
      ok: true,
      orderId: "order-9",
      status: "quote_pending",
    });
    renderWizard();

    fireEvent.click(screen.getByRole("radio", { name: /Yerinde çekim/ }));
    fireEvent.click(screen.getByRole("button", { name: "Devam" }));
    fillProperty();
    fireEvent.change(screen.getByLabelText("Size uygun gün ve saat"), {
      target: { value: "Cuma öğleden sonra" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Devam" }));

    expect(await screen.findByText(/Talebiniz alındı/)).toBeInTheDocument();
    expect(createVideoOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        serviceCode: "onsite",
        onsitePreferredTime: "Cuma öğleden sonra",
      }),
    );
    expect(
      screen.getByRole("link", { name: "Sipariş detayına git" }),
    ).toHaveAttribute("href", "/agent/videos/order-9");
    expect(screen.queryByRole("button", { name: "Siparişi gönder" })).toBeNull();
    expect(submitVideoOrder).not.toHaveBeenCalled();
  });
});
