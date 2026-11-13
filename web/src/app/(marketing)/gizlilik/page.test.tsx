// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SUPPORT_WHATSAPP_DISPLAY } from "@/lib/contact";

// Satır içi "Destek formu" butonu SupportDialog kullanır; sunucu action'ı test ortamında çağrılmaz.
vi.mock("@/app/(marketing)/support/actions", () => ({
  sendSupportMessage: vi.fn(),
}));

import GizlilikPage from "./page";

const NUMBER_RE = new RegExp(SUPPORT_WHATSAPP_DISPLAY.replace(/\+/g, "\\+"));

describe("Gizlilik Politikası sayfası — destek kanalı", () => {
  afterEach(() => {
    cleanup();
  });

  it("destek numarası düz metin olarak görünür ama bir link değildir", () => {
    render(<GizlilikPage />);

    expect(screen.getByText(NUMBER_RE).closest("a")).toBeNull();
  });

  it("'Destek formu' satır içi butonu, destek numarasıyla aynı bölümde yer alır", () => {
    render(<GizlilikPage />);

    const section = screen.getByRole("button", { name: "Destek formu" }).closest("section");
    expect(section).not.toBeNull();
    expect(section).toHaveTextContent(NUMBER_RE);
  });

  it("destek bölümünde WhatsApp adı geçmez; sayfada 'WhatsApp üzerinden' ifadesi yoktur", () => {
    const { container } = render(<GizlilikPage />);

    const section = screen.getByRole("button", { name: "Destek formu" }).closest("section");
    expect(section).not.toBeNull();
    expect(section?.textContent ?? "").not.toMatch(/WhatsApp/);
    expect(container.textContent ?? "").not.toMatch(/WhatsApp(\s+üzerinden|'tan)/);
  });

  it("hiçbir link WhatsApp'a (wa.me) gitmez", () => {
    const { container } = render(<GizlilikPage />);

    for (const a of Array.from(container.querySelectorAll("a[href]"))) {
      expect(a.getAttribute("href")?.includes("wa.me")).toBe(false);
    }
  });
});
