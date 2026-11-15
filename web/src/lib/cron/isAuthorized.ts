import { timingSafeEqual } from "node:crypto";

/**
 * Cron route yetkisi: `Authorization: Bearer <CRON_SECRET>`.
 * Fail-closed: CRON_SECRET yoksa hiçbir istek geçmez (AC-S3).
 */
export function isAuthorized(header: string | null): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret || !header) return false;
  const expected = `Bearer ${secret}`;
  if (header.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(header), Buffer.from(expected));
}
