// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { FeedFilters } from "./feed-filters";

// EML-107 AC-8: "Kendi gruplarım" filtresi → scope='mine'.
// Form GET ile gönderilir; gönderilen FormData'daki kapsam alanı izlenir.

const OPTIONS = { cities: [], districts: [], groups: [] };
const EMPTY_FILTERS = {
  grup: null,
  fiyatMin: null,
  fiyatMax: null,
  oda: null,
  il: null,
  ilce: null,
  sayfa: 1,
};

// Kapsam seçeneği "Kendi gruplarım" içeren select (diğer select'lerden ayrışır).
function scopeSelect(): HTMLSelectElement {
  const select = screen
    .getAllByRole("combobox")
    .find((el) => within(el).queryByRole("option", { name: "Kendi gruplarım" }));
  if (!select) throw new Error("'Kendi gruplarım' seçeneği bulunamadı");
  return select as HTMLSelectElement;
}

// Uygula'ya basıldığında gönderilecek FormData'yı yakalar (navigasyon engellenir).
function captureSubmit(): { data: () => FormData | null } {
  let captured: FormData | null = null;
  const form = screen.getByRole("button", { name: "Uygula" }).closest("form");
  if (!form) throw new Error("filtre formu bulunamadı");
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    captured = new FormData(form);
  });
  return { data: () => captured };
}

afterEach(() => {
  cleanup();
});

describe("FeedFilters — Kendi gruplarım (AC-8)", () => {
  it("'Kendi gruplarım' seçilip uygulanınca filtre değeri scope='mine' olur", () => {
    render(<FeedFilters options={OPTIONS} filters={EMPTY_FILTERS as never} />);
    const submitted = captureSubmit();

    fireEvent.change(scopeSelect(), { target: { value: "mine" } });
    fireEvent.click(screen.getByRole("button", { name: "Uygula" }));

    const data = submitted.data();
    expect(data).not.toBeNull();
    expect(data?.get("kapsam")).toBe("mine");
  });

  it("varsayılan kapsam 'Tümü' ise filtre kapsam alanı boş gönderilir (kişisel filtre uygulanmaz)", () => {
    render(<FeedFilters options={OPTIONS} filters={EMPTY_FILTERS as never} />);
    const submitted = captureSubmit();

    fireEvent.click(screen.getByRole("button", { name: "Uygula" }));

    expect(submitted.data()?.get("kapsam")).not.toBe("mine");
  });
});
