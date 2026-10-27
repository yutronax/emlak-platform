// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Button } from "./button";

describe("Button (ui)", () => {
  afterEach(() => {
    cleanup();
  });

  // AC-1/AC-2 (tasarım sözleşmesi): birincil buton terracotta token ailesini kullanır.
  it("variant=\"primary\" iken class'ında terracotta token'ı geçer", () => {
    render(<Button variant="primary">Kayıt Ol</Button>);

    const button = screen.getByRole("button", { name: "Kayıt Ol" });
    expect(button.className).toContain("terracotta");
  });

  // plan.md madde 3: ikincil varyant ink-900 border/metin rengini kullanır.
  it("variant=\"secondary\" iken class'ında ink token'ı geçer", () => {
    render(<Button variant="secondary">Fiyatları Gör</Button>);

    const button = screen.getByRole("button", { name: "Fiyatları Gör" });
    expect(button.className).toContain("ink");
  });

  // AC-6 (disabled kısmı): disabled prop'u gerçek HTML disabled attribute'una dönüşür.
  it("disabled verildiğinde gerçek <button disabled> attribute'u set edilir", () => {
    render(<Button disabled>Gönder</Button>);

    expect(screen.getByRole("button", { name: "Gönder" })).toBeDisabled();
  });

  // AC-6: isPending iken aria-busy="true" set edilir ve bir yükleniyor göstergesi bulunur.
  // Tam metin assert edilmez (implementasyon "Giriş yapılıyor…" veya spinner seçebilir).
  it("isPending verildiğinde aria-busy=\"true\" set edilir ve yükleniyor göstergesi render edilir", () => {
    render(<Button isPending>Giriş Yap</Button>);

    const button = screen.getByRole("button");
    expect(button).toHaveAttribute("aria-busy", "true");
    // Gösterge: ya bir spinner (role/aria-label) ya da "…ılıyor"/"Yükleniyor" metni.
    const indicator =
      button.querySelector("[aria-hidden='true'], svg, [role='status']") ??
      screen.queryByText(/yükleniyor|ılıyor|ıyor/i);
    expect(indicator).not.toBeNull();
  });

  // Normal (pending/disabled olmayan) durumda onClick çağrılabilmeli.
  it("disabled olmayan durumda onClick handler'ı tıklamada çağrılır", () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Tıkla</Button>);

    fireEvent.click(screen.getByRole("button", { name: "Tıkla" }));

    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
