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

describe("LoginPage (/login) — form üstte, dekoratif panel yok (AC-5)", () => {
  afterEach(() => {
    cleanup();
  });

  // AC-5 (High): dekoratif çizim (img) kaldırıldı.
  it("sayfada img elementi yok", () => {
    const { container } = render(<LoginPage />);

    expect(container.querySelector("img")).toBeNull();
  });

  // AC-5 (High): koyu sol panel (bg-ink-900) kaldırıldı.
  it("koyu sol panel (bg-ink-900) yok", () => {
    const { container } = render(<LoginPage />);

    expect(container.querySelector(".bg-ink-900")).toBeNull();
  });

  // AC-5 (High): "Emlak Platformu" sol panel başlığı yok; form başlığı görünür.
  it("'Emlak Platformu' başlığı sayfada yok, 'Giriş yap' başlığı form üstünde var", () => {
    render(<LoginPage />);

    expect(screen.queryByRole("heading", { name: "Emlak Platformu" })).toBeNull();
    expect(screen.getByRole("heading", { name: "Giriş yap" })).toBeInTheDocument();
  });
});
