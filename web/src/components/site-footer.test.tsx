// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SUPPORT_WHATSAPP_DISPLAY } from "@/lib/contact";

// Satır içi "Destek formu" butonu SupportDialog kullanır; sunucu action'ı test ortamında çağrılmaz.
vi.mock("@/app/(marketing)/support/actions", () => ({
  sendSupportMessage: vi.fn(),
}));

import { SiteFooter } from "./site-footer";

const NUMBER_RE = new RegExp(SUPPORT_WHATSAPP_DISPLAY.replace(/\+/g, "\\+"));

describe("SiteFooter", () => {
  afterEach(() => {
    cleanup();
  });

  it("yasal sayfalara doğru href'lerle link verir", () => {
    render(<SiteFooter />);

    expect(screen.getByRole("link", { name: "Gizlilik Politikası" })).toHaveAttribute(
      "href",
      "/gizlilik",
    );
    expect(screen.getByRole("link", { name: "KVKK Aydınlatma Metni" })).toHaveAttribute(
      "href",
      "/kvkk",
    );
    expect(screen.getByRole("link", { name: "Kullanım Şartları" })).toHaveAttribute(
      "href",
      "/kullanim-sartlari",
    );
  });

  it("iletişim satırında 'Destek formu' satır içi butonu bulunur; yüzen değildir", () => {
    render(<SiteFooter />);

    expect(screen.getByText(/İletişim:/)).toBeInTheDocument();
    const button = screen.getByRole("button", { name: "Destek formu" });
    expect(button).toHaveAttribute("type", "button");
    expect(button).not.toHaveClass("fixed");
  });

  it("destek numarası düz metin olarak görünür ama bir link değildir", () => {
    render(<SiteFooter />);

    const number = screen.getByText(NUMBER_RE);
    expect(number.closest("a")).toBeNull();
  });

  it("hiçbir link WhatsApp'a (wa.me) gitmez", () => {
    const { container } = render(<SiteFooter />);

    for (const a of Array.from(container.querySelectorAll("a[href]"))) {
      expect(a.getAttribute("href")?.includes("wa.me")).toBe(false);
    }
  });

  it("footer metninde WhatsApp adı geçmez", () => {
    const { container } = render(<SiteFooter />);

    expect(container.textContent ?? "").not.toMatch(/WhatsApp/);
  });
});
