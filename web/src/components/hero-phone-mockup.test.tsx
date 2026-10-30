// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { HeroPhoneMockup } from "./hero-phone-mockup";

describe("HeroPhoneMockup", () => {
  afterEach(() => {
    cleanup();
  });

  it("kök öğe role=img ve beklenen aria-label'a sahip", () => {
    render(<HeroPhoneMockup />);

    expect(
      screen.getByRole("img", {
        name: "Panelde ilan akışı örneği: filtrelenmiş üç ilan kartı",
      }),
    ).toBeInTheDocument();
  });

  it("üç ilan başlığını render eder", () => {
    render(<HeroPhoneMockup />);

    expect(screen.getByText("Kadıköy 3+1 Satılık Daire")).toBeInTheDocument();
    expect(screen.getByText("Ataşehir 2+1 Kiralık Daire")).toBeInTheDocument();
    expect(screen.getByText("Üsküdar 4+1 Satılık Villa")).toBeInTheDocument();
  });

  it("'3 yeni' rozetini gösterir", () => {
    render(<HeroPhoneMockup />);

    expect(screen.getByText("3 yeni")).toBeInTheDocument();
  });

  it("içerik aria-hidden sarmalayıcıda yer alır", () => {
    render(<HeroPhoneMockup />);

    const title = screen.getByText("Kadıköy 3+1 Satılık Daire");
    expect(title.closest('[aria-hidden="true"]')).not.toBeNull();
  });
});
