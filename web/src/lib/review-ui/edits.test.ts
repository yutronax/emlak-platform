import { describe, expect, it } from "vitest";

import { diffEdits, scoreBand, validateEdits } from "./edits";
import type { ParsedFields } from "./types";

const base: ParsedFields = {
  title: "Deniz manzaralı 3+1",
  price: 8_450_000,
  currency: "TRY",
  rooms: "3+1",
  areaM2: 135,
  city: "İzmir",
  district: "Karşıyaka",
  neighborhood: "",
  description: "",
};

describe("diffEdits", () => {
  it("yalnız değişen alanları döner; boşluk farkı değişiklik sayılmaz", () => {
    expect(diffEdits(base, { ...base, title: " Deniz manzaralı 3+1 " })).toEqual({});
    expect(diffEdits(base, { ...base, price: 8_000_000, neighborhood: "Bostanlı" })).toEqual({
      price: 8_000_000,
      neighborhood: "Bostanlı",
    });
  });
});

describe("validateEdits", () => {
  it("geçerli", () => {
    expect(validateEdits(base)).toEqual({});
  });
  it("kısa başlık, sıfır/negatif fiyat ve alan", () => {
    expect(validateEdits({ ...base, title: "ab", price: 0, areaM2: -3 })).toEqual({
      title: "Başlık 3-140 karakter olmalı.",
      price: "Fiyat pozitif bir sayı olmalı ya da boş bırakılmalı.",
      areaM2: "Alan pozitif bir sayı olmalı ya da boş bırakılmalı.",
    });
  });
  it("boş fiyat ve alan kabul edilir", () => {
    expect(validateEdits({ ...base, price: null, areaM2: null })).toEqual({});
  });
});

describe("scoreBand", () => {
  it.each([
    [null, "none"],
    [0.3, "low"],
    [0.5, "mid"],
    [0.69, "mid"],
    [0.7, "high"],
  ] as const)("%s → %s", (score, band) => {
    expect(scoreBand(score)).toBe(band);
  });
});
