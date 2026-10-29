// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

// SiteHeader, client HeaderNav'ı içerdiği için usePathname gerekir.
vi.mock("next/navigation", () => ({
  usePathname: () => "/",
}));

import { SiteHeader } from "./site-header";

describe("SiteHeader", () => {
  afterEach(() => {
    cleanup();
  });

  // AC-1 (Critical): mobilde tek satır; "Kayıt Ol" tek metin düğümü (sarılmadan, tek parça).
  it("AC-1: 'Kayıt Ol' tek bir metin düğümü olarak render edilir ve /signup'a gider", () => {
    render(<SiteHeader />);

    const signup = screen.getByRole("link", { name: "Kayıt Ol" });
    expect(signup).toHaveAttribute("href", "/signup");
    expect(signup.childNodes).toHaveLength(1);
    expect(signup.firstChild?.nodeType).toBe(Node.TEXT_NODE);
    expect(screen.queryAllByText("Kayıt Ol")).toHaveLength(1);
  });

  // AC-1: "Giriş" metin linki, /login'e gider.
  it("AC-1: 'Giriş' metin linki /login'e gider", () => {
    render(<SiteHeader />);

    const login = screen.getByRole("link", { name: "Giriş" });
    expect(login).toHaveAttribute("href", "/login");
  });

  // AC-1: hamburger yok; nav linkleri ve logo mevcut.
  it("AC-1: nav linkleri (Fiyatlar, Giriş, Kayıt Ol) var, hamburger (buton) yok", () => {
    render(<SiteHeader />);

    expect(screen.getByRole("link", { name: "Fiyatlar" })).toHaveAttribute("href", "/pricing");
    expect(screen.getByRole("link", { name: "Giriş" })).toHaveAttribute("href", "/login");
    expect(screen.getByRole("link", { name: "Kayıt Ol" })).toHaveAttribute("href", "/signup");
    expect(screen.getByRole("link", { name: "Emlak Platformu" })).toHaveAttribute("href", "/");
    expect(screen.queryByRole("button")).toBeNull();
  });

  // AC-1 (Critical): header iç sarmalayıcısı marketing container'ı ile aynı (max-w-6xl px-4 md:px-6).
  it("AC-1: header iç sarmalayıcısı max-w-6xl, px-4 ve md:px-6 taşır", () => {
    const { container } = render(<SiteHeader />);

    const wrapper = container.querySelector("header > div");
    expect(wrapper).not.toBeNull();
    expect(wrapper).toHaveClass("max-w-6xl", "px-4", "md:px-6");
  });

  // AC-7 (Medium): logo md ve üstünde text-xl.
  it("AC-7: logo md:text-xl sınıfını taşır", () => {
    render(<SiteHeader />);

    expect(screen.getByRole("link", { name: "Emlak Platformu" })).toHaveClass("md:text-xl");
  });
});
