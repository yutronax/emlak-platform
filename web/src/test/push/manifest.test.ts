import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * EML-101 / AC-5 — PWA manifest ve layout metadata bağlantısı.
 */
const PUBLIC_DIR = path.resolve(__dirname, "../../../public");
const MANIFEST_PATH = path.join(PUBLIC_DIR, "manifest.webmanifest");
const LAYOUT_PATH = path.resolve(__dirname, "../../app/layout.tsx");

type WebManifest = {
  display?: string;
  start_url?: string;
  icons?: { src: string; sizes?: string; type?: string }[];
};

describe("public/manifest.webmanifest (AC-5)", () => {
  const manifest = JSON.parse(
    readFileSync(MANIFEST_PATH, "utf8"),
  ) as WebManifest;

  it("display: standalone", () => {
    expect(manifest.display).toBe("standalone");
  });

  it("start_url tanımlı", () => {
    expect(typeof manifest.start_url).toBe("string");
    expect(manifest.start_url!.length).toBeGreaterThan(0);
  });

  it("en az bir ikon var", () => {
    expect(Array.isArray(manifest.icons)).toBe(true);
    expect(manifest.icons!.length).toBeGreaterThanOrEqual(1);
  });

  it("her ikon dosyası public/ altında mevcut", () => {
    for (const icon of manifest.icons ?? []) {
      expect(existsSync(path.join(PUBLIC_DIR, icon.src))).toBe(true);
    }
  });
});

describe("src/app/layout.tsx — manifest metadata bağlantısı (AC-5)", () => {
  it("metadata manifest alanı /manifest.webmanifest'e işaret eder", () => {
    const src = readFileSync(LAYOUT_PATH, "utf8");
    expect(src).toMatch(
      /manifest\s*:\s*["'`]\/manifest\.webmanifest["'`]/,
    );
  });
});
