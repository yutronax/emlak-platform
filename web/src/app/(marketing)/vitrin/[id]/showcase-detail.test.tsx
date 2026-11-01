// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { SHOWCASE_FIXTURE } from "@/lib/showcase-ui/mock-service";

import { ShowcaseDetail } from "./showcase-detail";

const item = SHOWCASE_FIXTURE[0];

afterEach(() => {
  cleanup();
});

describe("ShowcaseDetail", () => {
  it("başlık, fiyat, konum ve olgular", () => {
    render(<ShowcaseDetail item={item} similar={[]} pageUrl="https://site.test/vitrin/a1" />);

    expect(screen.getByRole("heading", { level: 1, name: item.title })).toBeInTheDocument();
    expect(screen.getByText("8.450.000 ₺")).toBeInTheDocument();
    expect(screen.getByText("Karşıyaka, İzmir")).toBeInTheDocument();
    const facts = screen.getByRole("list", { name: "İlan bilgileri" });
    expect(facts).toHaveTextContent("Oda3+1");
    expect(facts).toHaveTextContent("Alan135 m²");
    expect(facts).toHaveTextContent("Isıtma");
  });

  it("boş olgular gösterilmez", () => {
    render(<ShowcaseDetail item={SHOWCASE_FIXTURE[5]} similar={[]} pageUrl="https://site.test/vitrin/a6" />);

    const facts = screen.getByRole("list", { name: "İlan bilgileri" });
    expect(facts).not.toHaveTextContent("Kat");
    expect(facts).not.toHaveTextContent("Bina yaşı");
  });

  it("iletişim: WhatsApp yeni sekmede, önceden dolu mesaj; arama bağlantısı", () => {
    render(<ShowcaseDetail item={item} similar={[]} pageUrl="https://site.test/vitrin/a1" />);

    const contact = screen.getByRole("complementary", { name: "Emlakçıyla iletişim" });
    expect(contact).toHaveTextContent("Karşıyaka Sahil Gayrimenkul");
    const wa = within(contact).getByRole("link", { name: /WhatsApp'tan yaz/ });
    expect(wa).toHaveAttribute("target", "_blank");
    expect(wa.getAttribute("href")).toContain("https://wa.me/905321234567?text=");
    expect(decodeURIComponent(wa.getAttribute("href")!)).toContain("https://site.test/vitrin/a1");
    expect(within(contact).getByRole("link", { name: "Ara" })).toHaveAttribute("href", "tel:+905321234567");
  });

  it("video yoksa 'Video hazırlanıyor'; varsa kontrollü video", () => {
    const { rerender, container } = render(<ShowcaseDetail item={item} similar={[]} pageUrl="u" />);
    expect(screen.getByText("Video hazırlanıyor")).toBeInTheDocument();
    expect(container.querySelector("video")).toBeNull();

    rerender(<ShowcaseDetail item={{ ...item, videoUrl: "https://cdn.test/v.mp4" }} similar={[]} pageUrl="u" />);
    const video = container.querySelector("video")!;
    expect(video).toHaveAttribute("src", "https://cdn.test/v.mp4");
    expect(video).toHaveAttribute("controls");
  });

  it("benzer ilanlar listelenir; yoksa bölüm gösterilmez", () => {
    const { rerender } = render(
      <ShowcaseDetail item={item} similar={SHOWCASE_FIXTURE.slice(1, 3)} pageUrl="u" />,
    );
    const similar = screen.getByRole("region", { name: "Benzer ilanlar" });
    expect(within(similar).getAllByRole("article")).toHaveLength(2);

    rerender(<ShowcaseDetail item={item} similar={[]} pageUrl="u" />);
    expect(screen.queryByRole("region", { name: "Benzer ilanlar" })).toBeNull();
  });
});
