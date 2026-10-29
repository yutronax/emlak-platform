import { describe, expect, it } from "vitest";

import { isActivePath } from "@/lib/nav/is-active-path";

// AC-3 (High): eşleştirme kuralı. Query yok sayılır; "/" yalnız tam eşleşmede
// aktif; alt yollar ilgili linki aktif yapar; bilinmeyen yol hata vermez.
describe("isActivePath (AC-3)", () => {
  it.each([
    ["/pricing", "/pricing", true],
    ["/signup/x", "/signup", true],
    ["/signupx", "/signup", false],
    ["/", "/", true],
    ["/pricing", "/", false],
    ["/kvkk", "/pricing", false],
    ["/pricing/", "/pricing", true],
    ["", "/", false],
    ["", "/pricing", false],
    ["/signup/a/b", "/signup", true],
  ])("pathname=%s href=%s -> %s", (pathname, href, expected) => {
    expect(isActivePath(pathname, href)).toBe(expected);
  });
});
