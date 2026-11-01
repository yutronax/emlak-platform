// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import ErrorPage from "@/app/error";
import NotFound from "@/app/not-found";
import { SUPPORT_WHATSAPP_URL } from "@/lib/contact";

import { PageSkeleton } from "./page-skeleton";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("NotFound (kök 404)", () => {
  it("başlık, açıklama ve iki aksiyon; dekor gizli, img/svg yok", () => {
    const { container } = render(<NotFound />);

    expect(screen.getByRole("heading", { level: 1, name: "Bu sayfa bulunamadı" })).toBeInTheDocument();
    expect(screen.getByText(/Bağlantı eskimiş ya da adres yanlış yazılmış olabilir/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ana sayfa" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: "Panele git" })).toHaveAttribute("href", "/agent/dashboard");
    expect(container.querySelector("img, svg")).toBeNull();
    expect(container.querySelector("[data-status-decor]")).toHaveAttribute("aria-hidden", "true");
  });

  it("kaynağın varlığını ima eden 'yetki' dili kullanmaz", () => {
    const { container } = render(<NotFound />);

    expect(container.textContent).not.toMatch(/yetki|izin/i);
  });
});

describe("ErrorPage (segment hata sınırı)", () => {
  it("Tekrar dene retry'ı çağırır; destek bağlantısı WhatsApp'a gider", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const retry = vi.fn();
    render(<ErrorPage error={new Error("gizli ayrıntı")} retry={retry} />);

    fireEvent.click(screen.getByRole("button", { name: "Tekrar dene" }));
    expect(retry).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("link", { name: /WhatsApp/ })).toHaveAttribute("href", SUPPORT_WHATSAPP_URL);
    expect(screen.getByRole("link", { name: "Ana sayfa" })).toHaveAttribute("href", "/");
  });

  it("hata mesajını göstermez; digest varsa hata kodu olarak gösterir", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const err = Object.assign(new Error("db şifresi yanlış"), { digest: "abc123" });
    const { container } = render(<ErrorPage error={err} retry={vi.fn()} />);

    expect(container.textContent).not.toContain("db şifresi");
    expect(screen.getByText("Hata kodu: abc123")).toBeInTheDocument();
  });

  it("Error olmayan değerlerde de çöker değil; hata kodu satırı gösterilmez", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    render(<ErrorPage error={"string hata"} retry={vi.fn()} />);

    expect(screen.getByRole("heading", { level: 1, name: "Bir şeyler ters gitti" })).toBeInTheDocument();
    expect(screen.queryByText(/Hata kodu/)).toBeNull();
  });

  it("odak başlığa taşınır ve hata konsola yazılır", () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const err = new Error("x");
    render(<ErrorPage error={err} retry={vi.fn()} />);

    expect(screen.getByRole("heading", { level: 1 })).toHaveFocus();
    expect(log).toHaveBeenCalledWith(err);
  });
});

describe("PageSkeleton", () => {
  it("aria-busy ve ekran okuyucu için 'Yükleniyor…'", () => {
    render(<PageSkeleton />);

    const region = screen.getByRole("status");
    expect(region).toHaveAttribute("aria-busy", "true");
    expect(region).toHaveTextContent("Yükleniyor…");
  });
});
