// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import LoginPage from "./page";

vi.mock("./actions", () => ({
  login: vi.fn(),
}));

describe("LoginPage (/login)", () => {
  afterEach(() => {
    cleanup();
  });

  // AC-10 (Medium): giriş sayfası kopyası güncel.
  it("AC-10: 'takip ettiğiniz WhatsApp gruplarındaki ilanlara' metni görünür", () => {
    render(<LoginPage />);

    expect(
      screen.getByText(/takip ettiğiniz WhatsApp gruplarındaki ilanlara/),
    ).toBeInTheDocument();
  });

  it("AC-10: eski 'WhatsApp'a attığınız ilanlara' metni yoktur", () => {
    const { container } = render(<LoginPage />);

    expect(screen.queryByText(/WhatsApp'a attığınız ilanlara/)).toBeNull();
    expect(container.textContent ?? "").not.toContain("WhatsApp'a attığınız");
  });

  // AC-13 (Medium): "Şifremi unuttum" linki /sifremi-unuttum'a gider.
  it("AC-13: 'Şifremi unuttum' linki href /sifremi-unuttum'a gider", () => {
    render(<LoginPage />);

    const link = screen.getByRole("link", { name: "Şifremi unuttum" });
    expect(link).toHaveAttribute("href", "/sifremi-unuttum");
  });
});
