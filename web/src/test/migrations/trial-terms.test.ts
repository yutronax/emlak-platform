import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * EML-90 / EML-91 — p0-vitrin-guven migration'ı (0019_trial_terms).
 *
 * Bu testler SQL dosyasını statik olarak okur (DB bağlantısı yok).
 * Migration henüz yazılmadığı için testler KIRMIZI olmalı (red step).
 *
 * Kapsam: AC-3 (terms kolonları), AC-4 / AC-5 (start_trial gövdesi),
 * AC-S1 (argümansız, sabit süre/plan, SECURITY DEFINER + search_path),
 * AC-S2 (anon'a execute yok), rollback (down dosyası).
 */

const MIGRATIONS_DIR = path.resolve(__dirname, "../../../../supabase/migrations");
const UP_FILE = "0019_trial_terms.sql";
const DOWN_FILE = "0019_trial_terms.down.sql";

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

const fnPattern = /create or replace function (public\.)?start_trial\s*\(/;

describe("0019_trial_terms.sql — deneme + KVKK migration'ı", () => {
  it("dosya mevcut (up + down)", () => {
    expect(readSql(UP_FILE).length).toBeGreaterThan(0);
    expect(readSql(DOWN_FILE).length).toBeGreaterThan(0);
  });

  describe("AC-3 — KVKK onay kolonları (agents)", () => {
    it("agents tablosuna trial_started_at timestamptz eklenir", () => {
      const stmt = statementFrom(
        up,
        /alter table (public\.)?agents add column (if not exists )?trial_started_at timestamptz/
      );
      expect(stmt).not.toBe("");
    });

    it("trial_started_at kolonu NOT NULL değildir", () => {
      const stmt = statementFrom(
        up,
        /alter table (public\.)?agents add column (if not exists )?trial_started_at timestamptz/
      );
      expect(stmt).not.toBe("");
      expect(stmt).not.toMatch(/not null/);
    });

    it("agents tablosuna terms_accepted_at timestamptz eklenir", () => {
      const stmt = statementFrom(
        up,
        /alter table (public\.)?agents add column (if not exists )?terms_accepted_at timestamptz/
      );
      expect(stmt).not.toBe("");
    });

    it("terms_accepted_at kolonu NOT NULL değildir", () => {
      const stmt = statementFrom(
        up,
        /alter table (public\.)?agents add column (if not exists )?terms_accepted_at timestamptz/
      );
      expect(stmt).not.toBe("");
      expect(stmt).not.toMatch(/not null/);
    });

    it("agents tablosuna terms_version text eklenir", () => {
      const stmt = statementFrom(
        up,
        /alter table (public\.)?agents add column (if not exists )?terms_version text/
      );
      expect(stmt).not.toBe("");
    });

    it("terms_version kolonu NOT NULL değildir", () => {
      const stmt = statementFrom(
        up,
        /alter table (public\.)?agents add column (if not exists )?terms_version text/
      );
      expect(stmt).not.toBe("");
      expect(stmt).not.toMatch(/not null/);
    });
  });

  describe("backfill — mevcut ajanlarda deneme hakkı kapatılır (plan kararı 2026-10-28)", () => {
    it("update agents set trial_started_at = created_at where trial_started_at is null", () => {
      const stmt = statementFrom(up, /update (public\.)?agents set trial_started_at\s*=/);
      expect(stmt).not.toBe("");
      expect(stmt).toMatch(/set trial_started_at\s*=\s*created_at/);
      expect(stmt).toMatch(/where trial_started_at is null/);
    });

    it("backfill abonelik oluşturmaz (subscriptions'a insert yok)", () => {
      const stmt = statementFrom(up, /update (public\.)?agents set trial_started_at\s*=/);
      expect(stmt).not.toMatch(/insert into/);
      expect(stmt).not.toMatch(/subscriptions/);
    });
  });

  describe("AC-4 / AC-5 — start_trial() RPC tanımı", () => {
    it("start_trial() fonksiyonu tanımlanır", () => {
      expect(up).toMatch(fnPattern);
    });

    it("argüman almaz (AC-S1: days/agent_id istemciden alınmaz)", () => {
      expect(up).toMatch(/create or replace function (public\.)?start_trial\s*\(\s*\)/);
    });

    it("returns boolean (AC-5: zaten varsa false)", () => {
      const block = functionBlock(up, fnPattern);
      expect(block).not.toBe("");
      expect(block).toMatch(/returns boolean/);
    });

    it("security definer olarak tanımlanır", () => {
      const block = functionBlock(up, fnPattern);
      expect(block).not.toBe("");
      expect(block).toMatch(/security definer/);
    });

    it("set search_path = public taşır (SECURITY DEFINER güvenliği)", () => {
      const block = functionBlock(up, fnPattern);
      expect(block).not.toBe("");
      expect(block).toMatch(/set search_path\s*=\s*public(\s|;|$)/);
    });

    it("hedef satır auth.uid() ile belirlenir", () => {
      const block = functionBlock(up, fnPattern);
      expect(block).not.toBe("");
      expect(block).toMatch(/auth\.uid\(\)/);
    });

    it("yalnız trial_started_at is null olan ajan için çalışır (tek seferlik, AC-5)", () => {
      const block = functionBlock(up, fnPattern);
      expect(block).not.toBe("");
      expect(block).toMatch(/trial_started_at is null/);
    });

    it("kullanıcının herhangi bir subscriptions satırı varsa işlem yapmaz (not exists)", () => {
      const block = functionBlock(up, fnPattern);
      expect(block).not.toBe("");
      expect(block).toMatch(/not exists\s*\(\s*select 1 from (public\.)?subscriptions\b/);
    });

    it("deneme süresi interval '14 days' ile sabittir (AC-S1)", () => {
      const block = functionBlock(up, fnPattern);
      expect(block).not.toBe("");
      expect(block).toMatch(/interval '14 days'/);
    });

    it("abonelik status değeri 'trialing' olarak yazılır", () => {
      const block = functionBlock(up, fnPattern);
      expect(block).not.toBe("");
      expect(block).toMatch(/'trialing'/);
    });

    it("plan en ucuz aktif plandan seçilir (order by price_minor_unit)", () => {
      const block = functionBlock(up, fnPattern);
      expect(block).not.toBe("");
      expect(block).toMatch(/order by price_minor_unit/);
    });

    it("subscriptions'a insert eder", () => {
      const block = functionBlock(up, fnPattern);
      expect(block).not.toBe("");
      expect(block).toMatch(/insert into (public\.)?subscriptions\b/);
    });
  });

  describe("AC-S2 — yetki (grant / revoke)", () => {
    it("revoke all on function start_trial() from public", () => {
      expect(up).toMatch(/revoke all on function (public\.)?start_trial\s*\(\s*\) from public/);
    });

    it("revoke execute on function start_trial() from anon", () => {
      expect(up).toMatch(/revoke execute on function (public\.)?start_trial\s*\(\s*\) from anon/);
    });

    it("grant execute on function start_trial() to authenticated", () => {
      expect(up).toMatch(/grant execute on function (public\.)?start_trial\s*\(\s*\) to authenticated/);
    });

    it("anon'a execute grant'i verilmez", () => {
      expect(up).not.toMatch(/grant execute on function (public\.)?start_trial\s*\(\s*\) to anon/);
    });
  });

  describe("rollback — down dosyası", () => {
    it("down dosyası start_trial() fonksiyonunu drop eder", () => {
      expect(down).toMatch(/drop function (if exists )?(public\.)?start_trial\s*\(\s*\)/);
    });

    it("down dosyası trial_started_at kolonunu drop eder", () => {
      expect(down).toMatch(/alter table (public\.)?agents drop column (if exists )?trial_started_at/);
    });

    it("down dosyası terms_accepted_at kolonunu drop eder", () => {
      expect(down).toMatch(/alter table (public\.)?agents drop column (if exists )?terms_accepted_at/);
    });

    it("down dosyası terms_version kolonunu drop eder", () => {
      expect(down).toMatch(/alter table (public\.)?agents drop column (if exists )?terms_version/);
    });
  });
});
