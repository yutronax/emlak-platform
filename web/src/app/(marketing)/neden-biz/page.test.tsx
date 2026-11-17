// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import WhyUsPage from "./page";

describe("/neden-biz", () => {
  afterEach(() => cleanup());

  it("başlık, altı neden ve karşılaştırma tablosu görünür", () => {
    render(<WhyUsPage />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("gerçek haliyle");
    expect(screen.getAllByRole("listitem")).toHaveLength(6);
    const table = screen.getByRole("table");
    expect(screen.getAllByRole("row")).toHaveLength(7);
    expect(table).toHaveTextContent("750 TL sabit");
  });

  it("uydurma istatistik/yorum içermez", () => {
    const { container } = render(<WhyUsPage />);
    expect(container.textContent).not.toMatch(/\d+\+|\/5|yıldız|memnuniyet/i);
  });

  it("sipariş ve vitrin bağlantıları doğru", () => {
    render(<WhyUsPage />);
    expect(screen.getByRole("link", { name: "Video siparişi ver" })).toHaveAttribute("href", "/agent/videos/new");
    expect(screen.getByRole("link", { name: "Vitrini gez" })).toHaveAttribute("href", "/vitrin");
  });
});
