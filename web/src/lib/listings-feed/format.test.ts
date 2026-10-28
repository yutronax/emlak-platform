import { describe, expect, it } from "vitest";

import {
  formatArrival,
  formatBadge,
  formatGroup,
  formatLocation,
  formatPrice,
} from "./format";

describe("formatPrice (AC-10)", () => {
  it("price null ise 'Fiyat belirtilmemiş' döner", () => {
    expect(formatPrice(null, "TRY")).toBe("Fiyat belirtilmemiş");
  });

  it("price dolu ise tr-TR binlik ayraçlı tutar ve para birimi döner", () => {
    expect(formatPrice(2500000, "TRY")).toBe("2.500.000 TRY");
  });

  it("çıktıda 'null' veya 'NaN' geçmez (null price)", () => {
    const out = formatPrice(null, null);
    expect(out).not.toMatch(/null|NaN/);
  });
});

describe("formatLocation (AC-10)", () => {
  it("city ve district ikisi de null ise 'Konum belirtilmemiş' döner", () => {
    expect(formatLocation(null, null)).toBe("Konum belirtilmemiş");
  });

  it("sadece il doluysa yalnız il gösterilir", () => {
    expect(formatLocation("İstanbul", null)).toBe("İstanbul");
  });

  it("sadece ilçe doluysa yalnız ilçe gösterilir", () => {
    expect(formatLocation(null, "Kadıköy")).toBe("Kadıköy");
  });

  it("ikisi de doluysa 'il / ilçe' biçiminde gösterilir", () => {
    expect(formatLocation("İstanbul", "Kadıköy")).toBe("İstanbul / Kadıköy");
  });
});

describe("formatGroup (AC-10)", () => {
  it("source_group_name null ise 'Bilinmeyen grup' döner", () => {
    expect(formatGroup(null)).toBe("Bilinmeyen grup");
  });

  it("grup adı doluysa aynen döner", () => {
    expect(formatGroup("Grup A")).toBe("Grup A");
  });
});

describe("formatArrival (AC-11)", () => {
  // Sabit "şimdi": 2026-10-28 12:00 UTC = 15:00 Europe/Istanbul.
  const NOW = new Date("2026-10-28T12:00:00.000Z");

  it("24 saatten yeni ilan göreli gösterilir: 12 dk önce", () => {
    const createdAt = new Date("2026-10-28T11:48:00.000Z").toISOString();

    expect(formatArrival(createdAt, NOW)).toBe("12 dk önce");
  });

  it("24 saatten eski ilan mutlak tarih-saat gösterilir (Europe/Istanbul, tr-TR): 27 Eki 14:05", () => {
    // 2026-10-27 11:05 UTC = 14:05 Europe/Istanbul; şimdiden 24 saatten fazla eski.
    const createdAt = new Date("2026-10-27T11:05:00.000Z").toISOString();

    expect(formatArrival(createdAt, NOW)).toBe("27 Eki 14:05");
  });

  it("tam 24 saat önce olan ilan mutlak gösterilir (eşik: <24 saat göreli)", () => {
    const createdAt = new Date("2026-10-27T12:00:00.000Z").toISOString();

    expect(formatArrival(createdAt, NOW)).toBe("27 Eki 15:00");
  });
});

describe("formatBadge (AC-13)", () => {
  it("0 için null döner (rozet gösterilmez)", () => {
    expect(formatBadge(0)).toBeNull();
  });

  it("5 için '5' döner", () => {
    expect(formatBadge(5)).toBe("5");
  });

  it("99 için '99' döner", () => {
    expect(formatBadge(99)).toBe("99");
  });

  it("100 için '99+' döner", () => {
    expect(formatBadge(100)).toBe("99+");
  });

  it("99'dan büyük herhangi bir değer '99+' döner", () => {
    expect(formatBadge(1000)).toBe("99+");
  });
});
