// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { selectConfirmService } from "@/lib/confirm-ui/service";
import type { ConfirmService } from "@/lib/confirm-ui/types";

import { resendConfirmation } from "./actions";
import { ConfirmView } from "./confirm-view";

vi.mock("./actions", () => ({ resendConfirmation: vi.fn() }));

const service = (resend: ConfirmService["resend"] = vi.fn(async () => ({ status: "ok" as const }))): ConfirmService => ({
  kind: "mock",
  resend,
});

afterEach(() => {
  cleanup();
});

describe("ConfirmView — onaylandı", () => {
  it("başlık, sıralı sonraki adımlar ve aksiyonlar", () => {
    const { container } = render(<ConfirmView state="onaylandi" service={null} />);

    expect(screen.getByRole("heading", { name: "E-postanız onaylandı" })).toBeInTheDocument();
    const steps = screen.getByRole("list", { name: "Sonraki adımlar" });
    expect(steps.tagName).toBe("OL");
    expect(steps.querySelectorAll("li")).toHaveLength(3);
    expect(screen.getByRole("link", { name: "WhatsApp'ı bağla" })).toHaveAttribute("href", "/agent/whatsapp");
    expect(screen.getByRole("link", { name: "Panele git" })).toHaveAttribute("href", "/agent/dashboard");
    expect(container.querySelector("img, svg")).toBeNull();
  });
});

describe("ConfirmView — geçersiz", () => {
  it("servis yoksa form yok, giriş yönlendirmesi var", () => {
    render(<ConfirmView state="gecersiz" service={null} />);

    expect(screen.getByRole("heading", { name: "Bu onay bağlantısı geçersiz" })).toBeInTheDocument();
    expect(screen.queryByLabelText("E-posta")).toBeNull();
    expect(screen.getByRole("link", { name: "Giriş yap" })).toHaveAttribute("href", "/login");
  });

  it("geçersiz e-postada servis çağrılmaz, hata alana bağlı", async () => {
    const resend = vi.fn();
    render(<ConfirmView state="gecersiz" service={service(resend)} />);

    fireEvent.change(screen.getByLabelText("E-posta"), { target: { value: "yanlis" } });
    fireEvent.click(screen.getByRole("button", { name: "Yeni bağlantı gönder" }));

    expect(await screen.findByText("Geçerli bir e-posta girin.")).toBeInTheDocument();
    expect(screen.getByLabelText("E-posta")).toHaveAttribute("aria-invalid", "true");
    expect(resend).not.toHaveBeenCalled();
  });

  it("gönderince hesabın varlığını açıklamayan genel metin gösterir ve formu gizler", async () => {
    const resend = vi.fn(async () => ({ status: "ok" as const }));
    render(<ConfirmView state="gecersiz" service={service(resend)} />);

    fireEvent.change(screen.getByLabelText("E-posta"), { target: { value: " ayse@acme.com " } });
    fireEvent.click(screen.getByRole("button", { name: "Yeni bağlantı gönder" }));

    expect(await screen.findByRole("status")).toHaveTextContent(
      "ayse@acme.com ile kayıtlı bir hesap varsa yeni bağlantı gönderdik.",
    );
    expect(resend).toHaveBeenCalledWith("ayse@acme.com");
    expect(screen.queryByLabelText("E-posta")).toBeNull();
  });

  it("oran sınırında alert gösterir, e-posta korunur", async () => {
    render(
      <ConfirmView
        state="gecersiz"
        service={service(vi.fn(async () => ({ status: "error" as const, code: "rate_limited" as const })))}
      />,
    );

    fireEvent.change(screen.getByLabelText("E-posta"), { target: { value: "ayse@acme.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Yeni bağlantı gönder" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Çok fazla deneme. Biraz sonra tekrar deneyin.");
    expect(screen.getByLabelText("E-posta")).toHaveValue("ayse@acme.com");
  });
});

describe("selectConfirmService", () => {
  it("production'da mock hata fırlatır; bayraksız gerçek servis; dev+bayrak mock", () => {
    expect(() => selectConfirmService({ nodeEnv: "production", mockFlag: "1" })).toThrow(/mock/i);
    expect(selectConfirmService({ nodeEnv: "production", mockFlag: undefined }).kind).toBe("real");
    expect(selectConfirmService({ nodeEnv: "development", mockFlag: "1" }).kind).toBe("mock");
  });

  it("gerçek servis sunucu aksiyonunu çağırır; ağ hatasını network'e çevirir", async () => {
    const real = selectConfirmService({ nodeEnv: "production", mockFlag: undefined });

    vi.mocked(resendConfirmation).mockResolvedValueOnce({ status: "error", code: "rate_limited" });
    expect(await real.resend("ayse@acme.com")).toEqual({ status: "error", code: "rate_limited" });
    expect(resendConfirmation).toHaveBeenCalledWith("ayse@acme.com");

    vi.mocked(resendConfirmation).mockRejectedValueOnce(new TypeError("Failed to fetch"));
    expect(await real.resend("ayse@acme.com")).toEqual({ status: "error", code: "network" });
  });
});
