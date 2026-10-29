// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import LandingPage from "./page";

const GUVEN_BASLIK = "WhatsApp'ım güvende mi?";

function guvenSection() {
  const heading = screen.getByRole("heading", { name: GUVEN_BASLIK });
  const section = heading.closest("section");
  expect(section).not.toBeNull();
  return section as HTMLElement;
}

describe("Landing (/) — WhatsApp güven bölümü (AC-9)", () => {
  afterEach(() => {
    cleanup();
  });

  // AC-9 (High): "Nasıl çalışır" adımlarının hemen altında, başlığı "WhatsApp'ım güvende mi?".
  it("AC-9: 'WhatsApp'ım güvende mi?' başlığı, 'Nasıl çalışır' adımlarının altında yer alır", () => {
    render(<LandingPage />);

    const step = screen.getByText("Gruplarınızı seçin");
    const heading = screen.getByRole("heading", { name: GUVEN_BASLIK });
    expect(step.compareDocumentPosition(heading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  // AC-9: 4 madde — Bugün ortak hesap / Hesabınız bağlandığında (planlanan) / Ban riski / KVKK.
  it("AC-9: güven bölümünde tam 4 madde vardır", () => {
    render(<LandingPage />);

    const items = within(guvenSection()).getAllByRole("listitem");
    expect(items).toHaveLength(4);
  });

  it("AC-9: 4 madde konularını kapsar: bugün ortak hesap, bağlandığında, ban riski, KVKK", () => {
    render(<LandingPage />);

    const section = within(guvenSection());
    expect(section.getByText(/Bugün ortak hesap/)).toBeInTheDocument();
    expect(section.getByText(/Hesabınız bağlandığında/)).toBeInTheDocument();
    expect(section.getByText(/Ban riski/i)).toBeInTheDocument();
    expect(section.getByText(/KVKK/)).toBeInTheDocument();
  });

  // AC-9 (High): gelecek özellik "planlanan" diye etiketli.
  it("AC-9: gelecek özellik 'planlanan' diye etiketlenir", () => {
    render(<LandingPage />);

    expect(within(guvenSection()).getByText(/planlanan/)).toBeInTheDocument();
  });

  // AC-9 (High): yasak iddialar sayfada hiç geçmez.
  it("AC-9: sayfada 'garanti', '%100' ve 'ban olmaz' ifadeleri yoktur", () => {
    const { container } = render(<LandingPage />);

    const text = (container.textContent ?? "").toLocaleLowerCase("tr-TR");
    expect(text).not.toContain("garanti");
    expect(text).not.toContain("%100");
    expect(text).not.toContain("ban olmaz");
  });
});
