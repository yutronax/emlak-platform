// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { requestPasswordReset } from "./actions";
import ForgotPasswordPage from "./page";

vi.mock("./actions", () => ({
  requestPasswordReset: vi.fn(),
}));

const SUCCESS_LINE_1 = "Bu adrese kayıtlı bir hesap varsa sıfırlama bağlantısı gönderdik.";
const SUCCESS_LINE_2 = "E-posta gelmediyse spam klasörünü kontrol edin; 60 sn sonra tekrar gönderebilirsiniz.";

function submitEmail(email: string) {
  fireEvent.change(screen.getByLabelText("E-posta"), { target: { value: email } });
  fireEvent.click(screen.getByRole("button", { name: /gönder/i }));
}

describe("ForgotPasswordPage (/sifremi-unuttum)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  // AC-11 (Critical): başarı mesajı iki satır, birebir.
  it("AC-11: gönderimden sonra iki başarı metnini birebir gösterir", async () => {
    vi.mocked(requestPasswordReset).mockResolvedValue({ ok: true });
    render(<ForgotPasswordPage />);

    submitEmail("kayitli@example.com");

    expect(await screen.findByText(SUCCESS_LINE_1)).toBeInTheDocument();
    expect(screen.getByText(SUCCESS_LINE_2)).toBeInTheDocument();
    expect(requestPasswordReset).toHaveBeenCalledTimes(1);
  });

  // AC-11: geçersiz format -> "Geçerli bir e-posta girin".
  it("AC-11: sunucu geçersiz format hatası dönerse 'Geçerli bir e-posta girin' gösterir", async () => {
    vi.mocked(requestPasswordReset).mockResolvedValue({ error: "Geçerli bir e-posta girin" });
    render(<ForgotPasswordPage />);

    submitEmail("abc");

    expect(await screen.findByText("Geçerli bir e-posta girin")).toBeInTheDocument();
    expect(screen.queryByText(SUCCESS_LINE_1)).toBeNull();
  });

  // AC-11 (Critical): gönderimden sonra buton 60 sn pasif kalır.
  it("AC-11: gönder butonu gönderimden sonra 60 sn pasif kalır", async () => {
    // Gerçek saat akmaz (shouldAdvanceTime yok): paralel yükte sahte saat kaymaz.
    // Süre yalnız advanceTimersByTime ile ilerletilir; async sonuç act ile beklenir (waitFor yok).
    vi.useFakeTimers({ shouldAdvanceTime: false });
    vi.mocked(requestPasswordReset).mockResolvedValue({ ok: true });
    render(<ForgotPasswordPage />);

    await act(async () => {
      submitEmail("kayitli@example.com");
    });
    expect(screen.getByText(SUCCESS_LINE_1)).toBeInTheDocument();

    const button = screen.getByRole("button", { name: /gönder/i });
    expect(button).toBeDisabled();

    await act(async () => {
      vi.advanceTimersByTime(59_999);
    });
    expect(screen.getByRole("button", { name: /gönder/i })).toBeDisabled();

    await act(async () => {
      vi.advanceTimersByTime(1);
    });
    expect(screen.getByRole("button", { name: /gönder/i })).toBeEnabled();
  });
});
