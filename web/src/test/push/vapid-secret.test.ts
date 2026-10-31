import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * EML-101 / AC-S5 — VAPID özel anahtarı istemciye sızmaz.
 * - src/ altındaki "use client" dosyalarında VAPID_PRIVATE_KEY geçmez.
 * - Hiçbir NEXT_PUBLIC_ önekli değişken PRIVATE taşımaz (src ve .env.example).
 */
const SRC_DIR = path.resolve(__dirname, "../..");
const ENV_EXAMPLE_PATH = path.resolve(__dirname, "../../../../.env.example");

const USE_CLIENT = /^\s*["']use client["']/m;
const SOURCE_FILE = /\.(tsx?|jsx?|mjs)$/;
const TEST_FILE = /\.test\.[tj]sx?$/;
const NEXT_PUBLIC_PRIVATE = /NEXT_PUBLIC_[A-Z0-9_]*PRIVATE/;

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

const sourceFiles = walk(SRC_DIR).filter(
  (f) => SOURCE_FILE.test(f) && !TEST_FILE.test(f),
);

describe("VAPID özel anahtarı istemcide yok (AC-S5)", () => {
  it("src/ altında 'use client' dosyaları mevcut (tarama boş kalmasın)", () => {
    const clientFiles = sourceFiles.filter((f) =>
      USE_CLIENT.test(readFileSync(f, "utf8")),
    );
    expect(clientFiles.length).toBeGreaterThan(0);
  });

  it("'use client' dosyalarında VAPID_PRIVATE_KEY geçmez", () => {
    const violators = sourceFiles
      .filter((f) => USE_CLIENT.test(readFileSync(f, "utf8")))
      .filter((f) => readFileSync(f, "utf8").includes("VAPID_PRIVATE_KEY"))
      .map((f) => path.relative(SRC_DIR, f));

    expect(violators).toEqual([]);
  });

  it("src/ altında hiçbir NEXT_PUBLIC_ önekli PRIVATE değişkeni yok", () => {
    const violators = sourceFiles
      .filter((f) => NEXT_PUBLIC_PRIVATE.test(readFileSync(f, "utf8")))
      .map((f) => path.relative(SRC_DIR, f));

    expect(violators).toEqual([]);
  });

  it(".env.example'da NEXT_PUBLIC_VAPID_PRIVATE geçmez", () => {
    const src = readFileSync(ENV_EXAMPLE_PATH, "utf8");
    expect(src).not.toMatch(/NEXT_PUBLIC_VAPID_PRIVATE/);
    expect(src).not.toMatch(NEXT_PUBLIC_PRIVATE);
  });
});
