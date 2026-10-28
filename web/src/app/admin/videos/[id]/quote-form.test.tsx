// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { setQuote } from "../actions";

import { QuoteForm } from "./quote-form";

const { refresh } = vi.hoisted(() => ({ refresh: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
}));

vi.mock("../actions", () => ({
  setQuote: vi.fn(),
}));

const ORDER_ID = "order-1";

function fillPriceAndSubmit(value: string) {
  fireEvent.change(screen.getByLabelText("Fiyat (TL)"), { target: { value } });
  fireEvent.click(screen.getByRole("button", { name: "Fiyatı gönder" }));
}

describe("QuoteForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  // AC-8: sunucu hatası kullanıcıya açık mesajla gösterilir.
  it("sunucu hata dönerse hata mesajını alert olarak gösterir ve yenilemez", async () => {
    vi.mocked(setQuote).mockResolvedValue({
      ok: false,
      error: "INVALID_INPUT",
      message: "Fiyat 1 ile 100000 TL arasında olmalı.",
    });
    render(<QuoteForm orderId={ORDER_ID} />);

    fillPriceAndSubmit("abc");

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Fiyat 1 ile 100000 TL arasında olmalı.",
    );
    expect(setQuote).toHaveBeenCalledWith(ORDER_ID, "abc");
    expect(refresh).not.toHaveBeenCalled();
  });

  // AC-8: başarıda sayfa yenilenir (durum awaiting_payment'a döner).
  it("başarılı teklifte router.refresh() çağrılır", async () => {
    vi.mocked(setQuote).mockResolvedValue({ ok: true });
    render(<QuoteForm orderId={ORDER_ID} />);

    fillPriceAndSubmit("1.500,50");

    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
    expect(setQuote).toHaveBeenCalledWith(ORDER_ID, "1.500,50");
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("fiyat alanı decimal klavye modunu kullanır", () => {
    render(<QuoteForm orderId={ORDER_ID} />);

    expect(screen.getByLabelText("Fiyat (TL)")).toHaveAttribute("inputmode", "decimal");
  });
});
