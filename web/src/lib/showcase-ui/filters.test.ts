import { describe, expect, it } from "vitest";

import { activeFilterCount, parseFilters, toQuery, validateFilters } from "./filters";

describe("parseFilters", () => {
  it("boş query → yalnız varsayılan sıralama", () => {
    expect(parseFilters({})).toEqual({ sort: "yeni" });
  });

  it("geçerli değerleri okur; fiyatı TL'den kuruşa çevirir", () => {
    expect(
      parseFilters({ islem: "kiralik", sehir: "İzmir", oda: "3+1", min: "10000", max: "25000", sirala: "fiyat-artan" }),
    ).toEqual({ deal: "kiralik", city: "İzmir", rooms: "3+1", minPrice: 1_000_000, maxPrice: 2_500_000, sort: "fiyat-artan" });
  });

  it("geçersiz değerleri yok sayar", () => {
    expect(parseFilters({ islem: "takas", oda: "9+9", min: "abc", max: "-5", sirala: "rastgele", sehir: ["A", "B"] })).toEqual({
      sort: "yeni",
    });
  });
});

describe("toQuery", () => {
  it("varsayılanları yazmaz, kuruşu TL'ye çevirir", () => {
    expect(toQuery({ sort: "yeni" })).toBe("");
    expect(toQuery({ deal: "satilik", rooms: "4+", maxPrice: 500_000_000, sort: "fiyat-azalan" })).toBe(
      "islem=satilik&oda=4%2B&max=5000000&sirala=fiyat-azalan",
    );
  });

  it("parseFilters ile gidiş-dönüş tutarlı", () => {
    const f = { deal: "kiralik" as const, city: "Muğla", rooms: "2+1" as const, minPrice: 1_500_000, sort: "yeni" as const };
    expect(parseFilters(Object.fromEntries(new URLSearchParams(toQuery(f))))).toEqual(f);
  });
});

describe("validateFilters / activeFilterCount", () => {
  it("min > max hatalı", () => {
    expect(validateFilters({ sort: "yeni", minPrice: 200, maxPrice: 100 })).toBe(
      "En az fiyat en çoktan büyük olamaz.",
    );
    expect(validateFilters({ sort: "yeni", minPrice: 100, maxPrice: 100 })).toBeUndefined();
  });

  it("sıralama sayılmaz", () => {
    expect(activeFilterCount({ sort: "fiyat-artan" })).toBe(0);
    expect(activeFilterCount({ sort: "yeni", deal: "satilik", city: "İzmir", minPrice: 1 })).toBe(3);
  });
});
