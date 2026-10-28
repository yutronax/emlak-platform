import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * EML-85 / EML-86 — faz2-ilan-akisi-bildirim migration'ı (0016).
 *
 * Bu testler SQL dosyasını statik olarak okur (DB bağlantısı yok).
 * Migration henüz yazılmadığı için testler KIRMIZI olmalı (red step).
 *
 * Kapsam: AC-12, AC-13, AC-17 (RPC dönüş tipi), AC-18, AC-S1, AC-S2.
 */

const MIGRATIONS_DIR = path.resolve(__dirname, "../../../../supabase/migrations");
const UP_FILE = "0016_listings_feed_notifications.sql";
const DOWN_FILE = "0016_listings_feed_notifications.down.sql";

function readSql(name: string): string {
  const full = path.join(MIGRATIONS_DIR, name);
  if (!fs.existsSync(full)) return "";
  return fs.readFileSync(full, "utf8");
}

/** SQL yorumlarını (-- ... ve /* ... *\/) kaldırır ve whitespace'i normalize eder. */
function normalize(sql: string): string {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/--[^\n]*/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/** Verilen regex'in eşleştiği ifadeden başlayıp ilk ';' (dahil) değerine kadar olan statement. */
function statementFrom(normalized: string, pattern: RegExp): string {
  const m = normalized.match(pattern);
  if (!m || m.index === undefined) return "";
  const rest = normalized.slice(m.index);
  const semi = rest.indexOf(";");
  return semi < 0 ? rest : rest.slice(0, semi + 1);
}

/** Bir `create function` bloğunu (bir sonraki create/ddl ifadesine kadar) döndürür. */
function functionBlock(normalized: string, pattern: RegExp): string {
  const m = normalized.match(pattern);
  if (!m || m.index === undefined) return "";
  const rest = normalized.slice(m.index);
  const next = rest
    .slice(1)
    .search(/create (or replace )?(function|index|table|policy|trigger|unique index)\b/);
  return next < 0 ? rest : rest.slice(0, next + 1);
}

const up = normalize(readSql(UP_FILE));
const down = normalize(readSql(DOWN_FILE));

describe("0016_listings_feed_notifications.sql — ilan akışı migration'ı", () => {
  it("dosya mevcut (up + down)", () => {
    expect(readSql(UP_FILE).length).toBeGreaterThan(0);
    expect(readSql(DOWN_FILE).length).toBeGreaterThan(0);
  });

  describe("AC-12 — kaynak grup", () => {
    it("listings tablosuna source_group_name text eklenir", () => {
      const stmt = statementFrom(
        up,
        /alter table (public\.)?listings add column (if not exists )?source_group_name text/
      );
      expect(stmt).not.toBe("");
    });

    it("source_group_name kolonu NOT NULL değildir", () => {
      const stmt = statementFrom(
        up,
        /alter table (public\.)?listings add column (if not exists )?source_group_name text/
      );
      expect(stmt).not.toBe("");
      expect(stmt).not.toMatch(/not null/);
    });

    it("mevcut satırlar raw_listing_id üzerinden backfill edilir (update listings ... from raw_listings)", () => {
      const stmt = statementFrom(up, /update (public\.)?listings\b/);
      expect(stmt).not.toBe("");
      expect(stmt).toMatch(/set source_group_name\s*=/);
      expect(stmt).toMatch(/from (public\.)?raw_listings\b/);
      expect(stmt).toMatch(/raw_listing_id\s*=\s*\w+\.id/);
    });

    it("backfill idempotent: yalnızca source_group_name is null satırları günceller", () => {
      const stmt = statementFrom(up, /update (public\.)?listings\b/);
      expect(stmt).toMatch(/source_group_name is null/);
    });

    it("approve_raw_listing yeniden tanımlanır", () => {
      expect(up).toMatch(/create or replace function (public\.)?approve_raw_listing\s*\(/);
    });

    it("approve_raw_listing insert kolon listesi source_group_name içerir", () => {
      const block = functionBlock(
        up,
        /create or replace function (public\.)?approve_raw_listing\s*\(/
      );
      expect(block).not.toBe("");
      const insert = block.match(/insert into (public\.)?listings\s*\(([^)]*)\)/);
      expect(insert).not.toBeNull();
      expect(insert?.[2] ?? "").toMatch(/\bsource_group_name\b/);
    });

    it("approve_raw_listing security invoker kalır (security definer değil)", () => {
      const block = functionBlock(
        up,
        /create or replace function (public\.)?approve_raw_listing\s*\(/
      );
      expect(block).not.toBe("");
      expect(block).toMatch(/security invoker/);
      expect(block).not.toMatch(/security definer/);
    });
  });

  describe("AC-13 — bildirim sayacı kolonu", () => {
    it("agents tablosuna listings_seen_at timestamptz eklenir", () => {
      const stmt = statementFrom(
        up,
        /alter table (public\.)?agents add column (if not exists )?listings_seen_at timestamptz/
      );
      expect(stmt).not.toBe("");
    });

    it("listings_seen_at kolonu NOT NULL değildir", () => {
      const stmt = statementFrom(
        up,
        /alter table (public\.)?agents add column (if not exists )?listings_seen_at timestamptz/
      );
      expect(stmt).not.toBe("");
      expect(stmt).not.toMatch(/not null/);
    });
  });

  describe("AC-17 / AC-S2 — mark_listings_seen() RPC", () => {
    const fnPattern = /create or replace function (public\.)?mark_listings_seen\s*\(/;

    it("mark_listings_seen() fonksiyonu tanımlanır", () => {
      expect(up).toMatch(fnPattern);
    });

    it("argüman almaz (S1: hedef id istemciden alınmaz)", () => {
      expect(up).toMatch(/create or replace function (public\.)?mark_listings_seen\s*\(\s*\)/);
    });

    it("returns integer (etkilenen satır sayısı, AC-17)", () => {
      const block = functionBlock(up, fnPattern);
      expect(block).not.toBe("");
      expect(block).toMatch(/returns integer/);
    });

    it("security invoker olarak tanımlanır", () => {
      const block = functionBlock(up, fnPattern);
      expect(block).not.toBe("");
      expect(block).toMatch(/security invoker/);
    });

    it("security definer İÇERMEZ (S2: yeni yetki yüzeyi açılmaz)", () => {
      const block = functionBlock(up, fnPattern);
      expect(block).not.toBe("");
      expect(block).not.toMatch(/security definer/);
    });

    it("gövde yalnızca auth.uid() satırını hedefler (where id = auth.uid())", () => {
      const block = functionBlock(up, fnPattern);
      expect(block).not.toBe("");
      expect(block).toMatch(/where id = auth\.uid\(\)/);
    });

    it("gövde yalnızca listings_seen_at kolonunu set eder (tek atama, virgül yok)", () => {
      const stmt = statementFrom(up, /update (public\.)?agents set listings_seen_at\s*=/);
      expect(stmt).not.toBe("");
      expect(stmt).not.toMatch(/,/);
    });

    it("satır sayısını get diagnostics ile döner", () => {
      const block = functionBlock(up, fnPattern);
      expect(block).toMatch(/get diagnostics/);
    });
  });

  describe("AC-18 — indeksler", () => {
    it("listings(created_at) indeksi oluşturulur", () => {
      expect(up).toMatch(
        /create index (if not exists )?\w+ on (public\.)?listings\s*\(\s*created_at(\s+desc)?\s*\)/
      );
    });

    it("listings(source_group_name) indeksi oluşturulur", () => {
      expect(up).toMatch(
        /create index (if not exists )?\w+ on (public\.)?listings\s*\(\s*source_group_name\s*\)/
      );
    });
  });

  describe("rollback — down dosyası", () => {
    it("down dosyası source_group_name kolonunu drop eder", () => {
      expect(down).toMatch(/alter table (public\.)?listings drop column (if exists )?source_group_name/);
    });

    it("down dosyası listings_seen_at kolonunu drop eder", () => {
      expect(down).toMatch(/alter table (public\.)?agents drop column (if exists )?listings_seen_at/);
    });

    it("down dosyası mark_listings_seen() fonksiyonunu drop eder", () => {
      expect(down).toMatch(/drop function (if exists )?(public\.)?mark_listings_seen\s*\(\s*\)/);
    });
  });
});
