import { NextRequest } from "next/server";
import webpush from "web-push";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createServiceRoleClient } from "@/lib/supabase/server";
import { removeSubscription } from "@/lib/push/targets";

import { GET } from "./route";

vi.mock("web-push", () => {
  const sendNotification = vi.fn();
  const setVapidDetails = vi.fn();
  return {
    default: { sendNotification, setVapidDetails },
    sendNotification,
    setVapidDetails,
  };
});

vi.mock("@/lib/supabase/server", () => ({
  createServiceRoleClient: vi.fn(),
}));

vi.mock("@/lib/push/targets", () => ({
  removeSubscription: vi.fn(),
}));

const HEALTH_URL = "http://localhost/api/cron/scraper-health";
const SECRET = "test-cron-secret";
const VAPID_ENV = {
  VAPID_PUBLIC_KEY: "vapid-public-test",
  VAPID_PRIVATE_KEY: "vapid-private-test",
  VAPID_SUBJECT: "mailto:ops@example.com",
};

const NOW = new Date("2026-11-16T12:00:00.000Z");
const NOW_ISO = NOW.toISOString();
const minutesAgo = (minutes: number): string => new Date(NOW.getTime() - minutes * 60_000).toISOString();

const SUB_1 = { id: "sub-1", endpoint: "https://fcm.googleapis.com/fcm/send/1", p256dh: "p256dh-1", auth: "auth-1" };
const SUB_2 = { id: "sub-2", endpoint: "https://web.push.apple.com/2", p256dh: "p256dh-2", auth: "auth-2" };

type DbState = {
  heartbeat: { data: { last_beat_at: string | null; alerted_at: string | null } | null; error: unknown };
  heartbeatUpdateError: unknown;
  admins: { data: { id: string }[] | null; error: unknown };
  subs: { data: { id: string; endpoint: string; p256dh: string; auth: string }[] | null; error: unknown };
};

// Varsayılan: son sinyal 12 dk önce, daha önce uyarılmamış, 2 abonelikli bir admin.
function defaultDb(): DbState {
  return {
    heartbeat: { data: { last_beat_at: minutesAgo(12), alerted_at: null }, error: null },
    heartbeatUpdateError: null,
    admins: { data: [{ id: "admin-1" }], error: null },
    subs: { data: [SUB_1, SUB_2], error: null },
  };
}

let db: DbState;
let heartbeatUpdates: Record<string, unknown>[];

// Yalnız route'un kullandığı zincir şekillerini taklit eder.
function fakeAdmin() {
  return {
    from: (table: string) => {
      if (table === "sidecar_heartbeat") {
        return {
          select: () => ({ eq: () => ({ maybeSingle: async () => db.heartbeat }) }),
          update: (values: Record<string, unknown>) => ({
            eq: async () => {
              heartbeatUpdates.push(values);
              return { error: db.heartbeatUpdateError };
            },
          }),
        };
      }
      if (table === "agents") {
        return { select: () => ({ eq: async () => db.admins }) };
      }
      if (table === "push_subscriptions") {
        return { select: () => ({ in: async () => db.subs }) };
      }
      throw new Error(`beklenmeyen tablo: ${table}`);
    },
  };
}

function healthRequest(authorizationHeader?: string): NextRequest {
  const headers: Record<string, string> = {};
  if (authorizationHeader !== undefined) {
    headers.authorization = authorizationHeader;
  }
  return new NextRequest(HEALTH_URL, { method: "GET", headers });
}

function httpError(statusCode: number): Error {
  return Object.assign(new Error(`push ${statusCode}`), { statusCode });
}

const ENV_KEYS = ["CRON_SECRET", ...Object.keys(VAPID_ENV)] as const;

describe("GET /api/cron/scraper-health (scraper bayatlık uyarısı)", () => {
  const originalEnv: Record<string, string | undefined> = {};
  let consoleWarn: ReturnType<typeof vi.spyOn>;
  let consoleError: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
    for (const key of ENV_KEYS) originalEnv[key] = process.env[key];
    process.env.CRON_SECRET = SECRET;
    Object.assign(process.env, VAPID_ENV);

    consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => {});
    consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    db = defaultDb();
    heartbeatUpdates = [];
    vi.mocked(createServiceRoleClient).mockReturnValue(fakeAdmin() as never);
    vi.mocked(webpush.sendNotification).mockResolvedValue({ statusCode: 201, body: "", headers: {} } as never);
    vi.mocked(removeSubscription).mockResolvedValue({ error: null });
  });

  afterEach(() => {
    vi.useRealTimers();
    for (const key of ENV_KEYS) {
      const value = originalEnv[key];
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
    consoleWarn.mockRestore();
    consoleError.mockRestore();
  });

  // Yetki: yanlış / eksik başlık → 401, hiçbir DB okuma veya gönderim yok.
  it.each([
    { label: "Authorization başlığı yok", header: undefined },
    { label: "yanlış secret", header: "Bearer wrong-secret" },
    { label: "Bearer öneki yok", header: SECRET },
  ])("yetkisiz ($label) → 401 {error:'unauthorized'}, DB ve gönderim yok", async ({ header }) => {
    const res = await GET(healthRequest(header));

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "unauthorized" });
    expect(createServiceRoleClient).not.toHaveBeenCalled();
    expect(webpush.sendNotification).not.toHaveBeenCalled();
  });

  it("CRON_SECRET env yoksa 401 (fail-closed)", async () => {
    delete process.env.CRON_SECRET;

    const res = await GET(healthRequest(`Bearer ${SECRET}`));

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "unauthorized" });
    expect(createServiceRoleClient).not.toHaveBeenCalled();
  });

  it("heartbeat okuma hatası → 500 {error:'db_failed'}, gönderim yok", async () => {
    db.heartbeat = { data: null, error: { message: "network" } };

    const res = await GET(healthRequest(`Bearer ${SECRET}`));

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "db_failed" });
    expect(consoleError).toHaveBeenCalled();
    expect(webpush.sendNotification).not.toHaveBeenCalled();
  });

  it("son sinyal 5 dk önce (bayat değil) → 200 {status:'ok'}, gönderim ve yazma yok", async () => {
    db.heartbeat = { data: { last_beat_at: minutesAgo(5), alerted_at: null }, error: null };

    const res = await GET(healthRequest(`Bearer ${SECRET}`));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok" });
    expect(webpush.sendNotification).not.toHaveBeenCalled();
    expect(heartbeatUpdates).toEqual([]);
  });

  // Aynı kesinti: alerted_at, son sinyalden sonra → tekrar gönderilmez.
  it("bayat ve alerted_at >= last_beat_at → 200 {status:'already_alerted'}, gönderim ve yazma yok", async () => {
    db.heartbeat = { data: { last_beat_at: minutesAgo(12), alerted_at: minutesAgo(3) }, error: null };

    const res = await GET(healthRequest(`Bearer ${SECRET}`));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "already_alerted" });
    expect(webpush.sendNotification).not.toHaveBeenCalled();
    expect(heartbeatUpdates).toEqual([]);
  });

  it("last_beat_at null ve alerted_at dolu → 200 {status:'already_alerted'}", async () => {
    db.heartbeat = { data: { last_beat_at: null, alerted_at: minutesAgo(1) }, error: null };

    const res = await GET(healthRequest(`Bearer ${SECRET}`));

    expect(await res.json()).toEqual({ status: "already_alerted" });
    expect(webpush.sendNotification).not.toHaveBeenCalled();
  });

  // Yeni kesinti: alerted_at, son sinyalden ÖNCE (eski kesinti) → yeniden uyarılır.
  it("bayat ve alerted_at < last_beat_at (yeni kesinti) → uyarı gönderilir", async () => {
    db.heartbeat = { data: { last_beat_at: minutesAgo(12), alerted_at: minutesAgo(60) }, error: null };

    const res = await GET(healthRequest(`Bearer ${SECRET}`));

    expect(await res.json()).toEqual({ status: "alerted", sent: 2, failed: 0, removed: 0 });
    expect(webpush.sendNotification).toHaveBeenCalledTimes(2);
  });

  it("VAPID env yoksa 200 {status:'disabled'}, gönderim ve yazma yok", async () => {
    for (const key of Object.keys(VAPID_ENV)) delete process.env[key];

    const res = await GET(healthRequest(`Bearer ${SECRET}`));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "disabled" });
    expect(consoleWarn).toHaveBeenCalled();
    expect(webpush.sendNotification).not.toHaveBeenCalled();
    expect(heartbeatUpdates).toEqual([]);
  });

  // Admin yok ya da admin aboneliği yok → alerted_at yazılmaz; sonraki çalıştırmada tekrar denenir.
  it.each([
    { label: "admin yok", admins: [] as { id: string }[], subs: [] },
    { label: "admin var, abonelik yok", admins: [{ id: "admin-1" }], subs: [] },
  ])("$label → 200 {status:'no_subscribers'}, alerted_at yazılmaz", async ({ admins, subs }) => {
    db.admins = { data: admins, error: null };
    db.subs = { data: subs, error: null };

    const res = await GET(healthRequest(`Bearer ${SECRET}`));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "no_subscribers" });
    expect(webpush.sendNotification).not.toHaveBeenCalled();
    expect(heartbeatUpdates).toEqual([]);
  });

  it("admin sorgusu hatası → 500 {error:'db_failed'}, gönderim yok", async () => {
    db.admins = { data: null, error: { message: "timeout" } };

    const res = await GET(healthRequest(`Bearer ${SECRET}`));

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "db_failed" });
    expect(webpush.sendNotification).not.toHaveBeenCalled();
  });

  it("abonelik sorgusu hatası → 500 {error:'db_failed'}, gönderim yok", async () => {
    db.subs = { data: null, error: { message: "timeout" } };

    const res = await GET(healthRequest(`Bearer ${SECRET}`));

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "db_failed" });
    expect(webpush.sendNotification).not.toHaveBeenCalled();
  });

  // Ana yol: 12 dk bayat, 2 admin cihazı → 2 gönderim, tam payload, alerted_at = şimdi.
  it("bayat (12 dk) + 2 abonelik → alerted, tam payload metni, alerted_at şimdi yazılır", async () => {
    const res = await GET(healthRequest(`Bearer ${SECRET}`));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "alerted", sent: 2, failed: 0, removed: 0 });

    expect(webpush.sendNotification).toHaveBeenCalledTimes(2);
    const calls = vi.mocked(webpush.sendNotification).mock.calls as [
      { endpoint: string; keys: { p256dh: string; auth: string } },
      string,
    ][];
    const endpoints = calls.map(([subscription]) => subscription.endpoint).sort();
    expect(endpoints).toEqual([SUB_1.endpoint, SUB_2.endpoint].sort());

    for (const [, rawPayload] of calls) {
      const payload = JSON.parse(rawPayload) as Record<string, unknown>;
      expect(Object.keys(payload).sort()).toEqual(["body", "title", "url"]);
      expect(payload).toEqual({
        title: "Scraper durdu",
        body: "WhatsApp köprüsü 12 dakikadır sinyal göndermiyor.",
        url: "/admin/listings",
      });
    }

    expect(heartbeatUpdates).toEqual([{ alerted_at: NOW_ISO }]);
  });

  it("VAPID detayları env'den setVapidDetails ile verilir", async () => {
    await GET(healthRequest(`Bearer ${SECRET}`));

    expect(webpush.setVapidDetails).toHaveBeenCalledWith(
      VAPID_ENV.VAPID_SUBJECT,
      VAPID_ENV.VAPID_PUBLIC_KEY,
      VAPID_ENV.VAPID_PRIVATE_KEY,
    );
  });

  it("last_beat_at null (hiç sinyal yok) → payload 'hiç sinyal göndermedi' metni", async () => {
    db.heartbeat = { data: { last_beat_at: null, alerted_at: null }, error: null };

    const res = await GET(healthRequest(`Bearer ${SECRET}`));

    expect(await res.json()).toEqual({ status: "alerted", sent: 2, failed: 0, removed: 0 });
    const [, rawPayload] = vi.mocked(webpush.sendNotification).mock.calls[0] as [unknown, string];
    expect(JSON.parse(rawPayload)).toEqual({
      title: "Scraper durdu",
      body: "WhatsApp köprüsü hiç sinyal göndermedi.",
      url: "/admin/listings",
    });
    expect(heartbeatUpdates).toEqual([{ alerted_at: NOW_ISO }]);
  });

  // 410: push servisi aboneliği geçersiz saydı → satır silinir; başka gönderim başarılıysa alerted_at yazılır.
  it("410 → abonelik silinir, removed 1; bir gönderim başarılıysa alerted_at yazılır", async () => {
    vi.mocked(webpush.sendNotification).mockImplementation(async (subscription) => {
      if ((subscription as { endpoint: string }).endpoint === SUB_1.endpoint) throw httpError(410);
      return { statusCode: 201, body: "", headers: {} } as never;
    });

    const res = await GET(healthRequest(`Bearer ${SECRET}`));

    expect(await res.json()).toEqual({ status: "alerted", sent: 1, failed: 0, removed: 1 });
    expect(removeSubscription).toHaveBeenCalledTimes(1);
    expect(removeSubscription).toHaveBeenCalledWith(expect.anything(), SUB_1.id);
    expect(heartbeatUpdates).toEqual([{ alerted_at: NOW_ISO }]);
  });

  it("404 → abonelik silinir (removed)", async () => {
    db.subs = { data: [SUB_1], error: null };
    vi.mocked(webpush.sendNotification).mockRejectedValueOnce(httpError(404));

    const res = await GET(healthRequest(`Bearer ${SECRET}`));

    expect(await res.json()).toEqual({ status: "alerted", sent: 0, failed: 0, removed: 1 });
    expect(removeSubscription).toHaveBeenCalledWith(expect.anything(), SUB_1.id);
  });

  // Hepsi başarısız → alerted_at yazılmaz; bir sonraki çalıştırmada tekrar denenir.
  it("tüm gönderimler 500 → failed 2, alerted_at yazılmaz, satır silinmez", async () => {
    vi.mocked(webpush.sendNotification).mockRejectedValue(httpError(500));

    const res = await GET(healthRequest(`Bearer ${SECRET}`));

    expect(await res.json()).toEqual({ status: "alerted", sent: 0, failed: 2, removed: 0 });
    expect(heartbeatUpdates).toEqual([]);
    expect(removeSubscription).not.toHaveBeenCalled();
  });

  // SSRF ikinci katman: allowlist dışı endpoint'e istek atılmaz, satır silinir, endpoint loglanmaz.
  it("kural dışı endpoint → sendNotification yok, satır silinir, endpoint loglanmaz", async () => {
    const badEndpoint = "http://169.254.169.254/latest/meta-data";
    db.subs = { data: [{ id: "bad-1", endpoint: badEndpoint, p256dh: "p256dh-x", auth: "auth-x" }, SUB_2], error: null };

    const res = await GET(healthRequest(`Bearer ${SECRET}`));

    expect(await res.json()).toEqual({ status: "alerted", sent: 1, failed: 0, removed: 1 });
    expect(webpush.sendNotification).toHaveBeenCalledTimes(1);
    expect(removeSubscription).toHaveBeenCalledWith(expect.anything(), "bad-1");
    expect(JSON.stringify(consoleWarn.mock.calls)).not.toContain(badEndpoint);
  });

  it("alerted_at yazma hatası → yine 200 {status:'alerted'}, hata loglanır", async () => {
    db.heartbeatUpdateError = { message: "write failed" };

    const res = await GET(healthRequest(`Bearer ${SECRET}`));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "alerted", sent: 2, failed: 0, removed: 0 });
    expect(consoleError).toHaveBeenCalled();
  });
});
