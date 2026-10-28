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

    const link = screen.getByRole("link", { name: "WhatsApp'tan destek alın" });
    expect(link).toHaveAttribute("href", SUPPORT_WHATSAPP_URL);
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });
});
