// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SUPPORT_WHATSAPP_URL } from "@/lib/contact";

const mockPathname = vi.fn<() => string>();
vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname(),
}));

import { MarketingSupportButton } from "./marketing-support-button";

describe("MarketingSupportButton", () => {
  beforeEach(() => {
    mockPathname.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it("form sayfasında (/signup) yüzen buton mobilde gizli, md'de görünür; mobil metin link var", () => {
    mockPathname.mockReturnValue("/signup");
    render(<MarketingSupportButton />);

    const floating = screen.getByLabelText("WhatsApp destek");
    expect(floating).toHaveClass("hidden", "md:flex");

    const inline = screen.getByRole("link", { name: "Yardım mı lazım? WhatsApp destek" });
    expect(inline).toHaveAttribute("href", SUPPORT_WHATSAPP_URL);
    expect(inline).toHaveAttribute("target", "_blank");
    expect(inline).toHaveAttribute("rel", "noopener noreferrer");
    expect(inline).toHaveClass("md:hidden");
  });

  it.each(["/login", "/sifremi-unuttum", "/sifre-yenile"])(
    "%s form sayfasında da aynı davranış",
    (path) => {
      mockPathname.mockReturnValue(path);
      render(<MarketingSupportButton />);

      expect(screen.getByLabelText("WhatsApp destek")).toHaveClass("hidden", "md:flex");
      expect(
        screen.getByRole("link", { name: "Yardım mı lazım? WhatsApp destek" }),
      ).toBeInTheDocument();
    },
  );

  it("ana sayfada (/) buton normal görünür, mobil metin link yok", () => {
    mockPathname.mockReturnValue("/");
    render(<MarketingSupportButton />);

    const floating = screen.getByLabelText("WhatsApp destek");
    expect(floating).not.toHaveClass("hidden");
    expect(floating).toHaveClass("flex");
    expect(
      screen.queryByRole("link", { name: "Yardım mı lazım? WhatsApp destek" }),
    ).toBeNull();
  });
});
