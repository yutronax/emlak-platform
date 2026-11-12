// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const pathname = vi.hoisted(() => ({ value: "/agent/dashboard" }));
vi.mock("next/navigation", () => ({ usePathname: () => pathname.value }));
vi.mock("@/app/auth/actions", () => ({ signOut: vi.fn() }));

import { AppHeader } from "./app-header";

beforeEach(() => {
  pathname.value = "/agent/dashboard";
});

afterEach(() => {
  cleanup();
});

describe("AppHeader — bölüm gezinmesi", () => {
  it("logo ana sayfaya gider; panel bölümleri ve herkese açık vitrin bağlantısı var", () => {
    render(<AppHeader email="ayse@acme.com" showProfile />);

    expect(screen.getByRole("link", { name: "Emlak Platformu" })).toHaveAttribute("href", "/");
    const nav = screen.getByRole("navigation", { name: "Panel bölümleri" });
    expect(within(nav).getAllByRole("link").map((l) => [l.textContent, l.getAttribute("href")])).toEqual([
      ["İlanlar", "/agent/dashboard"],
      ["WhatsApp", "/agent/whatsapp"],
      ["Videolar", "/agent/videos"],
      ["Vitrin", "/vitrin"],
    ]);
  });

  it("ad verilmişse çubukta ve menüde e-posta yerine ad görünür", () => {
    render(<AppHeader email="ayse@acme.com" name="Ayşe Yılmaz" showProfile />);

    const trigger = screen.getByRole("button", { name: "Hesap menüsü (Ayşe Yılmaz)" });
    expect(within(trigger).getByText("Ayşe Yılmaz")).toBeInTheDocument();
    expect(within(trigger).getByText("A")).toBeInTheDocument();
    expect(within(trigger).queryByText("ayse@acme.com")).toBeNull();
    fireEvent.click(trigger);
    const menu = screen.getByRole("menu");
    expect(within(menu).getByText("Ayşe Yılmaz")).toBeInTheDocument();
    expect(within(menu).getByText("ayse@acme.com")).toBeInTheDocument();
  });

  it("alt sayfada ilgili bölüm aria-current=page", () => {
    pathname.value = "/agent/videos/abc";
    render(<AppHeader email="ayse@acme.com" showProfile />);

    expect(screen.getByRole("link", { name: "Videolar" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "İlanlar" })).not.toHaveAttribute("aria-current");
  });

  it("hesap sayfalarında hiçbir bölüm aktif değil", () => {
    pathname.value = "/account/profile";
    render(<AppHeader email="ayse@acme.com" showProfile />);

    const nav = screen.getByRole("navigation", { name: "Panel bölümleri" });
    expect(within(nav).queryAllByRole("link", { current: "page" })).toHaveLength(0);
  });
});

describe("AppHeader — özel bölümler (admin)", () => {
  it("verilen bölümler, gezinme etiketi ve logo hedefi kullanılır", () => {
    pathname.value = "/admin/agents/a1";
    render(
      <AppHeader
        email="admin@acme.com"
        showProfile
        homeHref="/admin"
        navLabel="Yönetim bölümleri"
        sections={[
          { href: "/admin", label: "Genel bakış", exact: true },
          { href: "/admin/agents", label: "Emlakçılar" },
        ]}
      />,
    );

    expect(screen.getByRole("link", { name: "Emlak Platformu" })).toHaveAttribute("href", "/admin");
    const nav = screen.getByRole("navigation", { name: "Yönetim bölümleri" });
    expect(within(nav).getByRole("link", { name: "Emlakçılar" })).toHaveAttribute("aria-current", "page");
    // "/admin" yalnız tam eşleşmede aktif (alt sayfalarda değil).
    expect(within(nav).getByRole("link", { name: "Genel bakış" })).not.toHaveAttribute("aria-current");
  });
});

describe("AppHeader — hesap menüsü", () => {
  const openMenu = () => fireEvent.click(screen.getByRole("button", { name: /Hesap menüsü/ }));

  it("kapalı başlar; açılınca e-posta, Profil, Abonelik ve Çıkış görünür, ilk öğe odaklanır", () => {
    render(<AppHeader email="ayse@acme.com" showProfile />);

    const trigger = screen.getByRole("button", { name: /Hesap menüsü/ });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("menu")).toBeNull();

    openMenu();
    const menu = screen.getByRole("menu");
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(within(menu).getByText("ayse@acme.com")).toBeInTheDocument();
    const items = within(menu).getAllByRole("menuitem");
    expect(items.map((i) => i.textContent)).toEqual(["Profil", "Abonelik", "Çıkış yap"]);
    expect(items[0]).toHaveAttribute("href", "/account/profile");
    expect(items[1]).toHaveAttribute("href", "/account/subscription");
    expect(items[0]).toHaveFocus();
  });

  it("profil servisi yoksa Profil öğesi gösterilmez", () => {
    render(<AppHeader email="ayse@acme.com" showProfile={false} />);
    openMenu();

    expect(within(screen.getByRole("menu")).getAllByRole("menuitem").map((i) => i.textContent)).toEqual([
      "Abonelik",
      "Çıkış yap",
    ]);
  });

  it("ok tuşlarıyla gezilir, Esc kapatır ve odak düğmeye döner", () => {
    render(<AppHeader email="ayse@acme.com" showProfile />);
    openMenu();
    const items = screen.getAllByRole("menuitem");

    fireEvent.keyDown(items[0], { key: "ArrowDown" });
    expect(items[1]).toHaveFocus();
    fireEvent.keyDown(items[1], { key: "ArrowUp" });
    expect(items[0]).toHaveFocus();
    fireEvent.keyDown(items[0], { key: "ArrowUp" });
    expect(items[2]).toHaveFocus();

    fireEvent.keyDown(items[2], { key: "Escape" });
    expect(screen.queryByRole("menu")).toBeNull();
    expect(screen.getByRole("button", { name: /Hesap menüsü/ })).toHaveFocus();
  });

  it("dışarı tıklayınca kapanır", () => {
    render(<AppHeader email="ayse@acme.com" showProfile />);
    openMenu();

    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("Çıkış yap bir form gönderimidir (JS olmadan da çalışır)", () => {
    render(<AppHeader email="ayse@acme.com" showProfile />);
    openMenu();

    const logout = screen.getByRole("menuitem", { name: "Çıkış yap" });
    expect(logout).toHaveAttribute("type", "submit");
    expect(logout.closest("form")).not.toBeNull();
  });

  it("e-posta yoksa rozet '?' ve başlık 'Hesabım'", () => {
    render(<AppHeader email={null} showProfile />);

    expect(screen.getByRole("button", { name: /Hesap menüsü/ })).toHaveTextContent("?");
    openMenu();
    expect(within(screen.getByRole("menu")).getByText("Hesabım")).toBeInTheDocument();
  });
});
