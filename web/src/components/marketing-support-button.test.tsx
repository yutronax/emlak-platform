// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockPathname = vi.fn<() => string>();
vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname(),
}));

// Server action modülü (use server) test ortamında çağrılmaz; mock'lanır.
vi.mock("@/app/(marketing)/support/actions", () => ({
  sendSupportMessage: vi.fn(),
}));

import { MarketingSupportButton } from "./marketing-support-button";

describe("MarketingSupportButton", () => {
  beforeEach(() => {
    mockPathname.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it("WhatsApp'a yönlendirmez; Destek butonu ve mesaj formu vardır (link değil button)", () => {
    mockPathname.mockReturnValue("/");
    render(<MarketingSupportButton />);

    const button = screen.getByRole("button", { name: "Destek" });
    expect(button).toHaveClass("flex");
    expect(button.tagName).toBe("BUTTON");
    // Hiçbir WhatsApp (wa.me) bağlantısı render edilmez.
    expect(document.querySelector('a[href*="wa.me"]')).toBeNull();
    // Form alanları dialog içinde render edilir.
    expect(screen.getByLabelText("Adınız")).toBeInTheDocument();
    expect(screen.getByLabelText("Telefon veya e-posta")).toBeInTheDocument();
    expect(screen.getByLabelText("Mesajınız")).toBeInTheDocument();
  });

  it.each(["/signup", "/login", "/sifremi-unuttum", "/sifre-yenile"])(
    "%s form sayfasında yüzen buton mobilde gizli, md'de görünür",
    (path) => {
      mockPathname.mockReturnValue(path);
      render(<MarketingSupportButton />);
      expect(screen.getByRole("button", { name: "Destek" })).toHaveClass("hidden", "md:flex");
    },
  );
});
