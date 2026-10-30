// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { ListingCard } from "./listing-card";

// Sabit "şimdi": 2026-10-28 12:00 UTC (= 15:00 Europe/Istanbul).
const NOW = new Date("2026-10-28T12:00:00.000Z");

// Açık satır: FeedRow alanları + locked:false (EML-98 sözleşmesi).
const OPEN_ROW = {
  id: "l-1",
  title: "Merkezde Güzel Daire",
  price: 2500000,
  currency: "TRY",
  rooms: "3+1",
  area_m2: 120,
  city: "İstanbul",
  district: "Kadıköy",
  source_group_name: "Grup A",
  created_at: "2026-10-28T11:48:00.000Z", // 12 dk önce
  locked: false,
};

// Kilitli satır: YALNIZ {id, city, district, created_at, locked:true} (AC-4, AC-S2).
const LOCKED_ROW = {
  id: "l-9",
  city: "İstanbul",
  district: "Ataşehir",
  created_at: "2026-10-28T11:48:00.000Z", // 12 dk önce
  locked: true,
};

afterEach(() => {
  cleanup();
});

describe("ListingCard — kilitli öğe (AC-4)", () => {
  // AC-4 (High): kilitli kartta il/ilçe ve geliş zamanı görünür.
  it("il/ilçe ve geliş zamanını gösterir", () => {
    render(<ListingCard listing={LOCKED_ROW as never} now={NOW} />);

    expect(screen.getByText("İstanbul / Ataşehir")).toBeInTheDocument();
    expect(screen.getByText("12 dk önce")).toBeInTheDocument();
  });

  // AC-4 (High): kilitli kartta başlık ve fiyat yok (veri zaten gelmez).
  it("başlık (h2) ve fiyat metni göstermez", () => {
    const { container } = render(
      <ListingCard listing={LOCKED_ROW as never} now={NOW} />,
    );

    expect(container.querySelector("h2")).toBeNull();
    expect(container.textContent).not.toMatch(/TRY/);
    expect(container.textContent).not.toMatch(/Fiyat belirtilmemiş/);
    expect(container.textContent).not.toMatch(/m²/);
  });

  // AC-4 (High): "Planı yükselt" linki /pricing'e gider.
  it("'Planı yükselt' linki /pricing hedefine gider", () => {
    render(<ListingCard listing={LOCKED_ROW as never} now={NOW} />);

    const link = screen.getByRole("link", { name: "Planı yükselt" });
    expect(link).toHaveAttribute("href", "/pricing");
  });

  // Nullable kuralı (atdd Davranış Sözleşmesi): city ve district null -> "Konum belirtilmemiş".
  it("city ve district null ise 'Konum belirtilmemiş' gösterir ve 'null'/'undefined'/'Invalid Date' sızdırmaz", () => {
    const { container } = render(
      <ListingCard
        listing={{ ...LOCKED_ROW, city: null, district: null } as never}
        now={NOW}
      />,
    );

    expect(screen.getByText("Konum belirtilmemiş")).toBeInTheDocument();
    expect(screen.getByText("12 dk önce")).toBeInTheDocument();
    const text = container.textContent ?? "";
    expect(text).not.toMatch(/null/);
    expect(text).not.toMatch(/undefined/);
    expect(text).not.toMatch(/Invalid Date/);
    expect(text).not.toMatch(/NaN/);
  });
});

describe("ListingCard — açık öğe (mevcut görünüm)", () => {
  it("başlık, fiyat, oda, m², konum ve geliş zamanını gösterir", () => {
    render(<ListingCard listing={OPEN_ROW as never} now={NOW} />);

    expect(screen.getByText("Merkezde Güzel Daire")).toBeInTheDocument();
    expect(screen.getByText("2.500.000 TRY")).toBeInTheDocument();
    expect(screen.getByText("3+1")).toBeInTheDocument();
    expect(screen.getByText("120 m²")).toBeInTheDocument();
    expect(screen.getByText("İstanbul / Kadıköy")).toBeInTheDocument();
    expect(screen.getByText("12 dk önce")).toBeInTheDocument();
  });

  it("açık kartta 'Planı yükselt' linki yoktur", () => {
    render(<ListingCard listing={OPEN_ROW as never} now={NOW} />);

    expect(screen.queryByRole("link", { name: "Planı yükselt" })).toBeNull();
  });
});
