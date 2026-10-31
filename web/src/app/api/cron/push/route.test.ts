import { NextRequest } from "next/server";
import webpush from "web-push";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createServiceRoleClient } from "@/lib/supabase/server";
import {
  countNewListings,
  loadTargets,
  markNotified,
  removeSubscription,
} from "@/lib/push/targets";
import type { PushTarget } from "@/lib/push/targets";

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
  loadTargets: vi.fn(),
  countNewListings: vi.fn(),
  markNotified: vi.fn(),
  removeSubscription: vi.fn(),
}));

const CRON_URL = "http://localhost/api/cron/push";
const SECRET = "test-cron-secret";
const VAPID_ENV = {
  VAPID_PUBLIC_KEY: "vapid-public-test",
  VAPID_PRIVATE_KEY: "vapid-private-test",
  VAPID_SUBJECT: "mailto:ops@example.com",
};

const SINCE_A = "2026-10-29T10:00:00.000Z";
const SINCE_B = "2026-10-29T11:00:00.000Z";

// loadTargets, sunucu tarafında erişimi olan (AC-3) aktif satırları ve
// since = coalesce(last_notified_at, created_at) değerini döner.
const TARGET_A: PushTarget = {
  id: "sub-a",
  agent_id: "agent-a",
  endpoint: "https://fcm.googleapis.com/fcm/send/a",
  p256dh: "p256dh-a",
  auth: "auth-a",
  since: SINCE_A,
};
const TARGET_B: PushTarget = {
  id: "sub-b",
  agent_id: "agent-b",
  endpoint: "https://web.push.apple.com/b",
  p256dh: "p256dh-b",
  auth: "auth-b",
  since: SINCE_B,
};

function cronRequest(authorizationHeader?: string): NextRequest {
  const headers: Record<string, string> = {};
  if (authorizationHeader !== undefined) {
    headers.authorization = authorizationHeader;
  }
  return new NextRequest(CRON_URL, { method: "GET", headers });
}

function httpError(statusCode: number): Error {
  return Object.assign(new Error(`push ${statusCode}`), { statusCode });
}

const ENV_KEYS = ["CRON_SECRET", ...Object.keys(VAPID_ENV)] as const;

describe("GET /api/cron/push (AC-2, AC-3, AC-6, AC-7, AC-S3, AC-S4)", () => {
  const originalEnv: Record<string, string | undefined> = {};
  let consoleWarn: ReturnType<typeof vi.spyOn>;
  let consoleError: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    for (const key of ENV_KEYS) originalEnv[key] = process.env[key];
    process.env.CRON_SECRET = SECRET;
    Object.assign(process.env, VAPID_ENV);

    consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => {});
    consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    vi.mocked(createServiceRoleClient).mockReturnValue({} as never);
    vi.mocked(loadTargets).mockResolvedValue({ data: [TARGET_A, TARGET_B], error: null });
    // Varsayılan: A cihazına 3 yeni ilan, B cihazına yeni ilan yok.
    vi.mocked(countNewListings).mockImplementation(async (_admin, since) => ({
      count: since === SINCE_A ? 3 : 0,
      error: null,
    }));
    vi.mocked(webpush.sendNotification).mockResolvedValue({ statusCode: 201, body: "", headers: {} } as never);
    vi.mocked(markNotified).mockResolvedValue({ error: null });
    vi.mocked(removeSubscription).mockResolvedValue({ error: null });
  });

  afterEach(() => {
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

  // AC-S3: yetkisiz çağrı → 401, hiçbir DB okuma/gönderim yok.
  it.each([
    { label: "Authorization başlığı yok", header: undefined },
    { label: "yanlış secret", header: "Bearer wrong-secret" },
    { label: "Bearer öneki yok", header: SECRET },
  ])("AC-S3: $label → 401 {error:'unauthorized'}, DB ve gönderim yok", async ({ header }) => {
    const res = await GET(cronRequest(header));

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "unauthorized" });
    expect(loadTargets).not.toHaveBeenCalled();
    expect(countNewListings).not.toHaveBeenCalled();
    expect(webpush.sendNotification).not.toHaveBeenCalled();
  });

  // AC-S3 fail-closed: CRON_SECRET env yoksa geçerli görünen header bile reddedilir.
  it("AC-S3: CRON_SECRET env yoksa 401 (fail-closed), DB ve gönderim yok", async () => {
    delete process.env.CRON_SECRET;

    const res = await GET(cronRequest(`Bearer ${SECRET}`));

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "unauthorized" });
    expect(loadTargets).not.toHaveBeenCalled();
    expect(webpush.sendNotification).not.toHaveBeenCalled();
  });

  // AC-6: VAPID env eksikse özellik kapalı → 200 skipped "disabled", gönderim yok.
  it("AC-6: VAPID env yoksa 200 {skipped:'disabled'} döner ve console.warn çağrılır", async () => {
    for (const key of Object.keys(VAPID_ENV)) delete process.env[key];

    const res = await GET(cronRequest(`Bearer ${SECRET}`));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ sent: 0, failed: 0, removed: 0, skipped: "disabled" });
    expect(consoleWarn).toHaveBeenCalled();
    expect(webpush.sendNotification).not.toHaveBeenCalled();
  });

  // AC-2 + AC-S4: 2 cihaz, biri 3 yeni ilan → tek gönderim; payload yalnız {title, body, url}.
  it("AC-2: 2 cihazdan biri 3 yeni ilanlı → 1 sendNotification, payload {title,body,url}, body '3 yeni ilan geldi'", async () => {
    const res = await GET(cronRequest(`Bearer ${SECRET}`));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ sent: 1, failed: 0, removed: 0, skipped: null });

    expect(webpush.sendNotification).toHaveBeenCalledTimes(1);
    const [subscription, rawPayload] = vi.mocked(webpush.sendNotification).mock.calls[0] as [
      { endpoint: string; keys: { p256dh: string; auth: string } },
      string,
    ];
    expect(subscription).toEqual({
      endpoint: TARGET_A.endpoint,
      keys: { p256dh: TARGET_A.p256dh, auth: TARGET_A.auth },
    });

    const payload = JSON.parse(rawPayload) as Record<string, unknown>;
    expect(Object.keys(payload).sort()).toEqual(["body", "title", "url"]);
    expect(payload).toEqual({
      title: "Yeni ilanlar",
      body: "3 yeni ilan geldi",
      url: "/agent/dashboard",
    });
  });

  it("AC-2: VAPID detayları env'den setVapidDetails ile verilir", async () => {
    await GET(cronRequest(`Bearer ${SECRET}`));

    expect(webpush.setVapidDetails).toHaveBeenCalledWith(
      VAPID_ENV.VAPID_SUBJECT,
      VAPID_ENV.VAPID_PUBLIC_KEY,
      VAPID_ENV.VAPID_PRIVATE_KEY,
    );
  });

  it("AC-2: başarılı gönderimde yalnız o satırın last_notified_at güncellenir", async () => {
    await GET(cronRequest(`Bearer ${SECRET}`));

    expect(markNotified).toHaveBeenCalledTimes(1);
    expect(markNotified).toHaveBeenCalledWith(expect.anything(), TARGET_A.id, expect.any(String));
    expect(markNotified).not.toHaveBeenCalledWith(expect.anything(), TARGET_B.id, expect.anything());
  });

  // AC-7: push servisi 404/410 → satır silinir, removed artar, last_notified_at güncellenmez.
  it.each([404, 410])("AC-7: push %i → satır silinir, removed 1", async (statusCode) => {
    vi.mocked(loadTargets).mockResolvedValue({ data: [TARGET_A], error: null });
    vi.mocked(webpush.sendNotification).mockRejectedValueOnce(httpError(statusCode));

    const res = await GET(cronRequest(`Bearer ${SECRET}`));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ sent: 0, failed: 0, removed: 1, skipped: null });
    expect(removeSubscription).toHaveBeenCalledWith(expect.anything(), TARGET_A.id);
    expect(markNotified).not.toHaveBeenCalled();
  });

  // AC-7 (kısmi, sözleşme #11): 5xx hatası → failed 1, satır tutulur, last_notified_at değişmez.
  it("AC-7: push 500 → failed 1, satır silinmez, o satırın last_notified_at güncellenmez", async () => {
    vi.mocked(loadTargets).mockResolvedValue({ data: [TARGET_A], error: null });
    vi.mocked(webpush.sendNotification).mockRejectedValueOnce(httpError(500));

    const res = await GET(cronRequest(`Bearer ${SECRET}`));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ sent: 0, failed: 1, removed: 0, skipped: null });
    expect(removeSubscription).not.toHaveBeenCalled();
    expect(markNotified).not.toHaveBeenCalled();
    expect(consoleWarn).toHaveBeenCalled();
  });

  it("AC-7 kısmi: A 429 (başarısız), B başarılı → sent 1, failed 1; yalnız B'nin last_notified_at güncellenir", async () => {
    vi.mocked(countNewListings).mockResolvedValue({ count: 2, error: null });
    vi.mocked(webpush.sendNotification).mockRejectedValueOnce(httpError(429));

    const res = await GET(cronRequest(`Bearer ${SECRET}`));

    expect(await res.json()).toEqual({ sent: 1, failed: 1, removed: 0, skipped: null });
    expect(markNotified).toHaveBeenCalledTimes(1);
    expect(markNotified).toHaveBeenCalledWith(expect.anything(), TARGET_B.id, expect.any(String));
    expect(markNotified).not.toHaveBeenCalledWith(expect.anything(), TARGET_A.id, expect.anything());
  });

  // Red-team (SSRF ikinci katman): DB'ye kural dışı satır yazılmış olsa bile göndermeden önce
  // allowlist yeniden doğrulanır; geçmezse istek atılmaz, satır silinir, endpoint loglanmaz.
  it.each([
    { label: "allowlist dışı endpoint", endpoint: "http://169.254.169.254/latest/meta-data", p256dh: "p256dh-x", auth: "auth-x" },
    { label: "https ama host allowlist dışı", endpoint: "https://evil.com/x", p256dh: "p256dh-x", auth: "auth-x" },
    { label: "geçersiz p256dh anahtarı", endpoint: "https://fcm.googleapis.com/ok", p256dh: "bad+key", auth: "auth-x" },
  ])("kural dışı satır ($label) → sendNotification çağrılmaz, satır silinir, removed 1", async ({ endpoint, p256dh, auth }) => {
    const bad: PushTarget = { ...TARGET_A, endpoint, p256dh, auth };
    vi.mocked(loadTargets).mockResolvedValue({ data: [bad], error: null });

    const res = await GET(cronRequest(`Bearer ${SECRET}`));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ sent: 0, failed: 0, removed: 1, skipped: null });
    expect(webpush.sendNotification).not.toHaveBeenCalled();
    expect(removeSubscription).toHaveBeenCalledWith(expect.anything(), TARGET_A.id);
    expect(markNotified).not.toHaveBeenCalled();
    expect(consoleWarn).toHaveBeenCalledWith("[push] invalid endpoint removed", { id: TARGET_A.id });
    // Endpoint log'a yazılmaz.
    expect(JSON.stringify(consoleWarn.mock.calls)).not.toContain(endpoint);
  });

  it("yeni ilan yok → sendNotification çağrılmaz, skipped 'nothing_new'", async () => {
    vi.mocked(countNewListings).mockResolvedValue({ count: 0, error: null });

    const res = await GET(cronRequest(`Bearer ${SECRET}`));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ sent: 0, failed: 0, removed: 0, skipped: "nothing_new" });
    expect(webpush.sendNotification).not.toHaveBeenCalled();
    expect(markNotified).not.toHaveBeenCalled();
  });

  it("abone yok → skipped 'no_subscribers'", async () => {
    vi.mocked(loadTargets).mockResolvedValue({ data: [], error: null });

    const res = await GET(cronRequest(`Bearer ${SECRET}`));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ sent: 0, failed: 0, removed: 0, skipped: "no_subscribers" });
    expect(webpush.sendNotification).not.toHaveBeenCalled();
  });

  // Sözleşme #12: DB okuma hatası → sessiz 200 değil, 500 db_failed.
  it("DB okuma hatası → 500 {error:'db_failed'}, console.error, gönderim yok", async () => {
    vi.mocked(loadTargets).mockResolvedValue({ data: null, error: { message: "network" } });

    const res = await GET(cronRequest(`Bearer ${SECRET}`));

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "db_failed" });
    expect(consoleError).toHaveBeenCalled();
    expect(webpush.sendNotification).not.toHaveBeenCalled();
  });

  it("yeni ilan sayımı DB hatası → 500 {error:'db_failed'}, gönderim yok", async () => {
    vi.mocked(countNewListings).mockResolvedValue({ count: 0, error: { message: "timeout" } });

    const res = await GET(cronRequest(`Bearer ${SECRET}`));

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "db_failed" });
    expect(webpush.sendNotification).not.toHaveBeenCalled();
  });
});
