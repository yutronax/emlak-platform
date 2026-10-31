import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * EML-101 — Faz 2c Web Push migration'ı (0021_push_subscriptions).
 *
 * Bu testler SQL dosyalarını statik olarak okur (DB bağlantısı yok).
 * Migration henüz yazılmadığı için testler KIRMIZI olmalı (red step).
 *
 * Kapsam: tablo kolonları, endpoint unique, RLS açık, select/insert/delete
 * policy'leri agent_id = auth.uid(), update policy yok, anon'a yetki yok,
 * down dosyası tabloyu düşürür.
 */

const MIGRATIONS_DIR = path.resolve(__dirname, "../../../../supabase/migrations");
const UP_FILE = "0021_push_subscriptions.sql";
const DOWN_FILE = "0021_push_subscriptions.down.sql";
const TABLE = "push_subscriptions";

function readSql(name: string): string {
  const full = path.join(MIGRATIONS_DIR, name);
  if (!fs.existsSync(full)) return "";
  return fs.readFileSync(full, "utf8");
}

/** SQL yorumlarını kaldırır, whitespace'i normalize eder, küçük harfe çevirir. */
function normalize(sql: string): string {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/--[^\n]*/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/** Normalize edilmiş SQL'i noktalı virgüllere göre ifadelere böler. */
function statements(normalized: string): string[] {
  return normalized
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

const up = normalize(readSql(UP_FILE));
const down = normalize(readSql(DOWN_FILE));
const upStatements = statements(up);
const policyStatements = upStatements.filter((s) =>
  new RegExp(`^create policy \\S+ on (public\\.)?${TABLE}\\b`).test(s),
);

function policyFor(command: "select" | "insert" | "delete"): string | undefined {
  return policyStatements.find((s) => new RegExp(`\\bfor ${command}\\b`).test(s));
}

describe("0021_push_subscriptions.sql — Web Push abonelik tablosu", () => {
  it("dosya mevcut (up + down)", () => {
    expect(readSql(UP_FILE).length).toBeGreaterThan(0);
    expect(readSql(DOWN_FILE).length).toBeGreaterThan(0);
  });

  describe("tablo şeması", () => {
    const createTable = upStatements.find((s) =>
      new RegExp(`^create table (if not exists )?(public\\.)?${TABLE}\\b`).test(s),
    );

    it("push_subscriptions tablosu oluşturulur", () => {
      expect(createTable).toBeDefined();
    });

    it("id uuid primary key", () => {
      expect(createTable).toMatch(/\bid uuid (not null )?primary key\b/);
    });

    it("agent_id uuid not null, agents(id) referansı, on delete cascade", () => {
      expect(createTable).toMatch(
        /\bagent_id uuid not null references (public\.)?agents\s*\(id\) on delete cascade/,
      );
    });

    it("endpoint text not null unique (AC-1 tek satır)", () => {
      expect(createTable).toMatch(/\bendpoint text not null unique\b/);
    });

    it("p256dh ve auth text not null", () => {
      expect(createTable).toMatch(/\bp256dh text not null\b/);
      expect(createTable).toMatch(/\bauth text not null\b/);
    });

    it("user_agent text (nullable)", () => {
      expect(createTable).toMatch(/\buser_agent text\b/);
      expect(createTable).not.toMatch(/\buser_agent text not null\b/);
    });

    it("created_at timestamptz not null default now()", () => {
      expect(createTable).toMatch(/\bcreated_at timestamptz not null default now\(\)/);
    });

    it("last_notified_at timestamptz (nullable)", () => {
      expect(createTable).toMatch(/\blast_notified_at timestamptz\b/);
      expect(createTable).not.toMatch(/\blast_notified_at timestamptz not null\b/);
    });

    it("agent_id üzerinde index var", () => {
      expect(up).toMatch(
        new RegExp(`create index (if not exists )?\\S+ on (public\\.)?${TABLE} \\(agent_id\\)`),
      );
    });
  });

  describe("RLS — AC-S1", () => {
    it("RLS etkinleştirilir", () => {
      expect(up).toMatch(
        new RegExp(`alter table (public\\.)?${TABLE} enable row level security`),
      );
    });

    it("select policy: yalnız agent_id = auth.uid() satırları", () => {
      const p = policyFor("select");
      expect(p).toBeDefined();
      expect(p).toMatch(/\busing \(agent_id = auth\.uid\(\)\)/);
    });

    it("insert policy: with check agent_id = auth.uid() (başka agent adına ekleme yok)", () => {
      const p = policyFor("insert");
      expect(p).toBeDefined();
      expect(p).toMatch(/\bwith check \(agent_id = auth\.uid\(\)\)/);
    });

    it("delete policy: yalnız agent_id = auth.uid() satırları silinir", () => {
      const p = policyFor("delete");
      expect(p).toBeDefined();
      expect(p).toMatch(/\busing \(agent_id = auth\.uid\(\)\)/);
    });

    it("update policy YOK: hiçbir policy update/all kapsamı taşımaz", () => {
      expect(up.length).toBeGreaterThan(0); // dosya yoksa negatif kontroller boş geçmesin
      expect(policyStatements.some((s) => /\bfor update\b/.test(s))).toBe(false);
      expect(policyStatements.some((s) => /\bfor all\b/.test(s))).toBe(false);
      // Komut belirtilmeyen (varsayılan ALL) policy de olmamalı.
      for (const s of policyStatements) {
        expect(s).toMatch(/\bfor (select|insert|delete)\b/);
      }
    });

    it("yalnız select / insert / delete policy'leri var (3 adet)", () => {
      expect(policyStatements).toHaveLength(3);
    });

    it("policy'ler yalnız authenticated rolüne bağlı (anon yok)", () => {
      for (const s of policyStatements) {
        expect(s).toMatch(/\bto authenticated\b/);
        expect(s).not.toMatch(/\bto anon\b/);
        expect(s).not.toMatch(/\bto public\b/);
      }
    });

    it("policy'lerde using (true) gibi açık bırakan koşul yok", () => {
      for (const s of policyStatements) {
        expect(s).not.toMatch(/\busing \(true\)/);
        expect(s).not.toMatch(/\bwith check \(true\)/);
      }
    });
  });

  describe("yetki — AC-S1", () => {
    it("anon rolüne grant yok", () => {
      expect(up.length).toBeGreaterThan(0); // dosya yoksa negatif kontroller boş geçmesin
      expect(up).not.toMatch(
        new RegExp(`grant [^;]*\\bon (table )?(public\\.)?${TABLE}\\b[^;]*\\bto\\b[^;]*\\banon\\b`),
      );
      expect(up).not.toMatch(/grant [^;]*\bto anon\b/);
    });

    it("public rolüne grant yok", () => {
      expect(up.length).toBeGreaterThan(0); // dosya yoksa negatif kontroller boş geçmesin
      expect(up).not.toMatch(
        new RegExp(`grant [^;]*\\bon (table )?(public\\.)?${TABLE}\\b[^;]*\\bto public\\b`),
      );
    });
  });

  describe("rollback — down dosyası", () => {
    it("push_subscriptions tablosunu düşürür", () => {
      expect(down).toMatch(new RegExp(`drop table (if exists )?(public\\.)?${TABLE}\\b`));
    });
  });
});
