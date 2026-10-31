import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * EML-101 / AC-6, AC-S6 — public/sw.js statik kontrolleri.
 * Service worker yalnız push ve notificationclick işler; fetch yakalamaz;
 * tıklamada yalnız aynı origin'deki yolu açar, aksi halde /agent/dashboard.
 */
const SW_PATH = path.resolve(__dirname, "../../../public/sw.js");

describe("public/sw.js — push ve notificationclick (AC-S6)", () => {
  const src = readFileSync(SW_PATH, "utf8");

  it("push event dinleyicisi var", () => {
    expect(src).toMatch(/addEventListener\(\s*["']push["']/);
  });

  it("notificationclick event dinleyicisi var", () => {
    expect(src).toMatch(/addEventListener\(\s*["']notificationclick["']/);
  });

  it("fetch event dinleyicisi YOK (cache/proxy yok)", () => {
    expect(src).not.toMatch(/addEventListener\(\s*["']fetch["']/);
    expect(src).not.toMatch(/\bonfetch\s*=/);
  });

  it("tıklama mantığında origin kontrolü var (self.location.origin veya new URL + .origin)", () => {
    const hasSelfOrigin = /self\.location\.origin/.test(src);
    const hasUrlOriginCheck = /new URL\(/.test(src) && /\.origin\b/.test(src);
    expect(hasSelfOrigin || hasUrlOriginCheck).toBe(true);
  });

  it("varsayılan hedef /agent/dashboard", () => {
    expect(src).toContain("/agent/dashboard");
  });
});
