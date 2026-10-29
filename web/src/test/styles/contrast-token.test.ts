import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const globalsCssPath = fileURLToPath(new URL("../../app/globals.css", import.meta.url));

// AC-6 (High): ikincil metin token'ı AA kontrastına (≥4.5:1 fog-50 üstünde) çekilir.
describe("globals.css — --color-slate-500 kontrast token'ı (AC-6)", () => {
  it("--color-slate-500 değeri #475569 olarak tanımlı", () => {
    const css = readFileSync(globalsCssPath, "utf8");

    expect(css).toMatch(/--color-slate-500:\s*#475569;/i);
  });
});
