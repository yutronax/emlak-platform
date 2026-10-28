// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PayButton } from "./pay-button";

const ORDER_ID = "11111111-1111-4111-8111-111111111111";
const CHECKOUT_URL = "https://sandbox-payment.example/checkout/abc";

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function renderButton() {
  return render(<PayButton orderId={ORDER_ID} amountLabel="750,00 ₺" />);
}

describe("PayButton", () => {
  const assign = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("location", { assign });
    vi.stubGlobal("fetch", vi.fn());
    assign.mockClear();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  // AC-12: 201 ile dönen checkout_url'e yönlendirme yapılır.
  it("201 yanıtında checkout_url'e yönlendirir", async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse(201, { order_id: ORDER_ID, checkout_url: CHECKOUT_URL, expires_at: "2026-10-28T12:00:00.000Z" }),
    );
    renderButton();

    fireEvent.click(screen.getByRole("button", { name: "Öde (750,00 ₺)" }));

    await waitFor(() => expect(assign).toHaveBeenCalledWith(CHECKOUT_URL));
  });

  it("https olmayan checkout_url'e yönlendirmez, hata gösterir", async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse(201, { order_id: ORDER_ID, checkout_url: "javascript:alert(1)", expires_at: "2026-10-28T12:00:00.000Z" }),
    );
    renderButton();

    fireEvent.click(screen.getByRole("button", { name: "Öde (750,00 ₺)" }));

    expect(await screen.findByText("Ödeme sayfası açılamadı. Tekrar deneyin.")).toBeInTheDocument();
    expect(assign).not.toHaveBeenCalled();
    expect(fetch).toHaveBeenCalledWith(`/api/video-orders/${ORDER_ID}/checkout`, { method: "POST" });
  });

  it("409 QUOTE_PENDING yanıtında teklif bekleniyor mesajını gösterir", async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse(409, { error: "QUOTE_PENDING", message: "x" }));
    renderButton();

    fireEvent.click(screen.getByRole("button", { name: "Öde (750,00 ₺)" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Fiyat teklifi henüz verilmedi.");
    expect(assign).not.toHaveBeenCalled();
  });

  it("409 diğer hatalarda sayfayı yenileme mesajını gösterir", async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse(409, { error: "INVALID_STATE", message: "x" }));
    renderButton();

    fireEvent.click(screen.getByRole("button", { name: "Öde (750,00 ₺)" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Bu sipariş şu an ödenemez. Sayfayı yenileyin.",
    );
  });

  it("504 yanıtında zaman aşımı mesajını gösterir", async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse(504, { error: "PAYMENT_TIMEOUT", message: "x" }));
    renderButton();

    fireEvent.click(screen.getByRole("button", { name: "Öde (750,00 ₺)" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Ödeme sayfası zamanında açılamadı. Tekrar deneyin.",
    );
  });

  it("ağ hatasında genel hata mesajını gösterir", async () => {
    vi.mocked(fetch).mockRejectedValue(new TypeError("Failed to fetch"));
    renderButton();

    fireEvent.click(screen.getByRole("button", { name: "Öde (750,00 ₺)" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Ödeme sayfası açılamadı. Tekrar deneyin.");
    expect(screen.getByRole("button", { name: "Öde (750,00 ₺)" })).toBeEnabled();
  });

  // AC-12: istek sürerken buton devre dışıdır ve tekrar tıklanamaz.
  it("istek sürerken butonu devre dışı bırakır", async () => {
    vi.mocked(fetch).mockReturnValue(new Promise(() => {}));
    renderButton();

    fireEvent.click(screen.getByRole("button", { name: "Öde (750,00 ₺)" }));

    const pendingButton = await screen.findByRole("button", { name: "Ödeme sayfası açılıyor…" });
    expect(pendingButton).toBeDisabled();
    expect(pendingButton).toHaveAttribute("aria-busy", "true");
  });
});
