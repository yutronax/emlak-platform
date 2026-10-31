import { timingSafeEqual } from "node:crypto";

import { NextRequest, NextResponse } from "next/server";
import webpush from "web-push";

import { getVapidConfig } from "@/lib/push/config";
import { isAllowedPushEndpoint, isValidKey } from "@/lib/push/endpoint";
import { buildPayload } from "@/lib/push/payload";
import {
  countNewListings,
  loadTargets,
  markNotified,
  removeSubscription,
} from "@/lib/push/targets";
import type { PushTarget } from "@/lib/push/targets";
import { createServiceRoleClient } from "@/lib/supabase/server";

/** Aynı anda Supabase / push servisine giden istek üst sınırı (1000 abonelikte < 10 sn hedefi). */
const CONCURRENCY = 20;

type Summary = {
  sent: number;
  failed: number;
  removed: number;
  skipped: "disabled" | "no_subscribers" | "nothing_new" | null;
};

function isAuthorized(header: string | null): boolean {
  // Fail-closed: CRON_SECRET yoksa hiçbir istek geçmez (AC-S3).
  const secret = process.env.CRON_SECRET;
  if (!secret || !header) return false;
  const expected = `Bearer ${secret}`;
  if (header.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(header), Buffer.from(expected));
}

function emptySummary(skipped: Summary["skipped"]): Summary {
  return { sent: 0, failed: 0, removed: 0, skipped };
}

async function mapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await fn(items[index]);
    }
  });
  await Promise.all(workers);
  return results;
}

type Outcome = "sent" | "failed" | "removed";

function statusOf(err: unknown): number | undefined {
  return (err as { statusCode?: number } | null)?.statusCode;
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request.headers.get("authorization"))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const vapid = getVapidConfig();
  if (!vapid) {
    console.warn("[push] cron devre dışı: VAPID env eksik");
    return NextResponse.json(emptySummary("disabled"));
  }
  webpush.setVapidDetails(vapid.subject, vapid.publicKey, vapid.privateKey);

  const admin = createServiceRoleClient();
  // Pencere işaretçisi: bu çalışmanın başlangıcı. Gönderilen satırların last_notified_at'i bu değer olur.
  const runAt = new Date().toISOString();

  const loaded = await loadTargets(admin);
  if (loaded.error || !loaded.data) {
    console.error("[push] cron db_failed: loadTargets", loaded.error);
    return NextResponse.json({ error: "db_failed" }, { status: 500 });
  }
  const targets: PushTarget[] = loaded.data;
  if (targets.length === 0) {
    return NextResponse.json(emptySummary("no_subscribers"));
  }

  // Önce tüm sayımlar; herhangi biri hata verirse hiçbir cihaza gönderim yapılmaz.
  const counts = await mapLimit(targets, CONCURRENCY, (t) => countNewListings(admin, t.since, t.agent_id));
  const countFailure = counts.find((c) => c.error);
  if (countFailure) {
    console.error("[push] cron db_failed: countNewListings", countFailure.error);
    return NextResponse.json({ error: "db_failed" }, { status: 500 });
  }

  const pending = targets
    .map((target, i) => ({ target, count: counts[i].count }))
    .filter((p) => p.count > 0);
  if (pending.length === 0) {
    return NextResponse.json(emptySummary("nothing_new"));
  }

  const outcomes = await mapLimit(pending, CONCURRENCY, async ({ target, count }): Promise<Outcome> => {
    // İkinci katman (SSRF): DB CHECK kısıtına ek olarak göndermeden önce yeniden doğrula.
    // Geçersiz satıra istek atılmaz; satır silinir. Endpoint loglanmaz.
    if (!isAllowedPushEndpoint(target.endpoint) || !isValidKey(target.p256dh) || !isValidKey(target.auth)) {
      console.warn("[push] invalid endpoint removed", { id: target.id });
      const { error } = await removeSubscription(admin, target.id);
      if (error) console.error("[push] removeSubscription failed", error);
      return "removed";
    }

    const subscription = {
      endpoint: target.endpoint,
      keys: { p256dh: target.p256dh, auth: target.auth },
    };
    try {
      await webpush.sendNotification(subscription, JSON.stringify(buildPayload(count)));
    } catch (err) {
      const status = statusOf(err);
      if (status === 404 || status === 410) {
        // Push servisi aboneliği geçersiz saydı (AC-7).
        const { error } = await removeSubscription(admin, target.id);
        if (error) console.error("[push] removeSubscription failed", error);
        return "removed";
      }
      // 429/5xx: satır tutulur, last_notified_at değişmez; sonraki pencerede tekrar sayılır.
      console.warn("[push] send failed", { id: target.id, status });
      return "failed";
    }

    const { error } = await markNotified(admin, target.id, runAt);
    if (error) console.error("[push] markNotified failed", error);
    return "sent";
  });

  const summary: Summary = {
    sent: outcomes.filter((o) => o === "sent").length,
    failed: outcomes.filter((o) => o === "failed").length,
    removed: outcomes.filter((o) => o === "removed").length,
    skipped: null,
  };
  console.info("[push] cron", summary);
  return NextResponse.json(summary);
}
