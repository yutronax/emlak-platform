// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockPathname = vi.fn<() => string>();
vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname(),
}));

import { HeaderNav } from "./header-nav";

describe("HeaderNav", () => {
  beforeEach(() => {
    mockPathname.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  // AC-2 (Critical): aktif link aria-current="page" taşır, diğerleri taşımaz.
  it("/pricing: 'Fiyatlar' aria-current='page' taşır, diğer linklerde aria-current yok", () => {
    mockPathname.mockReturnValue("/pricing");
    render(<HeaderNav />);

    expect(screen.getByRole("link", { name: "Fiyatlar" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "Giriş" })).not.toHaveAttribute("aria-current");
    expect(screen.getByRole("link", { name: "Kayıt Ol" })).not.toHaveAttribute("aria-current");
  });

  // AC-4 (High): /signup açıkken "Kayıt Ol" CTA'sı yok, "Giriş" görünür.
  it.each(["/signup", "/signup/x"])(
    "%s: 'Kayıt Ol' linki render edilmez, 'Giriş' linki görünür",
    (path) => {
      mockPathname.mockReturnValue(path);
      render(<HeaderNav />);

      expect(screen.queryByRole("link", { name: "Kayıt Ol" })).toBeNull();
      expect(screen.getByRole("link", { name: "Giriş" })).toHaveAttribute("href", "/login");
    },
  );

  // AC-4 (High): /login açıkken "Giriş" linki yok, "Kayıt Ol" CTA'sı kalır.
  it("/login: 'Giriş' linki render edilmez, 'Kayıt Ol' CTA'sı kalır", () => {
    mockPathname.mockReturnValue("/login");
    render(<HeaderNav />);

    expect(screen.queryByRole("link", { name: "Giriş" })).toBeNull();
    expect(screen.getByRole("link", { name: "Kayıt Ol" })).toHaveAttribute("href", "/signup");
  });

  // AC-3 (High) + AC-2: bilinmeyen yolda hiçbir link aktif değil; üç link de var.
  it("/kvkk: hiçbir linkte aria-current yok ve üç link de render edilir", () => {
    mockPathname.mockReturnValue("/kvkk");
    const { container } = render(<HeaderNav />);

    expect(container.querySelectorAll("[aria-current]")).toHaveLength(0);
    expect(screen.getByRole("link", { name: "Fiyatlar" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Giriş" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Kayıt Ol" })).toBeInTheDocument();
  });

  // AC-2 (Critical): aktif gösterge yalnız renge dayanmaz — font-semibold + alt çizgi.
  it("aktif linkin className'i font-semibold ve underline içerir", () => {
    mockPathname.mockReturnValue("/pricing");
    render(<HeaderNav />);

    expect(screen.getByRole("link", { name: "Fiyatlar" })).toHaveClass(
      "font-semibold",
      "underline",
    );
  });
});
