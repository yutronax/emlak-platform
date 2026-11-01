import { describe, expect, it } from "vitest";

import { checkPassword } from "./password-strength";

describe("checkPassword", () => {
  it("boş şifre zayıftır ve hiçbir kural sağlanmaz", () => {
    const r = checkPassword("");
    expect(r.level).toBe("weak");
    expect(r.rules.every((rule) => !rule.ok)).toBe(true);
    expect(r.acceptable).toBe(false);
  });

  it("8 karakterden kısa şifre diğer kurallar sağlansa da zayıftır", () => {
    expect(checkPassword("Ab1!").level).toBe("weak");
  });

  it("harf + rakam + 8 karakter orta seviyedir ve kabul edilir", () => {
    const r = checkPassword("sifre123");
    expect(r.level).toBe("medium");
    expect(r.acceptable).toBe(true);
  });

  it("büyük/küçük harf karışımı güçlü yapar", () => {
    expect(checkPassword("Sifre123").level).toBe("strong");
  });

  it("sembol güçlü yapar", () => {
    expect(checkPassword("sifre12!").level).toBe("strong");
  });

  it("sadece harf (8+) zayıftır", () => {
    expect(checkPassword("abcdefgh").level).toBe("weak");
  });

  it("dört kuralı etiketleriyle döner", () => {
    expect(checkPassword("x").rules.map((r) => r.label)).toEqual([
      "En az 8 karakter",
      "Bir harf",
      "Bir rakam",
      "Büyük ve küçük harf ya da bir sembol",
    ]);
  });
});
