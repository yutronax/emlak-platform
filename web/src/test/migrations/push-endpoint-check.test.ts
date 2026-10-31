import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { isAllowedPushEndpoint, isValidKey } from "@/lib/push/endpoint";

/**
 * Red-team (faz2c-web-push, KRİTİK) — 0022_push_endpoint_check migration'ı.
 *
 * Endpoint allowlist ve anahtar formatı DB CHECK kısıtı olarak zorlanır (ikinci katman).
 * Testler SQL dosyasını statik okur; ek olarak endpoint regex'i JS'te çalıştırılıp
 * isAllowedPushEndpoint ile aynı kümeyi kabul ettiği doğrulanır (parite).
 */

const MIGRATIONS_DIR = path.resolve(__dirname, "../../../../supabase/migrations");
const UP_FILE = "0022_push_endpoint_check.sql";
const DOWN_FILE = "0022_push_endpoint_check.down.sql";
const TABLE = "push_subscriptions";
const ENDPOINT_CONSTRAINT = "push_subscriptions_endpoint_allowlist";
const KEYS_CONSTRAINT = "push_subscriptions_keys_format";

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

const rawUp = readSql(UP_FILE);
const up = normalize(rawUp);
const down = normalize(readSql(DOWN_FILE));

/** Raw SQL'den endpoint regex literal'i (büyük/küçük harf korunur). */
function endpointRegexSource(): string | null {
  const m = rawUp.match(/endpoint ~ '([^']+)'/);
  return m ? m[1] : null;
}

describe("0022_push_endpoint_check — endpoint/anahtar CHECK kısıtları", () => {
  it("up ve down dosyaları mevcut", () => {
    expect(rawUp.length).toBeGreaterThan(0);
    expect(readSql(DOWN_FILE).length).toBeGreaterThan(0);
  });

  describe("temizlik (constraint öncesi)", () => {
    it("kural dışı mevcut satırları siler: delete from push_subscriptions where not (...)", () => {
      expect(up).toMatch(new RegExp(`delete from (public\\.)?${TABLE} where not \\(`));
    });

    it("temizlik ALTER'dan önce gelir", () => {
      const deleteIdx = up.indexOf("delete from");
      const alterIdx = up.indexOf("alter table");
      expect(deleteIdx).toBeGreaterThanOrEqual(0);
      expect(alterIdx).toBeGreaterThan(deleteIdx);
    });
  });

  describe("endpoint allowlist", () => {
    it("constraint adı push_subscriptions_endpoint_allowlist ve idempotent drop if exists önce gelir", () => {
      expect(up).toContain(
        `alter table ${TABLE} drop constraint if exists ${ENDPOINT_CONSTRAINT}`,
      );
      expect(up).toContain(
        `alter table ${TABLE} add constraint ${ENDPOINT_CONSTRAINT} check (`,
      );
    });

    it("https zorunlu: regex '^https://' ile başlar", () => {
      const src = endpointRegexSource();
      expect(src).not.toBeNull();
      expect(src!.startsWith("^https://")).toBe(true);
      expect(up).not.toMatch(/\^http:\/\//);
    });

    it("uzunluk sınırı: char_length(endpoint) <= 1024", () => {
      expect(up).toMatch(/char_length\(endpoint\) <= 1024/);
    });

    it("host allowlist: fcm.googleapis.com, *.push.apple.com, updates.push.services.mozilla.com, *.notify.windows.com", () => {
      const src = endpointRegexSource()!;
      expect(src).toContain("fcm\\.googleapis\\.com");
      expect(src).toContain("([a-z0-9-]+\\.)+push\\.apple\\.com");
      expect(src).toContain("updates\\.push\\.services\\.mozilla\\.com");
      expect(src).toContain("([a-z0-9-]+\\.)+notify\\.windows\\.com");
    });

    it("host'tan sonra yalnız '/' veya string sonu kabul edilir (port, @, sonek saldırısı yok)", () => {
      expect(endpointRegexSource()!.endsWith("(/|$)")).toBe(true);
    });

    describe("regex parite — isAllowedPushEndpoint ile aynı küme", () => {
      const re = new RegExp(endpointRegexSource() ?? "$^");

      it.each([
        "https://fcm.googleapis.com/fcm/send/abc123",
        "https://fcm.googleapis.com",
        "https://updates.push.services.mozilla.com/wpush/v2/xyz",
        "https://web.push.apple.com/QWERTY",
        "https://wns2-db5p.notify.windows.com/w/?token",
      ])("kabul: %s", (endpoint) => {
        expect(re.test(endpoint)).toBe(true);
        expect(isAllowedPushEndpoint(endpoint)).toBe(true);
      });

      it.each([
        "http://fcm.googleapis.com/x",
        "https://evil.com/x",
        "http://169.254.169.254/latest",
        "https://fcm.googleapis.com.evil.com/x",
        "https://evilpush.apple.com/x",
        "https://push.apple.com.evil.com/x",
        "https://push.apple.com/x",
        "https://fcm.googleapis.com:443/x",
        "https://user@fcm.googleapis.com/x",
        "https://fcm.googleapis.com?x=1",
        "javascript:alert(1)",
      ])("red: %s", (endpoint) => {
        expect(re.test(endpoint)).toBe(false);
        expect(isAllowedPushEndpoint(endpoint)).toBe(false);
      });
    });
  });

  describe("anahtar formatı (p256dh / auth)", () => {
    it("constraint adı push_subscriptions_keys_format", () => {
      expect(up).toContain(
        `alter table ${TABLE} add constraint ${KEYS_CONSTRAINT} check (`,
      );
      expect(up).toContain(`alter table ${TABLE} drop constraint if exists ${KEYS_CONSTRAINT}`);
    });

    it("p256dh ve auth için char_length <= 200", () => {
      expect(up).toMatch(/char_length\(p256dh\) <= 200/);
      expect(up).toMatch(/char_length\(auth\) <= 200/);
    });

    it("p256dh ve auth için base64url regex '^[A-Za-z0-9_-]+$'", () => {
      expect(rawUp).toMatch(/p256dh ~ '\^\[A-Za-z0-9_-\]\+\$'/);
      expect(rawUp).toMatch(/auth ~ '\^\[A-Za-z0-9_-\]\+\$'/);
    });

    it("JS isValidKey ile uyumlu örnekler", () => {
      expect(isValidKey("BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts")).toBe(true);
      expect(isValidKey("bad+key/value")).toBe(false);
    });
  });

  describe("rollback — down dosyası", () => {
    it("her iki constraint'i de düşürür", () => {
      expect(down).toContain(`alter table ${TABLE} drop constraint if exists ${ENDPOINT_CONSTRAINT}`);
      expect(down).toContain(`alter table ${TABLE} drop constraint if exists ${KEYS_CONSTRAINT}`);
    });

    it("tabloyu düşürmez (tablo 0021 down'ında düşer)", () => {
      expect(down).not.toMatch(/drop table/);
    });
  });
});
