// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

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
});
