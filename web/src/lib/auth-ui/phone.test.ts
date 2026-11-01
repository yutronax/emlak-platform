import { describe, expect, it } from "vitest";

import { formatTrPhone, normalizeTrPhone } from "./phone";

describe("normalizeTrPhone", () => {
  it.each([
    ["0532 123 45 67", "+905321234567"],
    ["532 123 45 67", "+905321234567"],
    ["+90 532 123 45 67", "+905321234567"],
    ["905321234567", "+905321234567"],
    ["(0532) 123-45-67", "+905321234567"],
  ])("%s → %s", (input, expected) => {
    expect(normalizeTrPhone(input)).toBe(expected);
  });

  it.each(["", "123", "0212 123 45 67", "0532 123 45 6", "0532 123 45 678"])(
    "geçersiz: %s",
    (input) => {
      expect(normalizeTrPhone(input)).toBeNull();
    },
  );
});

describe("formatTrPhone", () => {
  it("yazarken kademeli biçimlendirir", () => {
    expect(formatTrPhone("5")).toBe("5");
    expect(formatTrPhone("5321")).toBe("532 1");
    expect(formatTrPhone("05321234567")).toBe("532 123 45 67");
    expect(formatTrPhone("+905321234567")).toBe("532 123 45 67");
  });

  it("10 haneden fazlasını keser", () => {
    expect(formatTrPhone("53212345679999")).toBe("532 123 45 67");
  });
});
