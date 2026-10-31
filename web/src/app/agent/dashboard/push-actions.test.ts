import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createClient, createServiceRoleClient } from "@/lib/supabase/server";

import {
  deletePushSubscription,
  getPushRegistrationStatus,
  savePushSubscription,
} from "./push-actions";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
  createServiceRoleClient: vi.fn(),
}));

const ENDPOINT = "https://fcm.googleapis.com/fcm/send/abc123";
const KEYS = {
  p256dh: "BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM",
  auth: "tBHItJI5svbpez7KI4CCXg",
};

type Result = { data?: unknown; error: unknown };
type Row = { id: string; created_at: string };

// Her from("push_subscriptions") çağrısı için zincir. Terminal sonuç, zincirde
// son çağrılan yazma operasyonuna göre seçilir (upsert / delete), yoksa select.
function makeBuilder(results: { select: Result; upsert: Result; delete: Result }) {
  let terminal: Result = results.select;
  const builder: Record<string, unknown> = {};
  for (const method of ["select", "eq", "in", "order", "gt"]) {
    builder[method] = vi.fn(() => builder);
  }
  builder.upsert = vi.fn(() => {
    terminal = results.upsert;
    return builder;
  });
  builder.delete = vi.fn(() => {
    terminal = results.delete;
    return builder;
  });
  builder.then = (
    resolve: (value: Result) => unknown,
    reject: (reason: unknown) => unknown,
  ) => Promise.resolve(terminal).then(resolve, reject);
  return builder;
}

type Setup = {
  user?: { id: string } | null;
  existing?: Row[];
  upsert?: Result;
  del?: Result;
  /** Service role silme sonucu (sahiplik devri). */
  serviceDelete?: Result;
};

function setupSupabase({
  user = { id: "agent-A" },
  existing = [],
  upsert = { data: null, error: null },
  del = { data: null, error: null },
  serviceDelete = { data: null, error: null },
}: Setup = {}) {
  const builders: Record<string, unknown>[] = [];
  const from = vi.fn(() => {
    const builder = makeBuilder({
      select: { data: existing, error: null },
      upsert,
      delete: del,
    });
    builders.push(builder);
    return builder;
  });
  const supabase = {
    from,
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }),
    },
  };
  vi.mocked(createClient).mockResolvedValue(supabase as never);

  // Service role: yalnız delete().eq(...) zinciri kullanılır.
  const serviceBuilders: Record<string, unknown>[] = [];
  const serviceFrom = vi.fn(() => {
    const builder: Record<string, unknown> = {};
    builder.delete = vi.fn(() => builder);
    builder.eq = vi.fn(() => builder);
    builder.then = (resolve: (value: Result) => unknown, reject: (reason: unknown) => unknown) =>
      Promise.resolve(serviceDelete).then(resolve, reject);
    serviceBuilders.push(builder);
    return builder;
  });
  vi.mocked(createServiceRoleClient).mockReturnValue({ from: serviceFrom } as never);

  return { from, builders, serviceFrom, serviceBuilders };
}

// Verilen metodun en az bir kez çağrıldığı zinciri bulur.
function builderWith(builders: Record<string, unknown>[], method: string) {
  return builders.find(
    (b) => (b[method] as ReturnType<typeof vi.fn>).mock.calls.length > 0,
  );
}

// Test istemcisi: client argümanında agent_id gönderebilir (sözleşme dışı, yok sayılmalı).
type SaveInput = Parameters<typeof savePushSubscription>[0];

describe("savePushSubscription (AC-1, AC-S1, AC-S2, AC-S7)", () => {
  let consoleError: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleError.mockRestore();
  });

  it("oturum yok → {ok:false, error:'unauthorized'} ve DB yazımı yok (AC-S1)", async () => {
    const { from, serviceFrom } = setupSupabase({ user: null });

    const result = await savePushSubscription({ endpoint: ENDPOINT, keys: KEYS });

    expect(result).toEqual({ ok: false, error: "unauthorized" });
    expect(from).not.toHaveBeenCalled();
    expect(serviceFrom).not.toHaveBeenCalled();
  });

  it.each([
    "http://fcm.googleapis.com/x",
    "https://evil.com/x",
    "http://169.254.169.254/latest",
    "https://fcm.googleapis.com.evil.com/x",
    "javascript:alert(1)",
  ])("kötü endpoint (%s) → {ok:false, error:'invalid_endpoint'} ve DB yazımı yok (AC-S2)", async (endpoint) => {
    const { from, serviceFrom } = setupSupabase();

    const result = await savePushSubscription({ endpoint, keys: KEYS });

    expect(result).toEqual({ ok: false, error: "invalid_endpoint" });
    expect(from).not.toHaveBeenCalled();
    expect(serviceFrom).not.toHaveBeenCalled();
  });

  it("geçersiz anahtar (p256dh base64 değil) → {ok:false} ve DB yazımı yok (AC-S2)", async () => {
    const { from, serviceFrom } = setupSupabase();

    const result = await savePushSubscription({
      endpoint: ENDPOINT,
      keys: { p256dh: "bad+key/value", auth: KEYS.auth },
    });

    expect(result).toEqual({ ok: false, error: "invalid_keys" });
    expect(from).not.toHaveBeenCalled();
    expect(serviceFrom).not.toHaveBeenCalled();
  });

  it("geçerli girdi → upsert(agent_id = oturumdaki kullanıcı, onConflict endpoint) ve {ok:true} (AC-1)", async () => {
    const { builders } = setupSupabase({ user: { id: "agent-A" } });

    const result = await savePushSubscription({ endpoint: ENDPOINT, keys: KEYS });

    expect(result).toEqual({ ok: true });
    const writer = builderWith(builders, "upsert");
    expect(writer).toBeDefined();
    expect(writer!.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        agent_id: "agent-A",
        endpoint: ENDPOINT,
        p256dh: KEYS.p256dh,
        auth: KEYS.auth,
      }),
      expect.objectContaining({ onConflict: "endpoint" }),
    );
  });

  it("istemcinin gönderdiği agent_id yok sayılır (AC-S1)", async () => {
    const { builders } = setupSupabase({ user: { id: "agent-A" } });

    const input = { endpoint: ENDPOINT, keys: KEYS, agent_id: "agent-B" } as unknown as SaveInput;
    const result = await savePushSubscription(input);

    expect(result).toEqual({ ok: true });
    const writer = builderWith(builders, "upsert");
    const payload = (writer!.upsert as ReturnType<typeof vi.fn>).mock.calls[0][0] as Record<string, unknown>;
    expect(payload.agent_id).toBe("agent-A");
    expect(JSON.stringify(payload)).not.toContain("agent-B");
  });

  it("DB yazma hatası → {ok:false, error:'save_failed'} ve loglanır (AC-1, sözleşme #4)", async () => {
    setupSupabase({ upsert: { data: null, error: { message: "boom", code: "XX000" } } });

    const result = await savePushSubscription({ endpoint: ENDPOINT, keys: KEYS });

    expect(result).toEqual({ ok: false, error: "save_failed" });
    expect(consoleError).toHaveBeenCalled();
  });

  // Red-team (paylaşılan cihaz): başka agent'ın satırı varsa service role ile endpoint'e göre silinir,
  // sonra kullanıcının kendi istemcisiyle insert edilir. Silme, insert'ten ÖNCE olmalı.
  it("başka agent'ın satırı: service role delete().eq('endpoint', endpoint) → sonra kullanıcı upsert'i", async () => {
    const { from, serviceFrom, serviceBuilders, builders } = setupSupabase({ user: { id: "agent-A" } });

    const result = await savePushSubscription({ endpoint: ENDPOINT, keys: KEYS });

    expect(result).toEqual({ ok: true });
    expect(serviceFrom).toHaveBeenCalledWith("push_subscriptions");
    const releaser = serviceBuilders[0];
    expect(releaser.delete).toHaveBeenCalledTimes(1);
    expect(releaser.eq).toHaveBeenCalledTimes(1);
    expect(releaser.eq).toHaveBeenCalledWith("endpoint", ENDPOINT);

    const writer = builderWith(builders, "upsert");
    expect(writer!.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ agent_id: "agent-A", endpoint: ENDPOINT }),
      expect.objectContaining({ onConflict: "endpoint" }),
    );
    expect(serviceFrom.mock.invocationCallOrder[0]).toBeLessThan(from.mock.invocationCallOrder[0]);
  });

  it("sahiplik devri silmesi başarısız → {ok:false, error:'save_failed'}, insert yapılmaz", async () => {
    const { from, builders } = setupSupabase({
      user: { id: "agent-A" },
      serviceDelete: { data: null, error: { message: "boom", code: "XX000" } },
    });

    const result = await savePushSubscription({ endpoint: ENDPOINT, keys: KEYS });

    expect(result).toEqual({ ok: false, error: "save_failed" });
    expect(from).not.toHaveBeenCalled();
    expect(builderWith(builders, "upsert")).toBeUndefined();
  });

  it("11 cihazda en eski satır silinir (AC-S7): delete(id in [en eski]) çağrılır", async () => {
    // Liste yeniden eskiye sıralı: r0 en yeni, r10 en eski. Upsert sonrası 11 satır var.
    const existing: Row[] = Array.from({ length: 11 }, (_, i) => ({
      id: `r${i}`,
      created_at: new Date(Date.UTC(2026, 9, 30, 12, 0, 0) - i * 60_000).toISOString(),
    }));
    const { builders } = setupSupabase({ existing });

    const result = await savePushSubscription({ endpoint: ENDPOINT, keys: KEYS });

    expect(result).toEqual({ ok: true });
    const deleter = builderWith(builders, "delete");
    expect(deleter).toBeDefined();
    expect(deleter!.in).toHaveBeenCalledWith("id", ["r10"]);
  });

  it("10 cihazda silme yapılmaz (AC-S7 sınırı)", async () => {
    const existing: Row[] = Array.from({ length: 10 }, (_, i) => ({
      id: `r${i}`,
      created_at: new Date(Date.UTC(2026, 9, 30, 12, 0, 0) - i * 60_000).toISOString(),
    }));
    const { builders } = setupSupabase({ existing });

    const result = await savePushSubscription({ endpoint: ENDPOINT, keys: KEYS });

    expect(result).toEqual({ ok: true });
    expect(builderWith(builders, "delete")).toBeUndefined();
  });
});

describe("getPushRegistrationStatus (paylaşılan cihaz)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("oturum yok → {ok:false, error:'unauthorized'}", async () => {
    const { from } = setupSupabase({ user: null });

    const result = await getPushRegistrationStatus({ endpoint: ENDPOINT });

    expect(result).toEqual({ ok: false, error: "unauthorized" });
    expect(from).not.toHaveBeenCalled();
  });

  it("allowlist dışı endpoint → {ok:false, error:'invalid_endpoint'}, sorgu yok", async () => {
    const { from } = setupSupabase();

    const result = await getPushRegistrationStatus({ endpoint: "https://evil.com/x" });

    expect(result).toEqual({ ok: false, error: "invalid_endpoint" });
    expect(from).not.toHaveBeenCalled();
  });

  it("kendi satırı varsa (RLS sonucu 1 satır) → {ok:true, mine:true}", async () => {
    const { builders } = setupSupabase({ existing: [{ id: "r0", created_at: "" }] });

    const result = await getPushRegistrationStatus({ endpoint: ENDPOINT });

    expect(result).toEqual({ ok: true, mine: true });
    const reader = builderWith(builders, "select");
    expect(reader!.eq).toHaveBeenCalledWith("endpoint", ENDPOINT);
  });

  it("satır yoksa (başka agent'ın satırı RLS ile görünmez) → {ok:true, mine:false}", async () => {
    setupSupabase({ existing: [] });

    const result = await getPushRegistrationStatus({ endpoint: ENDPOINT });

    expect(result).toEqual({ ok: true, mine: false });
  });
});

describe("deletePushSubscription (AC-4, AC-S1)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("oturum yok → {ok:false, error:'unauthorized'} ve silme yok", async () => {
    const { builders } = setupSupabase({ user: null });

    const result = await deletePushSubscription({ endpoint: ENDPOINT });

    expect(result).toEqual({ ok: false, error: "unauthorized" });
    expect(builders).toHaveLength(0);
  });

  it("endpoint + agent_id filtresiyle siler ve {ok:true} döner (AC-4)", async () => {
    const { builders } = setupSupabase({ user: { id: "agent-A" } });

    const result = await deletePushSubscription({ endpoint: ENDPOINT });

    expect(result).toEqual({ ok: true });
    const deleter = builderWith(builders, "delete");
    expect(deleter).toBeDefined();
    expect(deleter!.eq).toHaveBeenCalledWith("endpoint", ENDPOINT);
    expect(deleter!.eq).toHaveBeenCalledWith("agent_id", "agent-A");
  });
});
