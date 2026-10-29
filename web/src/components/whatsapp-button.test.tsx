// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { SUPPORT_WHATSAPP_URL } from "@/lib/contact";

import { WhatsAppButton } from "./whatsapp-button";

describe("WhatsAppButton", () => {
  afterEach(() => {
    cleanup();
  });

  it("destek numarasının wa.me linkine gider, yeni sekmede açılır", () => {
    render(<WhatsAppButton />);

    const link = screen.getByRole("link", { name: "WhatsApp destek" });
    expect(link).toHaveAttribute("href", SUPPORT_WHATSAPP_URL);
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  // AC-14 (High): erişilebilir ad, görünür metinden bağımsız olarak "WhatsApp destek".
  it("AC-14: erişilebilir adı 'WhatsApp destek' (aria-label)", () => {
    render(<WhatsAppButton />);

    expect(screen.getByLabelText("WhatsApp destek")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "WhatsApp'tan destek alın" })).toBeNull();
  });

  it("hideOnMobile: mobilde gizli (hidden), md ve üstünde flex olarak görünür", () => {
    render(<WhatsAppButton hideOnMobile />);

    const link = screen.getByLabelText("WhatsApp destek");
    expect(link).toHaveClass("hidden", "md:flex");
    expect(link).not.toHaveClass("flex");
  });

  it("hideOnMobile verilmezse her zaman görünür (flex, hidden yok)", () => {
    render(<WhatsAppButton />);

    const link = screen.getByLabelText("WhatsApp destek");
    expect(link).toHaveClass("flex", "bottom-4");
    expect(link).not.toHaveClass("hidden");
  });
});
