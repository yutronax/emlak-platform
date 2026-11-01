import { describe, expect, it } from "vitest";

import { formatDuration, formatShowcasePrice, telHref, whatsappHref } from "./format";

describe("formatShowcasePrice", () => {
  it("satılık: kuruşsuz TL", () => {
    expect(formatShowcasePrice(450_000_000, "satilik")).toBe("4.500.000 ₺");
  });
  it("kiralık: aylık", () => {
    expect(formatShowcasePrice(2_500_000, "kiralik")).toBe("25.000 ₺ / ay");
  });
});

describe("formatDuration", () => {
  it.each([
    [5, "0:05"],
    [65, "1:05"],
    [600, "10:00"],
  ])("%i sn → %s", (s, out) => {
    expect(formatDuration(s)).toBe(out);
  });
});

describe("iletişim bağlantıları", () => {
  it("WhatsApp: + olmadan numara, mesaj encode edilir", () => {
    const href = whatsappHref("+905321234567", "Deniz manzaralı 3+1", "https://site.test/vitrin/a1");
    expect(href.startsWith("https://wa.me/905321234567?text=")).toBe(true);
    expect(decodeURIComponent(href.split("text=")[1])).toBe(
      "Merhaba, \"Deniz manzaralı 3+1\" ilanı hakkında bilgi almak istiyorum: https://site.test/vitrin/a1",
    );
  });
  it("tel: bağlantısı", () => {
    expect(telHref("+905321234567")).toBe("tel:+905321234567");
  });
});
