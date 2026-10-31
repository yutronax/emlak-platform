import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * EML-105 — Faz 3a WhatsApp bağlama migration'ı (0023_wa_connections).
 *
 * Bu testler SQL dosyalarını statik olarak okur (DB bağlantısı yok).
 * Migration henüz yazılmadığı için testler KIRMIZI olmalı (red step).
 *
 * Kapsam: agents consent kolonları, wa_connections / wa_connection_events /
 * sidecar_heartbeat şeması ve check'leri, RLS açık + authenticated için hiçbir
 * policy yok (AC-S1), RPC imzaları agent_id almaz, security definer +
 * search_path + revoke/grant yetkileri, request_wa_action iş kuralları
 * (AC-1, AC-9, AC-S4, AC-S7), get_my_wa_status QR gizliliği ve sidecar_timeout
 * (AC-S2, AC-7), down dosyası.
 */

const MIGRATIONS_DIR = path.resolve(__dirname, "../../../../supabase/migrations");
const UP_FILE = "0023_wa_connections.sql";
const DOWN_FILE = "0023_wa_connections.down.sql";

const WA_TABLES = ["wa_connections", "wa_connection_events", "sidecar_heartbeat"] as const;
const WA_FUNCTIONS = ["accept_wa_consent", "get_my_wa_status", "request_wa_action"] as const;

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

/** Normalize edilmiş SQL'i noktalı virgüllere göre ifadelere böler. */
function statements(normalized: string): string[] {
  return normalized
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
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

const up = normalize(readSql(UP_FILE));
const down = normalize(readSql(DOWN_FILE));
const upStatements = statements(up);

function tableStatement(table: string): string | undefined {
  return upStatements.find((s) =>
    new RegExp(`^create table (if not exists )?(public\\.)?${table}\\b`).test(s),
  );
}

function policiesOn(table: string): string[] {
  return upStatements.filter((s) =>
    new RegExp(`^create policy \\S+ on (public\\.)?${table}\\b`).test(s),
  );
}

describe("0023_wa_connections.sql — Faz 3a WhatsApp bağlama migration'ı", () => {
  it("dosya mevcut (up + down)", () => {
    expect(readSql(UP_FILE).length).toBeGreaterThan(0);
    expect(readSql(DOWN_FILE).length).toBeGreaterThan(0);
  });

  describe("agents — onay kanıtı (AC-1, AC-S7)", () => {
    it("wa_consent_accepted_at timestamptz eklenir", () => {
      expect(up).toMatch(
        /alter table (public\.)?agents\b[^;]*\badd column (if not exists )?wa_consent_accepted_at timestamptz/,
      );
    });

    it("wa_consent_version text eklenir", () => {
      expect(up).toMatch(
        /alter table (public\.)?agents\b[^;]*\badd column (if not exists )?wa_consent_version text/,
      );
    });
  });

  describe("wa_connections şeması", () => {
    const createTable = tableStatement("wa_connections");

    it("wa_connections tablosu oluşturulur", () => {
      expect(createTable).toBeDefined();
    });

    it("agent_id uuid primary key, agents(id) referansı, on delete cascade", () => {
      expect(createTable).toMatch(/\bagent_id uuid primary key references (public\.)?agents\s*\(id\) on delete cascade/);
    });

    it("status check: pending, qr, connected, disconnected, logged_out, error", () => {
      expect(createTable).toMatch(/\bstatus text\b[^,]*check \(status in \(/);
      for (const s of ["pending", "qr", "connected", "disconnected", "logged_out", "error"]) {
        expect(createTable).toContain(`'${s}'`);
      }
    });

    it("requested_action check: connect, disconnect (nullable)", () => {
      expect(createTable).toMatch(/\brequested_action text\b[^,]*check \(requested_action in \('connect', 'disconnect'\)\)/);
      expect(createTable).not.toMatch(/\brequested_action text not null\b/);
    });

    it("qr text, qr_expires_at timestamptz, qr_count int default 0", () => {
      expect(createTable).toMatch(/\bqr text\b/);
      expect(createTable).toMatch(/\bqr_expires_at timestamptz\b/);
      expect(createTable).toMatch(/\bqr_count int(eger)? (not null )?default 0\b/);
    });

    it("phone_masked text, error_code text, requested_at timestamptz, attempt_id uuid", () => {
      expect(createTable).toMatch(/\bphone_masked text\b/);
      expect(createTable).toMatch(/\berror_code text\b/);
      expect(createTable).toMatch(/\brequested_at timestamptz\b/);
      expect(createTable).toMatch(/\battempt_id uuid\b/);
    });

    it("last_seen_at timestamptz, updated_at timestamptz default now()", () => {
      expect(createTable).toMatch(/\blast_seen_at timestamptz\b/);
      expect(createTable).toMatch(/\bupdated_at timestamptz (not null )?default now\(\)/);
    });
  });

  describe("wa_connection_events şeması", () => {
    const createTable = tableStatement("wa_connection_events");

    it("wa_connection_events tablosu oluşturulur", () => {
      expect(createTable).toBeDefined();
    });

    it("id bigserial primary key", () => {
      expect(createTable).toMatch(/\bid bigserial primary key\b/);
    });

    it("agent_id uuid agents(id) referansı, on delete cascade", () => {
      expect(createTable).toMatch(/\bagent_id uuid (not null )?references (public\.)?agents\s*\(id\) on delete cascade/);
    });

    it("attempt_id, from_status, to_status, error_code, created_at kolonları", () => {
      expect(createTable).toMatch(/\battempt_id uuid\b/);
      expect(createTable).toMatch(/\bfrom_status text\b/);
      expect(createTable).toMatch(/\bto_status text\b/);
      expect(createTable).toMatch(/\berror_code text\b/);
      expect(createTable).toMatch(/\bcreated_at timestamptz (not null )?default now\(\)/);
    });
  });

  describe("sidecar_heartbeat şeması", () => {
    const createTable = tableStatement("sidecar_heartbeat");

    it("sidecar_heartbeat tablosu oluşturulur", () => {
      expect(createTable).toBeDefined();
    });

    it("id int primary key check (id = 1) — tek satır", () => {
      expect(createTable).toMatch(/\bid int(eger)? primary key check \(id = 1\)/);
    });

    it("last_beat_at timestamptz, sessions_open int, misconfigured boolean, counters jsonb", () => {
      expect(createTable).toMatch(/\blast_beat_at timestamptz\b/);
      expect(createTable).toMatch(/\bsessions_open int(eger)?\b/);
      expect(createTable).toMatch(/\bmisconfigured boolean\b/);
      expect(createTable).toMatch(/\bcounters jsonb\b/);
    });
  });

  describe("RLS — AC-S1 (doğrudan erişim kapalı)", () => {
    it.each(WA_TABLES)("%s için RLS etkinleştirilir", (table) => {
      expect(up).toMatch(new RegExp(`alter table (public\\.)?${table} enable row level security`));
    });

    it.each(WA_TABLES)("%s üzerinde HİÇBİR policy tanımlanmaz", (table) => {
      expect(policiesOn(table)).toHaveLength(0);
    });

    it.each(WA_TABLES)("%s için authenticated'a insert/update/delete grant'i verilmez", (table) => {
      expect(up).not.toMatch(
        new RegExp(`grant [^;]*\\b(insert|update|delete)\\b[^;]*\\bon (table )?(public\\.)?${table}\\b[^;]*\\bto authenticated\\b`),
      );
    });

    it.each(WA_TABLES)("%s için anon'a grant verilmez", (table) => {
      expect(up).not.toMatch(new RegExp(`grant [^;]*\\bon (table )?(public\\.)?${table}\\b[^;]*\\bto anon\\b`));
    });
  });

  describe("RPC tanımları — imza, agent_id yok, security definer", () => {
    it.each(WA_FUNCTIONS)("%s fonksiyonu tanımlanır", (name) => {
      expect(functionBlock(up, name)).not.toBe("");
    });

    it("accept_wa_consent(p_version text) imzasına sahiptir", () => {
      expect(functionArgs(up, "accept_wa_consent")).toMatch(/^p_version text$/);
    });

    it("request_wa_action(p_action text) imzasına sahiptir", () => {
      expect(functionArgs(up, "request_wa_action")).toMatch(/^p_action text$/);
    });

    it("get_my_wa_status() argümansız", () => {
      expect(functionArgs(up, "get_my_wa_status")).toBe("");
    });

    it("AC-S1: hiçbir RPC argümanı agent_id almaz", () => {
      for (const name of WA_FUNCTIONS) {
        expect(functionArgs(up, name), name).not.toMatch(/\bagent_id\b/);
      }
    });

    it.each(WA_FUNCTIONS)("%s security definer olarak tanımlanır", (name) => {
      expect(functionBlock(up, name)).toMatch(/security definer/);
    });

    it.each(WA_FUNCTIONS)("%s set search_path = public taşır", (name) => {
      expect(functionBlock(up, name)).toMatch(/set search_path\s*=\s*public(\s|;|$)/);
    });

    it.each(WA_FUNCTIONS)("%s auth.uid() ile kendi kaydını seçer", (name) => {
      expect(functionBlock(up, name)).toMatch(/auth\.uid\(\)/);
    });
  });

  describe("yetki — revoke / grant", () => {
    const sigs: Record<(typeof WA_FUNCTIONS)[number], string> = {
      accept_wa_consent: "accept_wa_consent\\s*\\([^)]*\\)",
      get_my_wa_status: "get_my_wa_status\\s*\\(\\s*\\)",
      request_wa_action: "request_wa_action\\s*\\([^)]*\\)",
    };

    it.each(WA_FUNCTIONS)("%s: revoke all ... from public", (name) => {
      expect(up).toMatch(new RegExp(`revoke all on function (public\\.)?${sigs[name]}\\s+from public`));
    });

    it.each(WA_FUNCTIONS)("%s: revoke execute ... from anon", (name) => {
      expect(up).toMatch(new RegExp(`revoke execute on function (public\\.)?${sigs[name]}\\s+from anon`));
    });

    it.each(WA_FUNCTIONS)("%s: grant execute ... to authenticated", (name) => {
      expect(up).toMatch(new RegExp(`grant execute on function (public\\.)?${sigs[name]}\\s+to authenticated`));
    });

    it.each(WA_FUNCTIONS)("%s: anon'a execute grant'i verilmez", (name) => {
      expect(up).not.toMatch(new RegExp(`grant execute on function (public\\.)?${sigs[name]}\\s+to anon`));
    });
  });

  describe("request_wa_action — iş kuralları", () => {
    const body = () => functionBlock(up, "request_wa_action");

    it("AC-1 / AC-S7: onaysız istek consent_required döner", () => {
      expect(body()).toContain("consent_required");
      expect(body()).toMatch(/wa_consent_accepted_at is (null|not null)/);
    });

    it("AC-9: erişimsiz istek subscription_required döner", () => {
      expect(body()).toContain("subscription_required");
    });

    it("AC-9: abonelik kontrolü active, trialing, past_due kabul eder", () => {
      expect(body()).toMatch(/'active', 'trialing', 'past_due'/);
    });

    it("AC-S4: hız sınırı 10 dakika penceresinde", () => {
      expect(body()).toContain("interval '10 minutes'");
    });

    it("AC-S4: 10 dk'da 3 sınırı ve rate_limited döner", () => {
      expect(body()).toContain("rate_limited");
      expect(body()).toMatch(/>=\s*3\b/);
    });

    it("connect: pending durumuna geçirir ve requested_action='connect' yazar", () => {
      expect(body()).toContain("'pending'");
      expect(body()).toContain("'connect'");
    });

    it("disconnect: requested_action='disconnect' yazar", () => {
      expect(body()).toContain("'disconnect'");
    });

    it("connect her istekte yeni attempt_id üretir (gen_random_uuid)", () => {
      expect(body()).toMatch(/gen_random_uuid\(\)/);
    });

    it("her geçiş wa_connection_events'e kayıt düşer", () => {
      expect(body()).toMatch(/insert into (public\.)?wa_connection_events/);
    });

    it("sidecar'a bağlı kayıt için (connected/pending/qr) tekrar connect mevcut durumu döner", () => {
      expect(body()).toMatch(/'connected'/);
      expect(body()).toMatch(/'qr'/);
    });
  });

  describe("get_my_wa_status — QR gizliliği ve zaman aşımı (AC-S2, AC-7)", () => {
    const body = () => functionBlock(up, "get_my_wa_status");

    it("qr yalnız süresi dolmamışken döner: qr_expires_at > now()", () => {
      expect(body()).toMatch(/qr_expires_at\s*>\s*now\(\)/);
    });

    it("sidecar_timeout hesaplanır", () => {
      expect(body()).toContain("sidecar_timeout");
    });

    it("satır yoksa status none döner", () => {
      expect(body()).toContain("'none'");
    });
  });

  describe("rollback — down dosyası", () => {
    it.each(WA_FUNCTIONS)("down dosyası %s fonksiyonunu drop eder", (name) => {
      expect(down).toMatch(new RegExp(`drop function (if exists )?(public\\.)?${name}\\s*\\(`));
    });

    it.each(WA_TABLES)("down dosyası %s tablosunu drop eder", (table) => {
      expect(down).toMatch(new RegExp(`drop table (if exists )?(public\\.)?${table}\\b`));
    });

    it("down dosyası agents.wa_consent_accepted_at kolonunu düşürür", () => {
      expect(down).toMatch(/alter table (public\.)?agents\b[^;]*\bdrop column (if exists )?wa_consent_accepted_at\b/);
    });

    it("down dosyası agents.wa_consent_version kolonunu düşürür", () => {
      expect(down).toMatch(/alter table (public\.)?agents\b[^;]*\bdrop column (if exists )?wa_consent_version\b/);
    });
  });
});
