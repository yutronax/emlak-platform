import { NextRequest, NextResponse } from "next/server";
import webpush from "web-push";

import { isAuthorized } from "@/lib/cron/isAuthorized";
import { getVapidConfig } from "@/lib/push/config";
import { isAllowedPushEndpoint, isValidKey } from "@/lib/push/endpoint";
import { removeSubscription } from "@/lib/push/targets";
import { createServiceRoleClient } from "@/lib/supabase/server";

/** Bu süre sinyal gelmezse WhatsApp köprüsü durmuş sayılır. */
const STALE_MS = 10 * 60 * 1000;

type Heartbeat = { last_beat_at: string | null; alerted_at: string | null };
type Subscription = { id: string; endpoint: string; p256dh: string; auth: string };
type Outcome = "sent" | "failed" | "removed";

function statusOf(err: unknown): number | undefined {
  return (err as { statusCode?: number } | null)?.statusCode;
}

/** Telefon, JID veya grup adı içermez. */
function buildPayload(lastBeatMs: number | null, nowMs: number) {
  const body =
    lastBeatMs === null
      ? "WhatsApp köprüsü hiç sinyal göndermedi."
      : `WhatsApp köprüsü ${Math.floor((nowMs - lastBeatMs) / 60_000)} dakikadır sinyal göndermiyor.`;
  return { title: "Scraper durdu", body, url: "/admin/listings" };
}

function parseMs(iso: string | null): number | null {
  if (!iso) return null;
  const ms = Date.parse(iso);
  return Number.isNaN(ms) ? null : ms;
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request.headers.get("authorization"))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = createServiceRoleClient();
  const nowMs = Date.now();

  const hb = await admin
    .from("sidecar_heartbeat")
    .select("last_beat_at, alerted_at")
    .eq("id", 1)
    .maybeSingle<Heartbeat>();
  if (hb.error) {
    console.error("[scraper-health] db_failed: heartbeat", hb.error);
    return NextResponse.json({ error: "db_failed" }, { status: 500 });
  }
  const lastMs = parseMs(hb.data?.last_beat_at ?? null);
  const alertedMs = parseMs(hb.data?.alerted_at ?? null);

  if (lastMs !== null && nowMs - lastMs <= STALE_MS) {
    return NextResponse.json({ status: "ok" });
  }
  // Aynı kesinti: son uyarı son sinyalden sonra gönderildiyse tekrar gönderilmez.
  if (alertedMs !== null && (lastMs === null || alertedMs >= lastMs)) {
    return NextResponse.json({ status: "already_alerted" });
  }

  const vapid = getVapidConfig();
  if (!vapid) {
    console.warn("[scraper-health] devre dışı: VAPID env eksik");
    return NextResponse.json({ status: "disabled" });
  }
  webpush.setVapidDetails(vapid.subject, vapid.publicKey, vapid.privateKey);

  const admins = await admin.from("agents").select("id").eq("is_admin", true);
  if (admins.error) {
    console.error("[scraper-health] db_failed: admins", admins.error);
    return NextResponse.json({ error: "db_failed" }, { status: 500 });
  }
  const adminIds = ((admins.data ?? []) as { id: string }[]).map((a) => a.id);

  let subscriptions: Subscription[] = [];
  if (adminIds.length > 0) {
    const subs = await admin
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth")
      .in("agent_id", adminIds);
    if (subs.error) {
      console.error("[scraper-health] db_failed: subscriptions", subs.error);
      return NextResponse.json({ error: "db_failed" }, { status: 500 });
    }
    subscriptions = (subs.data ?? []) as Subscription[];
  }
  // Abone yok: alerted_at yazılmaz, sonraki çalıştırmada tekrar denenir.
  if (subscriptions.length === 0) {
    return NextResponse.json({ status: "no_subscribers" });
  }

  const payload = JSON.stringify(buildPayload(lastMs, nowMs));
  const outcomes = await Promise.all(
    subscriptions.map(async (sub): Promise<Outcome> => {
      // İkinci katman (SSRF): göndermeden önce yeniden doğrula. Endpoint loglanmaz.
      if (!isAllowedPushEndpoint(sub.endpoint) || !isValidKey(sub.p256dh) || !isValidKey(sub.auth)) {
        console.warn("[scraper-health] invalid endpoint removed", { id: sub.id });
        const { error } = await removeSubscription(admin, sub.id);
        if (error) console.error("[scraper-health] removeSubscription failed", error);
        return "removed";
      }
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload,
        );
      } catch (err) {
        const status = statusOf(err);
        if (status === 404 || status === 410) {
          const { error } = await removeSubscription(admin, sub.id);
          if (error) console.error("[scraper-health] removeSubscription failed", error);
          return "removed";
        }
        console.warn("[scraper-health] send failed", { id: sub.id, status });
        return "failed";
      }
      return "sent";
    }),
  );

  const sent = outcomes.filter((o) => o === "sent").length;
  const failed = outcomes.filter((o) => o === "failed").length;
  const removed = outcomes.filter((o) => o === "removed").length;

  // Yalnız en az bir gönderim başarılıysa işaretle; hepsi başarısızsa sonraki çalıştırmada tekrar denenir.
  if (sent > 0) {
    const { error } = await admin
      .from("sidecar_heartbeat")
      .update({ alerted_at: new Date(nowMs).toISOString() })
      .eq("id", 1);
    if (error) console.error("[scraper-health] alerted_at update failed", error);
  }

  return NextResponse.json({ status: "alerted", sent, failed, removed });
}
