// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { SUPPORT_WHATSAPP_DISPLAY, SUPPORT_WHATSAPP_URL } from "@/lib/contact";

import { SiteFooter } from "./site-footer";

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

  it("iletişim satırında destek WhatsApp numarası ve linki bulunur", () => {
    render(<SiteFooter />);

    const link = screen.getByRole("link", { name: SUPPORT_WHATSAPP_DISPLAY });
    expect(link).toHaveAttribute("href", SUPPORT_WHATSAPP_URL);
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });
});
