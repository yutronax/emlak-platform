import { describe, expect, it } from "vitest";

import { formatTryMinor } from "./format-price";

describe("formatTryMinor", () => {
  it("fiyat sayfasıyla aynı biçimde gösterir", () => {
    expect(formatTryMinor(75000)).toBe("750,00 ₺");
    expect(formatTryMinor(150050)).toBe("1.500,50 ₺");
  });
});
