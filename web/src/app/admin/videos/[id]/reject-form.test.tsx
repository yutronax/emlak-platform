// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { rejectOrder } from "../actions";

import { RejectForm } from "./reject-form";

const { refresh } = vi.hoisted(() => ({ refresh: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
}));

vi.mock("../actions", () => ({
  rejectOrder: vi.fn(),
}));

const ORDER_ID = "order-1";

function typeReason(value: string) {
  fireEvent.change(screen.getByLabelText("Reddetme gerekçesi"), { target: { value } });
}

describe("RejectForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  // AC-8: onaysız reddetme yok — önce "Bu talep reddedilecek" onayı istenir.
  it("gerekçe girilip Reddet'e basılınca onay ister, onaylanmadan rejectOrder çağrılmaz", async () => {
    render(<RejectForm orderId={ORDER_ID} />);

    typeReason("Adres kapsam dışında");
    fireEvent.click(screen.getByRole("button", { name: "Reddet" }));

    expect(await screen.findByText("Bu talep reddedilecek.")).toBeInTheDocument();
    expect(rejectOrder).not.toHaveBeenCalled();
  });

  it("kısa gerekçeyle onay adımına geçmez ve hata gösterir", () => {
    render(<RejectForm orderId={ORDER_ID} />);

    typeReason("ok");
    fireEvent.click(screen.getByRole("button", { name: "Reddet" }));

    expect(screen.getByRole("alert")).toHaveTextContent("Gerekçe en az 5 karakter olmalı.");
    expect(screen.queryByText("Bu talep reddedilecek.")).toBeNull();
    expect(rejectOrder).not.toHaveBeenCalled();
  });

  // AC-8: onaylanınca gerekçeyle rejectOrder çağrılır ve sayfa yenilenir.
  it("onaylanınca rejectOrder(orderId, gerekçe) çağrılır ve refresh edilir", async () => {
    vi.mocked(rejectOrder).mockResolvedValue({ ok: true });
    render(<RejectForm orderId={ORDER_ID} />);

    typeReason("  Adres kapsam dışında  ");
    fireEvent.click(screen.getByRole("button", { name: "Reddet" }));
    fireEvent.click(await screen.findByRole("button", { name: "Evet, reddet" }));

    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
    expect(rejectOrder).toHaveBeenCalledWith(ORDER_ID, "Adres kapsam dışında");
  });

  it("sunucu hatası dönerse mesajı gösterir ve onay adımını kapatır", async () => {
    vi.mocked(rejectOrder).mockResolvedValue({
      ok: false,
      error: "INVALID_STATE",
      message: "Bu talep artık reddedilemez.",
    });
    render(<RejectForm orderId={ORDER_ID} />);

    typeReason("Adres kapsam dışında");
    fireEvent.click(screen.getByRole("button", { name: "Reddet" }));
    fireEvent.click(await screen.findByRole("button", { name: "Evet, reddet" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Bu talep artık reddedilemez.");
    expect(screen.queryByText("Bu talep reddedilecek.")).toBeNull();
    expect(refresh).not.toHaveBeenCalled();
  });
});
