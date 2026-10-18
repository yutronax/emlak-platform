import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * EML-19 — /pricing sayfası plans.sort_order kolonunu select+order ediyor
 * ama bu kolonu ekleyen bir migration henüz yok (PostgREST 42703).
 *
 * Bu test, `supabase/migrations/` altında `plans` tablosuna `sort_order`
 * kolonu ekleyen bir SQL migration dosyasının VAR OLDUĞUNU dosya sistemi
 * üzerinden doğrular. Migration henüz yazılmadığı için bu test şu an
 * KIRMIZI (fail) olması beklenir (red step) — code-copilot migration'ı
 * ekledikten sonra yeşile dönmeli.
 */

const MIGRATIONS_DIR = path.resolve(__dirname, "../../../../supabase/migrations");

function readMigrationFiles(): { name: string; content: string }[] {
  if (!fs.existsSync(MIGRATIONS_DIR)) return [];
  return fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((name) => name.endsWith(".sql"))
    .map((name) => ({
      name,
      content: fs.readFileSync(path.join(MIGRATIONS_DIR, name), "utf8"),
    }));
}

describe("plans.sort_order migration dosyası", () => {
  it("AC-2 — plans tablosuna sort_order kolonu ekleyen bir migration dosyası vardır", () => {
    const files = readMigrationFiles();

    const match = files.find(({ content }) => {
      const normalized = content.toLowerCase();
      return (
        normalized.includes("alter table") &&
        normalized.includes("plans") &&
        normalized.includes("add column") &&
        normalized.includes("sort_order")
      );
    });

    expect(match).toBeDefined();
  });

  it("AC-2 — sort_order kolonu integer, not null, default 0 olarak tanımlanır", () => {
    const files = readMigrationFiles();

    const match = files.find(({ content }) => {
      const normalized = content.toLowerCase().replace(/\s+/g, " ");
      return (
        normalized.includes("sort_order") &&
        normalized.includes("integer") &&
        normalized.includes("not null") &&
        normalized.includes("default 0")
      );
    });

    expect(match).toBeDefined();
  });
});
