import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * EML-98 / EML-99 — faz2b plan limitleri migration'ı (0020_feed_daily_limit).
 *
 * Bu testler SQL dosyalarını statik olarak okur (DB bağlantısı yok).
 * Migration henüz yazılmadığı için testler KIRMIZI olmalı (red step).
 *
 * Kapsam: AC-1 (İstanbul günü, row_number), AC-4 (kilitli satır şekli),
 * AC-S1 (listings_subscriber_select kaldırılır), AC-S2 (kilitli veri sızmaz),
 * AC-S3 (argümanlarda agent_id/plan_id/limit yok), AC-S4 (anon kapalı),
 * AC-S6 (sayfa üst sınırı 500), rollback (down dosyası).
 */

const MIGRATIONS_DIR = path.resolve(__dirname, "../../../../supabase/migrations");
const UP_FILE = "0020_feed_daily_limit.sql";
const DOWN_FILE = "0020_feed_daily_limit.down.sql";

const FEED_FUNCTIONS = ["feed_listings", "feed_filter_options", "feed_unread_count"] as const;

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

/** Bir `create ... function` bloğunu (bir sonraki create ifadesine kadar) döndürür. */
function functionBlock(normalized: string, name: string): string {
  const pattern = new RegExp(`create or replace function (public\\.)?${name}\\s*\\(`);
  const m = normalized.match(pattern);
  if (!m || m.index === undefined) return "";
  const rest = normalized.slice(m.index);
  const next = rest
    .slice(1)
    .search(/create (or replace )?(function|index|table|policy|trigger|unique index)\b/);
  return next < 0 ? rest : rest.slice(0, next + 1);
}

/** Fonksiyon adından sonraki parantez içindeki argüman listesini döndürür (dengeli parantez). */
function functionArgs(normalized: string, name: string): string | null {
  const pattern = new RegExp(`create or replace function (public\\.)?${name}\\s*\\(`);
  const m = normalized.match(pattern);
  if (!m || m.index === undefined) return null;
  const openIdx = m.index + m[0].length - 1;
  let depth = 0;
  for (let i = openIdx; i < normalized.length; i++) {
    const ch = normalized[i];
    if (ch === "(") depth++;
    else if (ch === ")") {
      depth--;
      if (depth === 0) return normalized.slice(openIdx + 1, i);
    }
  }
  return normalized.slice(openIdx + 1);
}

/** Metindeki her `jsonb_build_object(...)` çağrısını dengeli parantezle ayıklar. */
function jsonbBuildObjectCalls(normalized: string): string[] {
  const calls: string[] = [];
  const token = "jsonb_build_object(";
  let idx = normalized.indexOf(token);
  while (idx >= 0) {
    const openIdx = idx + token.length - 1;
    let depth = 0;
    let end = normalized.length;
    for (let i = openIdx; i < normalized.length; i++) {
      const ch = normalized[i];
      if (ch === "(") depth++;
      else if (ch === ")") {
        depth--;
        if (depth === 0) {
          end = i;
          break;
        }
      }
    }
    calls.push(normalized.slice(idx, end + 1));
    idx = normalized.indexOf(token, end + 1);
  }
  return calls;
}

const up = normalize(readSql(UP_FILE));
const down = normalize(readSql(DOWN_FILE));

describe("0020_feed_daily_limit.sql — plan limiti migration'ı", () => {
  it("dosya mevcut (up + down)", () => {
    expect(readSql(UP_FILE).length).toBeGreaterThan(0);
    expect(readSql(DOWN_FILE).length).toBeGreaterThan(0);
  });

  describe("AC-S1 — doğrudan okuma kapatılır", () => {
    it("listings_subscriber_select policy'si drop edilir", () => {
      expect(up).toMatch(/drop policy (if exists )?listings_subscriber_select on (public\.)?listings\b/);
    });

    it("listings_admin_select policy'si drop edilmez (admin korunur)", () => {
      expect(up).not.toMatch(/drop policy (if exists )?listings_admin_select/);
    });
  });

  describe("RPC tanımları — imza ve güvenlik", () => {
    it.each(FEED_FUNCTIONS)("%s fonksiyonu tanımlanır", (name) => {
      expect(functionBlock(up, name)).not.toBe("");
    });

    it("feed_listings(p_filters jsonb, p_page int) imzasına sahiptir", () => {
      const args = functionArgs(up, "feed_listings");
      expect(args).not.toBeNull();
      expect(args).toMatch(/\bp_filters jsonb\b/);
      expect(args).toMatch(/\bp_page int(eger)?\b/);
    });

    it("feed_filter_options(p_il text) imzasına sahiptir", () => {
      const args = functionArgs(up, "feed_filter_options");
      expect(args).not.toBeNull();
      expect(args).toMatch(/\bp_il text\b/);
    });

    it("feed_unread_count(p_since timestamptz) imzasına sahiptir", () => {
      const args = functionArgs(up, "feed_unread_count");
      expect(args).not.toBeNull();
      expect(args).toMatch(/\bp_since timestamptz\b/);
    });

    it.each(FEED_FUNCTIONS)("%s security definer olarak tanımlanır", (name) => {
      expect(functionBlock(up, name)).toMatch(/security definer/);
    });

    it.each(FEED_FUNCTIONS)("%s set search_path = public taşır", (name) => {
      expect(functionBlock(up, name)).toMatch(/set search_path\s*=\s*public(\s|;|$)/);
    });

    it("AC-S3: hiçbir RPC argümanı agent_id / plan_id / limit almaz", () => {
      for (const name of FEED_FUNCTIONS) {
        const args = functionArgs(up, name);
        expect(args, name).not.toBeNull();
        expect(args, name).not.toMatch(/\bagent_id\b/);
        expect(args, name).not.toMatch(/\bplan_id\b/);
        expect(args, name).not.toMatch(/\blimit\b/);
      }
    });
  });

  describe("AC-S4 / yetki — revoke / grant", () => {
    it.each(FEED_FUNCTIONS)("%s: revoke all ... from public", (name) => {
      expect(up).toMatch(
        new RegExp(`revoke all on function (public\\.)?${name}\\s*\\([^)]*\\)\\s+from public`),
      );
    });

    it.each(FEED_FUNCTIONS)("%s: revoke execute ... from anon", (name) => {
      expect(up).toMatch(
        new RegExp(`revoke execute on function (public\\.)?${name}\\s*\\([^)]*\\)\\s+from anon`),
      );
    });

    it.each(FEED_FUNCTIONS)("%s: grant execute ... to authenticated", (name) => {
      expect(up).toMatch(
        new RegExp(`grant execute on function (public\\.)?${name}\\s*\\([^)]*\\)\\s+to authenticated`),
      );
    });

    it.each(FEED_FUNCTIONS)("%s: anon'a execute grant'i verilmez", (name) => {
      expect(up).not.toMatch(
        new RegExp(`grant execute on function (public\\.)?${name}\\s*\\([^)]*\\)\\s+to anon`),
      );
    });

    it("feed_access yardımcısı tanımlanır", () => {
      expect(functionBlock(up, "feed_access")).not.toBe("");
    });

    it("EML-99 / AC-6: feed_access past_due aboneliği de kabul eder (active, trialing, past_due)", () => {
      expect(functionBlock(up, "feed_access")).toMatch(
        /s\.status in \('active', 'trialing', 'past_due'\)/,
      );
    });

    it("feed_access için authenticated'a grant YOK (yalnız definer fonksiyonlar çağırır)", () => {
      expect(up).not.toMatch(
        /grant execute on function (public\.)?feed_access\s*\([^)]*\)\s+to authenticated/,
      );
    });

    it("feed_access public / anon / authenticated'dan revoke edilir", () => {
      expect(up).toMatch(
        /revoke all on function (public\.)?feed_access\s*\([^)]*\)\s+from [^;]*\bpublic\b/,
      );
      expect(up).toMatch(
        /revoke all on function (public\.)?feed_access\s*\([^)]*\)\s+from [^;]*\banon\b/,
      );
      expect(up).toMatch(
        /revoke all on function (public\.)?feed_access\s*\([^)]*\)\s+from [^;]*\bauthenticated\b/,
      );
    });
  });

  describe("AC-1 — İstanbul günü ve gün başına N", () => {
    it("gün sınırı Europe/Istanbul ile hesaplanır", () => {
      expect(up).toMatch(/at time zone 'europe\/istanbul'/);
    });

    it("gün içi sıra row_number() ile üretilir", () => {
      expect(functionBlock(up, "feed_listings")).toMatch(/row_number\s*\(\s*\)/);
    });
  });

  describe("AC-S6 — sayfalama üst sınırı", () => {
    it("p_page least(..., 500) ile sınırlanır", () => {
      const block = functionBlock(up, "feed_listings");
      expect(block).toMatch(/least\([^;]*\b500\b/);
    });
  });

  describe("AC-S2 — kilitli satır yalnız izinli alanları taşır", () => {
    it("kilitli nesne 'locked', true ile kurulur", () => {
      const calls = jsonbBuildObjectCalls(up).filter((c) =>
        /'locked'\s*,\s*true/.test(c),
      );
      expect(calls.length).toBeGreaterThan(0);
    });

    it("kilitli jsonb_build_object bloğunda title/price/currency/rooms/area_m2/source_group_name yok", () => {
      const lockedCalls = jsonbBuildObjectCalls(up).filter((c) =>
        /'locked'\s*,\s*true/.test(c),
      );
      expect(lockedCalls.length).toBeGreaterThan(0);
      for (const call of lockedCalls) {
        expect(call).not.toMatch(/'title'/);
        expect(call).not.toMatch(/'price'/);
        expect(call).not.toMatch(/'currency'/);
        expect(call).not.toMatch(/'rooms'/);
        expect(call).not.toMatch(/'area_m2'/);
        expect(call).not.toMatch(/'source_group_name'/);
      }
    });

    it("kilitli nesne id, city, district, created_at anahtarlarını taşır", () => {
      const lockedCalls = jsonbBuildObjectCalls(up).filter((c) =>
        /'locked'\s*,\s*true/.test(c),
      );
      expect(lockedCalls.length).toBeGreaterThan(0);
      for (const call of lockedCalls) {
        expect(call).toMatch(/'id'/);
        expect(call).toMatch(/'city'/);
        expect(call).toMatch(/'district'/);
        expect(call).toMatch(/'created_at'/);
      }
    });
  });

  describe("rollback — down dosyası", () => {
    it("listings_subscriber_select policy'si 0001 tanımıyla geri oluşturulur", () => {
      expect(down).toMatch(/create policy listings_subscriber_select on (public\.)?listings/);
      expect(down).toMatch(/for select/);
      expect(down).toMatch(/'active', 'trialing'/);
    });

    it.each([...FEED_FUNCTIONS, "feed_access"])("down dosyası %s fonksiyonunu drop eder", (name) => {
      expect(down).toMatch(
        new RegExp(`drop function (if exists )?(public\\.)?${name}\\s*\\(`),
      );
    });
  });
});
