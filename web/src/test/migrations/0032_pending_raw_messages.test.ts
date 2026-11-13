import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * 0032_pending_raw_messages — parse'ı hatayla biten ham WhatsApp mesajlarının kısa süreli
 * bekletilmesi (scraper drain döngüsü yeniden işler).
 *
 * SQL dosyaları statik olarak okunur (DB bağlantısı yok). Kapsam: tablo şeması ve CHECK'ler,
 * 72 saatlik expires_at varsayılanı, idempotency unique index'i, drain/purge index'leri,
 * RLS açık + hiç policy yok + public/anon/authenticated revoke, delete_my_wa_data()'nın
 * 0024 davranışını aynen koruyup yalnız pending_raw_messages silmesini eklemesi
 * (security definer, search_path, imza, grant'ler), rollback dosyası (supabase/rollback/).
 */

const SUPABASE_DIR = path.resolve(__dirname, "../../../../supabase");
const UP_PATH = path.join(SUPABASE_DIR, "migrations", "0032_pending_raw_messages.sql");
const ROLLBACK_PATH = path.join(SUPABASE_DIR, "rollback", "0032_pending_raw_messages_rollback.sql");
const PREVIOUS_PATH = path.join(SUPABASE_DIR, "migrations", "0024_wa_groups_personal_listings.sql");
const TABLE = "pending_raw_messages";

function readSql(full: string): string {
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

function statements(normalized: string): string[] {
  return normalized
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/** delete_my_wa_data tanımı: `create or replace function` başından kapanış `$$;` sonuna kadar. */
function deleteFnBlock(normalized: string): string {
  const start = normalized.search(/create or replace function (public\.)?delete_my_wa_data\s*\(/);
  if (start < 0) return "";
  const rest = normalized.slice(start);
  const open = rest.indexOf("$$");
  const close = rest.indexOf("$$", open + 2);
  if (open < 0 || close < 0) return "";
  return rest.slice(0, close + 2);
}

const up = normalize(readSql(UP_PATH));
const rollback = normalize(readSql(ROLLBACK_PATH));
const previous = normalize(readSql(PREVIOUS_PATH));
const upStatements = statements(up);
const createTable = upStatements.find((s) =>
  new RegExp(`^create table (if not exists )?(public\\.)?${TABLE}\\b`).test(s),
);
const ADDED_DELETE = ` delete from pending_raw_messages where agent_id = v_uid;`;

describe("0032_pending_raw_messages.sql — bekletilen ham mesajlar", () => {
  it("migration ve rollback dosyaları mevcut", () => {
    expect(up.length).toBeGreaterThan(0);
    expect(rollback.length).toBeGreaterThan(0);
  });

  it("rollback migrations/ altında .down.sql olarak DURMAZ (ileri migration sanılmasın)", () => {
    expect(fs.existsSync(path.join(SUPABASE_DIR, "migrations", "0032_pending_raw_messages.down.sql"))).toBe(false);
  });

  describe("şema", () => {
    it("tablo oluşturulur", () => {
      expect(createTable).toBeDefined();
    });

    it("id uuid primary key default gen_random_uuid()", () => {
      expect(createTable).toMatch(/\bid uuid primary key default gen_random_uuid\(\)/);
    });

    it("source_message_id text not null + uzunluk check", () => {
      expect(createTable).toMatch(/\bsource_message_id text not null check \(char_length\(source_message_id\) between 1 and \d+\)/);
    });

    it("agent_id nullable, agents(id) referansı, on delete cascade", () => {
      expect(createTable).toMatch(/\bagent_id uuid (null )?references (public\.)?agents\s*\(id\) on delete cascade/);
      expect(createTable).not.toMatch(/\bagent_id uuid not null\b/);
    });

    it("source_group ve source_group_name text", () => {
      expect(createTable).toMatch(/\bsource_group text\b/);
      expect(createTable).toMatch(/\bsource_group_name text\b/);
    });

    it("raw_text not null, 1..20000 karakter check", () => {
      expect(createTable).toMatch(/\braw_text text not null check \(char_length\(raw_text\) between 1 and 20000\)/);
    });

    it("reason not null, kısa güvenli karakter kümesi check", () => {
      expect(createTable).toMatch(/\breason text not null check \(reason ~ '\^\[a-z_\]\{1,40\}\$'\)/);
    });

    it("attempts integer not null default 0, negatif olamaz", () => {
      expect(createTable).toMatch(/\battempts int(eger)? not null default 0 check \(attempts >= 0\)/);
    });

    it("status default 'pending', yalnız pending/dead", () => {
      expect(createTable).toMatch(/\bstatus text not null default 'pending' check \(status in \('pending', 'dead'\)\)/);
    });

    it("next_attempt_at, created_at, updated_at timestamptz not null default now()", () => {
      for (const col of ["next_attempt_at", "created_at", "updated_at"]) {
        expect(createTable).toMatch(new RegExp(`\\b${col} timestamptz not null default now\\(\\)`));
      }
    });

    it("KVKK: expires_at varsayılanı now() + 72 saat", () => {
      expect(createTable).toMatch(/\bexpires_at timestamptz not null default now\(\) \+ interval '72 hours'/);
    });
  });

  describe("index'ler", () => {
    it("idempotency: (source_message_id, coalesce(agent_id, sıfır uuid)) unique", () => {
      expect(up).toMatch(
        new RegExp(
          `create unique index (if not exists )?\\S+ on (public\\.)?${TABLE} \\( source_message_id, coalesce\\(agent_id, '00000000-0000-0000-0000-000000000000'::uuid\\) \\)`,
        ),
      );
    });

    it("drain sorgusu için (status, next_attempt_at)", () => {
      expect(up).toMatch(new RegExp(`create index (if not exists )?\\S+ on (public\\.)?${TABLE} \\(status, next_attempt_at\\)`));
    });

    it("purge için expires_at", () => {
      expect(up).toMatch(new RegExp(`create index (if not exists )?\\S+ on (public\\.)?${TABLE} \\(expires_at\\)`));
    });
  });

  describe("erişim — yalnız service_role", () => {
    it("RLS etkin", () => {
      expect(up).toMatch(new RegExp(`alter table (public\\.)?${TABLE} enable row level security`));
    });

    it("hiç policy tanımlanmaz", () => {
      expect(up).not.toMatch(new RegExp(`create policy \\S+ on (public\\.)?${TABLE}\\b`));
    });

    it("public, anon ve authenticated'dan tüm tablo yetkileri kaldırılır", () => {
      const revoke = upStatements.find((s) =>
        new RegExp(`^revoke all on (table )?(public\\.)?${TABLE} from `).test(s),
      );
      expect(revoke).toBeDefined();
      for (const role of ["public", "anon", "authenticated"]) {
        expect(revoke).toMatch(new RegExp(`\\b${role}\\b`));
      }
    });

    it("tabloya hiçbir rol için grant verilmez", () => {
      expect(up).not.toMatch(new RegExp(`grant [^;]*\\bon (table )?(public\\.)?${TABLE}\\b`));
    });
  });

  describe("delete_my_wa_data() — kişisel ham mesajlar da silinir, davranış korunur", () => {
    const fn = deleteFnBlock(up);
    const prevFn = deleteFnBlock(previous);

    it("0024'teki tanım bulunur (karşılaştırma tabanı)", () => {
      expect(prevFn).not.toBe("");
      expect(prevFn).not.toContain("pending_raw_messages");
    });

    it("argümansız, jsonb döner, security definer, search_path = public, pg_temp", () => {
      expect(fn).toMatch(/create or replace function delete_my_wa_data\(\) returns jsonb language plpgsql security definer set search_path = public, pg_temp as \$\$/);
    });

    it("emlakçının bekleyen ham mesajlarını siler (yalnız auth.uid())", () => {
      expect(fn).toContain(ADDED_DELETE.trim());
    });

    it("eklenen silme dışında gövde 0024 ile birebir aynıdır", () => {
      expect(fn.replace(ADDED_DELETE, "")).toBe(prevFn);
    });

    it("grant'ler yeniden belirtilir: public/anon kapalı, authenticated açık", () => {
      expect(up).toMatch(/revoke all on function delete_my_wa_data\(\) from public/);
      expect(up).toMatch(/revoke execute on function delete_my_wa_data\(\) from anon/);
      expect(up).toMatch(/grant execute on function delete_my_wa_data\(\) to authenticated/);
      expect(up).not.toMatch(/grant [^;]*delete_my_wa_data\(\) to anon/);
    });
  });

  describe("rollback (supabase/rollback/)", () => {
    it("delete_my_wa_data() 0024 gövdesine birebir döner", () => {
      expect(deleteFnBlock(rollback)).toBe(deleteFnBlock(previous));
    });

    it("grant'ler korunur", () => {
      expect(rollback).toMatch(/revoke all on function delete_my_wa_data\(\) from public/);
      expect(rollback).toMatch(/revoke execute on function delete_my_wa_data\(\) from anon/);
      expect(rollback).toMatch(/grant execute on function delete_my_wa_data\(\) to authenticated/);
    });

    it("fonksiyon geri yüklendikten SONRA tablo drop edilir", () => {
      const fnAt = rollback.search(/create or replace function delete_my_wa_data/);
      const dropAt = rollback.search(new RegExp(`drop table (if exists )?(public\\.)?${TABLE}\\b`));
      expect(fnAt).toBeGreaterThanOrEqual(0);
      expect(dropAt).toBeGreaterThan(fnAt);
    });
  });
});
