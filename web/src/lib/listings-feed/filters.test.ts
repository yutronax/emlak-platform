import { describe, expect, it } from "vitest";

import { parseFeedFilters } from "./filters";

// Varsayılan allowlist: distinct değerlerden gelir (AC-9). Testler bu listeyi kullanır.
const OPTIONS = {
  cities: ["İstanbul", "İzmir"],
  districts: ["Kadıköy", "Beşiktaş", "Çeşme"],
  groups: ["Grup A", "Grup B"],
};

describe("parseFeedFilters — sayısal parametreler (AC-6)", () => {
  it("geçerli sayıyı parse eder ve hadInvalid=false döner", () => {
    const { filters, hadInvalid } = parseFeedFilters(
      { fiyat_min: "1000", fiyat_max: "5000" },
      OPTIONS,
    );

    expect(filters.fiyatMin).toBe(1000);
    expect(filters.fiyatMax).toBe(5000);
    expect(hadInvalid).toBe(false);
  });

  it("sınır değerleri 0 ve 1e12 geçerlidir", () => {
    const { filters, hadInvalid } = parseFeedFilters(
      { fiyat_min: "0", fiyat_max: "1000000000000" },
      OPTIONS,
    );

    expect(filters.fiyatMin).toBe(0);
    expect(filters.fiyatMax).toBe(1000000000000);
    expect(hadInvalid).toBe(false);
  });

  it.each([
    ["boş string", ""],
    ["negatif", "-5"],
    ["1e12 üstü", "1000000000001"],
    ["inf", "inf"],
    ["-inf", "-inf"],
    ["nan", "nan"],
    ["sayı olmayan metin", "abc"],
  ])(
    "geçersiz fiyat (%s) yok sayılır ve hadInvalid=true olur",
    (_label, raw) => {
      const { filters, hadInvalid } = parseFeedFilters(
        { fiyat_min: raw },
        OPTIONS,
      );

      expect(filters.fiyatMin ?? null).toBeNull();
      expect(hadInvalid).toBe(true);
    },
  );

  it("min > max ise değerler yer değiştirir ve not üretilmez (hadInvalid=false)", () => {
    const { filters, hadInvalid } = parseFeedFilters(
      { fiyat_min: "5000", fiyat_max: "1000" },
      OPTIONS,
    );

    expect(filters.fiyatMin).toBe(1000);
    expect(filters.fiyatMax).toBe(5000);
    expect(hadInvalid).toBe(false);
  });

  it("hiçbir filtre yoksa tüm filtreler boş, hadInvalid=false, sayfa=1", () => {
    const { filters, hadInvalid } = parseFeedFilters({}, OPTIONS);

    expect(filters.fiyatMin ?? null).toBeNull();
    expect(filters.fiyatMax ?? null).toBeNull();
    expect(filters.oda ?? null).toBeNull();
    expect(filters.il ?? null).toBeNull();
    expect(filters.ilce ?? null).toBeNull();
    expect(filters.grup ?? null).toBeNull();
    expect(filters.sayfa).toBe(1);
    expect(hadInvalid).toBe(false);
  });
});

describe("parseFeedFilters — oda allowlist (AC-8)", () => {
  it.each(["1+0", "1+1", "2+1", "3+1", "4+1", "5+"])(
    "izinli oda '%s' kabul edilir",
    (oda) => {
      const { filters, hadInvalid } = parseFeedFilters({ oda }, OPTIONS);

      expect(filters.oda).toBe(oda);
      expect(hadInvalid).toBe(false);
    },
  );

  it.each(["6+", "2+0", "9+1", "1+1);drop"])(
    "allowlist dışı oda '%s' yok sayılır ve hadInvalid=true olur",
    (oda) => {
      const { filters, hadInvalid } = parseFeedFilters({ oda }, OPTIONS);

      expect(filters.oda ?? null).toBeNull();
      expect(hadInvalid).toBe(true);
    },
  );
});

describe("parseFeedFilters — il/ilçe/grup allowlist (AC-6, AC-9)", () => {
  it("allowlist'teki il/ilçe/grup kabul edilir", () => {
    const { filters, hadInvalid } = parseFeedFilters(
      { il: "İstanbul", ilce: "Kadıköy", grup: "Grup A" },
      OPTIONS,
    );

    expect(filters.il).toBe("İstanbul");
    expect(filters.ilce).toBe("Kadıköy");
    expect(filters.grup).toBe("Grup A");
    expect(hadInvalid).toBe(false);
  });

  it("allowlist dışı il yok sayılır, hadInvalid=true", () => {
    const { filters, hadInvalid } = parseFeedFilters(
      { il: "Ankara" },
      OPTIONS,
    );

    expect(filters.il ?? null).toBeNull();
    expect(hadInvalid).toBe(true);
  });

  it("allowlist dışı ilçe yok sayılır, hadInvalid=true", () => {
    const { filters, hadInvalid } = parseFeedFilters(
      { ilce: "Çankaya" },
      OPTIONS,
    );

    expect(filters.ilce ?? null).toBeNull();
    expect(hadInvalid).toBe(true);
  });

  it("allowlist dışı grup yok sayılır, hadInvalid=true", () => {
    const { filters, hadInvalid } = parseFeedFilters(
      { grup: "Grup Z" },
      OPTIONS,
    );

    expect(filters.grup ?? null).toBeNull();
    expect(hadInvalid).toBe(true);
  });

  it("100 karakterden uzun grup adı, allowlist'te olsa bile yok sayılır", () => {
    const longName = "a".repeat(101);
    const { filters, hadInvalid } = parseFeedFilters(
      { grup: longName },
      { ...OPTIONS, groups: [...OPTIONS.groups, longName] },
    );

    expect(filters.grup ?? null).toBeNull();
    expect(hadInvalid).toBe(true);
  });
});

describe("parseFeedFilters — sayfa (AC-S5)", () => {
  it.each([
    ["geçerli sayfa", "3", 3],
    ["sayfa 1", "1", 1],
    ["sayfa 1000 (üst sınır)", "1000", 1000],
    ["üst sınırı aşan değer 1000'e kırpılır", "999999999", 1000],
    ["negatif değer 1'e kırpılır", "-4", 1],
    ["sıfır 1'e kırpılır", "0", 1],
    ["sayı olmayan değer varsayılan 1", "abc", 1],
  ])("%s", (_label, raw, expected) => {
    const { filters } = parseFeedFilters({ sayfa: raw }, OPTIONS);

    expect(filters.sayfa).toBe(expected);
  });

  it("sayfa verilmezse varsayılan 1 olur", () => {
    const { filters } = parseFeedFilters({}, OPTIONS);

    expect(filters.sayfa).toBe(1);
  });
});

describe("parseFeedFilters — enjeksiyon girdileri (AC-S4)", () => {
  it.each([
    ["il", { il: "x,city.eq.y)" }],
    ["grup", { grup: "*" }],
    ["oda", { oda: "1+1);drop" }],
  ])(
    "%s alanındaki PostgREST/SQL enjeksiyonu filtreye girmez",
    (_field, params) => {
      const { filters, hadInvalid } = parseFeedFilters(params, OPTIONS);
      const serialized = JSON.stringify(filters);

      expect(serialized).not.toContain("city.eq");
      expect(serialized).not.toContain("drop");
      expect(serialized).not.toContain("*");
      expect(hadInvalid).toBe(true);
    },
  );

  it("birden çok geçerli + geçersiz param: geçerliler uygulanır, geçersizler düşer", () => {
    const { filters, hadInvalid } = parseFeedFilters(
      {
        il: "İstanbul",
        grup: "*",
        oda: "3+1",
        fiyat_min: "-1",
      },
      OPTIONS,
    );

    expect(filters.il).toBe("İstanbul");
    expect(filters.oda).toBe("3+1");
    expect(filters.grup ?? null).toBeNull();
    expect(filters.fiyatMin ?? null).toBeNull();
    expect(hadInvalid).toBe(true);
  });
});
