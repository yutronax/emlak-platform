import { describe, expect, it } from "vitest";

import { buildPayload } from "./payload";

// AC-2 (metin) + AC-S4 (yalnız {title, body, url}; ilan verisi yok).
describe("buildPayload", () => {
  it.each([
    { n: 1, body: "1 yeni ilan geldi" },
    { n: 42, body: "42 yeni ilan geldi" },
    { n: 99, body: "99 yeni ilan geldi" }, // sınır: 99 olduğu gibi
    { n: 100, body: "99+ yeni ilan geldi" },
    { n: 150, body: "99+ yeni ilan geldi" },
  ])("n=$n → body '$body'", ({ n, body }) => {
    expect(buildPayload(n).body).toBe(body);
  });

  it("başlık 'Yeni ilanlar'", () => {
    expect(buildPayload(3).title).toBe("Yeni ilanlar");
  });

  it("url '/agent/dashboard'", () => {
    expect(buildPayload(1).url).toBe("/agent/dashboard");
  });

  it("anahtar kümesi tam olarak {title, body, url} (AC-S4)", () => {
    expect(Object.keys(buildPayload(7)).sort()).toEqual(["body", "title", "url"]);
  });

  it("payload ilan alanı (başlık, fiyat, konum, grup) taşımaz", () => {
    const serialized = JSON.stringify(buildPayload(150));
    for (const forbidden of ["price", "fiyat", "location", "konum", "group", "grup", "listing"]) {
      expect(serialized.toLowerCase()).not.toContain(forbidden);
    }
  });
});
