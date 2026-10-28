import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { revalidatePath } from "next/cache";

import {
  confirmDelivery,
  getAssetDownloadUrl,
  rejectOrder,
  requestDeliveryUploadUrl,
  setQuote,
} from "./actions";

/**
 * Admin video siparişi server action testleri (AC-7..AC-9, AC-S4, AC-S6 + davranış sözleşmesi).
 *
 * Supabase istemcisi bellek içi bir sahte ile değiştirilir: tablolar Map/dizi,
 * sorgu zinciri (select/eq/insert/update/delete/maybeSingle/single) gerçek filtreleri uygular.
 * Koşullu UPDATE yarışı `beforeExec` kancasıyla simüle edilir.
 */

type Row = Record<string, unknown>;
type Q = {
  select: (cols?: string, opts?: { count?: string; head?: boolean }) => Q;
  insert: (payload: Row | Row[]) => Q;
  update: (payload: Row) => Q;
  delete: () => Q;
  eq: (col: string, val: unknown) => Q;
  single: () => Q;
  maybeSingle: () => Q;
  then: (onOk: (v: Result) => unknown, onErr?: (e: unknown) => unknown) => Promise<unknown>;
};
type Result = { data: unknown; error: { code?: string; message: string } | null };

const h = vi.hoisted(() => {
  const db: Record<string, Row[]> = {};
  const objects = new Map<string, { size: number }>();
  const state: {
    user: { id: string } | null;
    beforeExec: ((table: string, op: string) => void) | null;
  } = { user: null, beforeExec: null };
  const calls = {
    createSignedUploadUrl: vi.fn(),
    createSignedUrl: vi.fn(),
    remove: vi.fn(),
  };

  function query(table: string): Q {
    let op: "select" | "insert" | "update" | "delete" = "select";
    let payload: Row | Row[] | null = null;
    let single = false;
    const filters: Array<[string, unknown]> = [];
    const rows = (): Row[] => (db[table] ??= []);
    const matches = (row: Row) => filters.every(([col, val]) => row[col] === val);

    const exec = (): Result => {
      state.beforeExec?.(table, op);
      if (op === "insert") {
        const list = Array.isArray(payload) ? payload : [payload as Row];
        const inserted: Row[] = [];
        for (const item of list) {
          if (table === "video_order_assets" && rows().some((r) => r.storage_path === item.storage_path)) {
            return { data: null, error: { code: "23505", message: "duplicate key" } };
          }
          if (table === "property_videos" && item.order_id && rows().some((r) => r.order_id === item.order_id)) {
            return { data: null, error: { code: "23505", message: "duplicate key value violates unique constraint" } };
          }
          const row: Row = { id: randomUUID(), ...item };
          rows().push(row);
          inserted.push(row);
        }
        return { data: single ? inserted[0] : inserted, error: null };
      }
      if (op === "update") {
        const hit = rows().filter(matches);
        hit.forEach((r) => Object.assign(r, payload));
        return { data: hit.map((r) => ({ id: r.id })), error: null };
      }
      if (op === "delete") {
        db[table] = rows().filter((r) => !matches(r));
        return { data: null, error: null };
      }
      const hit = rows().filter(matches);
      if (single) return { data: hit[0] ?? null, error: null };
      return { data: hit, error: null };
    };

    const api: Q = {
      select() {
        return api;
      },
      insert(p) {
        op = "insert";
        payload = p;
        return api;
      },
      update(p) {
        op = "update";
        payload = p;
        return api;
      },
      delete() {
        op = "delete";
        return api;
      },
      eq(col, val) {
        filters.push([col, val]);
        return api;
      },
      single() {
        single = true;
        return api;
      },
      maybeSingle() {
        single = true;
        return api;
      },
      then(onOk, onErr) {
        return Promise.resolve(exec()).then(onOk, onErr);
      },
    };
    return api;
  }

  const storage = {
    from(bucket: string) {
      return {
        createSignedUploadUrl: async (path: string) => {
          calls.createSignedUploadUrl(bucket, path);
          return {
            data: { signedUrl: `https://storage.test/upload/${bucket}/${path}`, token: `token-${path}`, path },
            error: null,
          };
        },
        createSignedUrl: async (path: string, ttl: number) => {
          calls.createSignedUrl(bucket, path, ttl);
          return { data: { signedUrl: `https://storage.test/read/${path}?ttl=${ttl}` }, error: null };
        },
        list: async (folder: string) => {
          const prefix = `${bucket}/${folder}/`;
          const data = [...objects.entries()]
            .filter(([key]) => key.startsWith(prefix) && !key.slice(prefix.length).includes("/"))
            .map(([key, value]) => ({ name: key.slice(prefix.length), metadata: { size: value.size } }));
          return { data, error: null };
        },
        remove: async (paths: string[]) => {
          calls.remove(bucket, paths);
          for (const p of paths) objects.delete(`${bucket}/${p}`);
          return { data: [], error: null };
        },
      };
    },
  };

  const client = {
    auth: { getUser: async () => ({ data: { user: state.user }, error: null }) },
    from: (table: string) => query(table),
    storage,
  };

  return { db, objects, state, calls, client };
});

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => h.client),
  createServiceRoleClient: vi.fn(() => h.client),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn((to: string) => {
    throw new Error(`NEXT_REDIRECT:${to}`);
  }),
}));

const ADMIN = "11111111-1111-4111-8111-111111111111";
const NON_ADMIN = "22222222-2222-4222-8222-222222222222";
const ASSET_BUCKET = "video-order-assets";
const DELIVERED_BUCKET = "property-videos";
const MB = 1024 * 1024;

function rowsOf(table: string): Row[] {
  return h.db[table] ?? [];
}

function resetDb() {
  for (const key of Object.keys(h.db)) delete h.db[key];
  h.objects.clear();
  h.state.beforeExec = null;
  h.state.user = { id: ADMIN };
  h.db.agents = [
    { id: ADMIN, is_admin: true },
    { id: NON_ADMIN, is_admin: false },
  ];
}

function seedOrder(opts: { serviceCode?: string; status?: string; price?: number | null } = {}) {
  const orderId = randomUUID();
  const propertyId = randomUUID();
  h.db.properties = [
    ...rowsOf("properties"),
    { id: propertyId, agent_id: NON_ADMIN, title: "Test mülk", address: "Test adres" },
  ];
  h.db.video_orders = [
    ...rowsOf("video_orders"),
    {
      id: orderId,
      agent_id: NON_ADMIN,
      property_id: propertyId,
      service_code: opts.serviceCode ?? "photos",
      status: opts.status ?? "in_progress",
      price_minor_unit: opts.price ?? null,
      currency: "TRY",
      rejection_reason: null,
      delivered_at: null,
    },
  ];
  return { orderId, propertyId };
}

function orderRow(id: string): Row | undefined {
  return rowsOf("video_orders").find((r) => r.id === id);
}

function putObject(bucket: string, path: string, size: number) {
  h.objects.set(`${bucket}/${path}`, { size });
}

function seedAsset(orderId: string, storagePath: string): string {
  const id = randomUUID();
  h.db.video_order_assets = [
    ...rowsOf("video_order_assets"),
    { id, order_id: orderId, kind: "raw_video", storage_path: storagePath, size_bytes: 1024 },
  ];
  putObject(ASSET_BUCKET, storagePath, 1024);
  return id;
}

function seedDeliveryFile(propertyId: string, orderId: string, ext = "mp4"): string {
  const path = `${propertyId}/${orderId}/${randomUUID()}.${ext}`;
  putObject(DELIVERED_BUCKET, path, 1024);
  return path;
}

// Yarış simülasyonu: video_orders üzerindeki ilk UPDATE'ten hemen önce durumu değiştirir.
function flipOrderStatusBeforeUpdate(orderId: string, to: string) {
  h.state.beforeExec = (table, op) => {
    if (table === "video_orders" && op === "update") {
      orderRow(orderId)!.status = to;
      h.state.beforeExec = null;
    }
  };
}

const videoFile = (name = "teslim.mp4", size = 10 * MB) => ({ name, type: "video/mp4", size });

beforeEach(() => {
  vi.clearAllMocks();
  resetDb();
});

// ---------------------------------------------------------------------------
// Oturum ve yetki
// ---------------------------------------------------------------------------
describe("oturum — oturumsuz çağrı /login'e yönlendirir", () => {
  it.each([
    ["setQuote", () => setQuote(randomUUID(), "1500")],
    ["rejectOrder", () => rejectOrder(randomUUID(), "Uygun değil")],
    ["getAssetDownloadUrl", () => getAssetDownloadUrl(randomUUID(), randomUUID())],
    ["requestDeliveryUploadUrl", () => requestDeliveryUploadUrl(randomUUID(), videoFile())],
    ["confirmDelivery", () => confirmDelivery(randomUUID(), `${randomUUID()}/${randomUUID()}/x.mp4`)],
  ])("%s", async (_name, call) => {
    const { orderId } = seedOrder({ serviceCode: "onsite", status: "quote_pending" });
    h.state.user = null;
    await expect(call()).rejects.toThrow("NEXT_REDIRECT:/login");
    expect(orderRow(orderId)?.status).toBe("quote_pending");
    expect(h.calls.createSignedUploadUrl).not.toHaveBeenCalled();
  });
});

describe("yetki — admin olmayan kullanıcı NOT_FOUND alır", () => {
  it("setQuote ve confirmDelivery değişiklik yapmaz", async () => {
    const quote = seedOrder({ serviceCode: "onsite", status: "quote_pending" });
    const delivery = seedOrder({ status: "in_progress" });
    const path = seedDeliveryFile(delivery.propertyId, delivery.orderId);
    h.state.user = { id: NON_ADMIN };

    await expect(setQuote(quote.orderId, "1500")).resolves.toEqual({
      ok: false,
      error: "NOT_FOUND",
      message: expect.any(String),
    });
    await expect(confirmDelivery(delivery.orderId, path)).resolves.toMatchObject({
      ok: false,
      error: "NOT_FOUND",
    });

    expect(orderRow(quote.orderId)?.status).toBe("quote_pending");
    expect(orderRow(delivery.orderId)?.status).toBe("in_progress");
    expect(rowsOf("property_videos")).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// setQuote (AC-8 yerinde çekim fiyatı, AC-S2, AC-S4)
// ---------------------------------------------------------------------------
describe("setQuote", () => {
  it.each([
    ["1.500,50", 150050],
    ["2250", 225000],
    ["2250.5", 225050],
  ])("fiyat '%s' kuruşa çevrilir (%i) ve ödeme bekleniyor olur", async (input, expected) => {
    const { orderId } = seedOrder({ serviceCode: "onsite", status: "quote_pending" });

    const result = await setQuote(orderId, input);

    expect(result).toEqual({ ok: true });
    expect(orderRow(orderId)).toMatchObject({ status: "awaiting_payment", price_minor_unit: expected });
  });

  it.each(["0", "0,50", "100001", "abc", "", "12,345", "-5", "NaN"])(
    "geçersiz fiyat '%s' INVALID_INPUT ve sipariş değişmez",
    async (input) => {
      const { orderId } = seedOrder({ serviceCode: "onsite", status: "quote_pending" });

      const result = await setQuote(orderId, input);

      expect(result).toMatchObject({ ok: false, error: "INVALID_INPUT" });
      expect(orderRow(orderId)).toMatchObject({ status: "quote_pending", price_minor_unit: null });
    },
  );

  it("onsite olmayan sipariş INVALID_STATE alır", async () => {
    const { orderId } = seedOrder({ serviceCode: "photos", status: "quote_pending" });

    const result = await setQuote(orderId, "1500");

    expect(result).toMatchObject({ ok: false, error: "INVALID_STATE" });
    expect(orderRow(orderId)?.price_minor_unit).toBeNull();
  });

  it("quote_pending değilse INVALID_STATE alır", async () => {
    const { orderId } = seedOrder({ serviceCode: "onsite", status: "awaiting_payment", price: 150000 });

    const result = await setQuote(orderId, "2000");

    expect(result).toMatchObject({ ok: false, error: "INVALID_STATE" });
    expect(orderRow(orderId)?.price_minor_unit).toBe(150000);
  });

  it("koşullu UPDATE 0 satır etkilerse INVALID_STATE (yarış)", async () => {
    const { orderId } = seedOrder({ serviceCode: "onsite", status: "quote_pending" });
    flipOrderStatusBeforeUpdate(orderId, "canceled");

    const result = await setQuote(orderId, "1500");

    expect(result).toMatchObject({ ok: false, error: "INVALID_STATE" });
    expect(orderRow(orderId)).toMatchObject({ status: "canceled", price_minor_unit: null });
  });

  it("bilinmeyen sipariş NOT_FOUND", async () => {
    const result = await setQuote(randomUUID(), "1500");
    expect(result).toMatchObject({ ok: false, error: "NOT_FOUND" });
  });

  it("başarıda admin listesi ve detay yolu yeniden doğrulanır", async () => {
    const { orderId } = seedOrder({ serviceCode: "onsite", status: "quote_pending" });

    await setQuote(orderId, "1500");

    expect(revalidatePath).toHaveBeenCalledWith("/admin/videos");
    expect(revalidatePath).toHaveBeenCalledWith(`/admin/videos/${orderId}`);
  });
});

// ---------------------------------------------------------------------------
// rejectOrder (AC-8 "reddet (gerekçe)")
// ---------------------------------------------------------------------------
describe("rejectOrder", () => {
  it.each(["abcd", "   ab   ", "x".repeat(501)])("kısa/uzun gerekçe '%s' INVALID_INPUT", async (reason) => {
    const { orderId } = seedOrder({ serviceCode: "onsite", status: "quote_pending" });

    const result = await rejectOrder(orderId, reason);

    expect(result).toMatchObject({ ok: false, error: "INVALID_INPUT" });
    expect(orderRow(orderId)?.status).toBe("quote_pending");
  });

  it("geçerli gerekçe siparişi iptal eder ve gerekçeyi kırpılmış olarak yazar", async () => {
    const { orderId } = seedOrder({ serviceCode: "onsite", status: "quote_pending" });

    const result = await rejectOrder(orderId, "  Adres bölgemizin dışında  ");

    expect(result).toEqual({ ok: true });
    expect(orderRow(orderId)).toMatchObject({
      status: "canceled",
      rejection_reason: "Adres bölgemizin dışında",
    });
  });

  it("quote_pending dışındaki sipariş INVALID_STATE alır", async () => {
    const { orderId } = seedOrder({ status: "in_progress" });

    const result = await rejectOrder(orderId, "Uygun değil");

    expect(result).toMatchObject({ ok: false, error: "INVALID_STATE" });
    expect(orderRow(orderId)?.status).toBe("in_progress");
  });
});

// ---------------------------------------------------------------------------
// getAssetDownloadUrl (AC-8 dosya indirme, AC-S6 kısa ömürlü URL)
// ---------------------------------------------------------------------------
describe("getAssetDownloadUrl", () => {
  it("kendi siparişinin asset'i için 600 sn imzalı URL döner", async () => {
    const { orderId } = seedOrder();
    const storagePath = `${randomUUID()}/${orderId}/${randomUUID()}.mp4`;
    const assetId = seedAsset(orderId, storagePath);

    const result = await getAssetDownloadUrl(orderId, assetId);

    expect(result).toEqual({ ok: true, url: expect.stringContaining("ttl=600") });
    expect(h.calls.createSignedUrl).toHaveBeenCalledWith(ASSET_BUCKET, storagePath, 600);
  });

  it("başka siparişin asset'i NOT_FOUND alır (IDOR)", async () => {
    const orderA = seedOrder();
    const orderB = seedOrder();
    const assetOfA = seedAsset(orderA.orderId, `x/${orderA.orderId}/${randomUUID()}.mp4`);

    const result = await getAssetDownloadUrl(orderB.orderId, assetOfA);

    expect(result).toMatchObject({ ok: false, error: "NOT_FOUND" });
    expect(h.calls.createSignedUrl).not.toHaveBeenCalled();
  });

  it("geçersiz asset id INVALID_INPUT", async () => {
    const { orderId } = seedOrder();
    const result = await getAssetDownloadUrl(orderId, "not-a-uuid");
    expect(result).toMatchObject({ ok: false, error: "INVALID_INPUT" });
  });
});

// ---------------------------------------------------------------------------
// requestDeliveryUploadUrl (AC-8 teslim yükleme, AC-S3)
// ---------------------------------------------------------------------------
describe("requestDeliveryUploadUrl", () => {
  it("in_progress siparişe mülk/sipariş yolu ile imzalı yükleme URL'si üretir", async () => {
    const { orderId, propertyId } = seedOrder({ status: "in_progress" });

    const result = await requestDeliveryUploadUrl(orderId, videoFile("final.MP4"));

    expect(result).toMatchObject({
      ok: true,
      path: expect.stringMatching(
        new RegExp(`^${propertyId}/${orderId}/[0-9a-f-]{36}\\.mp4$`),
      ),
      signedUrl: expect.stringContaining("/upload/property-videos/"),
    });
    expect(h.calls.createSignedUploadUrl).toHaveBeenCalledWith(DELIVERED_BUCKET, (result as { path: string }).path);
  });

  it.each([
    ["awaiting_payment"],
    ["delivered"],
    ["quote_pending"],
  ])("'%s' durumunda INVALID_STATE, URL üretilmez", async (status) => {
    const { orderId } = seedOrder({ status });

    const result = await requestDeliveryUploadUrl(orderId, videoFile());

    expect(result).toMatchObject({ ok: false, error: "INVALID_STATE" });
    expect(h.calls.createSignedUploadUrl).not.toHaveBeenCalled();
  });

  it("desteklenmeyen tür UNSUPPORTED_FILE", async () => {
    const { orderId } = seedOrder({ status: "in_progress" });

    const pdf = await requestDeliveryUploadUrl(orderId, { name: "x.pdf", type: "application/pdf", size: 1024 });
    const mismatch = await requestDeliveryUploadUrl(orderId, { name: "x.mp4", type: "image/jpeg", size: 1024 });

    expect(pdf).toMatchObject({ ok: false, error: "UNSUPPORTED_FILE" });
    expect(mismatch).toMatchObject({ ok: false, error: "UNSUPPORTED_FILE" });
    expect(h.calls.createSignedUploadUrl).not.toHaveBeenCalled();
  });

  it("50 MB üstü dosya FILE_TOO_LARGE", async () => {
    const { orderId } = seedOrder({ status: "in_progress" });

    const result = await requestDeliveryUploadUrl(orderId, videoFile("big.mp4", 50 * MB + 1));

    expect(result).toMatchObject({ ok: false, error: "FILE_TOO_LARGE" });
  });
});

// ---------------------------------------------------------------------------
// confirmDelivery (AC-8 teslim → delivered, AC-S1/AC-S3 yol kontrolü)
// ---------------------------------------------------------------------------
describe("confirmDelivery", () => {
  it("başarılı teslim: property_videos yazılır, sipariş delivered olur, sayfalar yenilenir", async () => {
    const { orderId, propertyId } = seedOrder({ status: "in_progress" });
    const path = seedDeliveryFile(propertyId, orderId);

    const result = await confirmDelivery(orderId, path);

    expect(result).toEqual({ ok: true });
    expect(rowsOf("property_videos")).toEqual([
      expect.objectContaining({
        property_id: propertyId,
        order_id: orderId,
        storage_path: path,
        status: "published",
        published_at: expect.any(String),
      }),
    ]);
    expect(orderRow(orderId)).toMatchObject({ status: "delivered", delivered_at: expect.any(String) });
    expect(revalidatePath).toHaveBeenCalledWith("/admin/videos");
    expect(revalidatePath).toHaveBeenCalledWith(`/admin/videos/${orderId}`);
  });

  it("yanlış mülk prefix'i INVALID_INPUT, hiçbir şey yazılmaz", async () => {
    const { orderId } = seedOrder({ status: "in_progress" });
    const foreign = seedOrder({ status: "in_progress" });
    const path = seedDeliveryFile(foreign.propertyId, orderId);

    const result = await confirmDelivery(orderId, path);

    expect(result).toMatchObject({ ok: false, error: "INVALID_INPUT" });
    expect(rowsOf("property_videos")).toHaveLength(0);
    expect(orderRow(orderId)?.status).toBe("in_progress");
  });

  it("uuid olmayan dosya adı INVALID_INPUT", async () => {
    const { orderId, propertyId } = seedOrder({ status: "in_progress" });
    const path = `${propertyId}/${orderId}/salon.mp4`;
    putObject(DELIVERED_BUCKET, path, 1024);

    const result = await confirmDelivery(orderId, path);

    expect(result).toMatchObject({ ok: false, error: "INVALID_INPUT" });
    expect(rowsOf("property_videos")).toHaveLength(0);
  });

  it("izinsiz uzantı UNSUPPORTED_FILE", async () => {
    const { orderId, propertyId } = seedOrder({ status: "in_progress" });
    const path = seedDeliveryFile(propertyId, orderId, "pdf");

    const result = await confirmDelivery(orderId, path);

    expect(result).toMatchObject({ ok: false, error: "UNSUPPORTED_FILE" });
    expect(rowsOf("property_videos")).toHaveLength(0);
  });

  it("Storage'da olmayan dosya INVALID_INPUT", async () => {
    const { orderId, propertyId } = seedOrder({ status: "in_progress" });
    const path = `${propertyId}/${orderId}/${randomUUID()}.mp4`;

    const result = await confirmDelivery(orderId, path);

    expect(result).toMatchObject({ ok: false, error: "INVALID_INPUT" });
    expect(rowsOf("property_videos")).toHaveLength(0);
  });

  it("in_progress olmayan sipariş INVALID_STATE alır", async () => {
    const { orderId, propertyId } = seedOrder({ status: "awaiting_payment" });
    const path = seedDeliveryFile(propertyId, orderId);

    const result = await confirmDelivery(orderId, path);

    expect(result).toMatchObject({ ok: false, error: "INVALID_STATE" });
    expect(rowsOf("property_videos")).toHaveLength(0);
    expect(orderRow(orderId)?.status).toBe("awaiting_payment");
  });

  it("koşullu sipariş UPDATE 0 satır etkilerse eklenen property_videos satırı silinir ve INVALID_STATE", async () => {
    const { orderId, propertyId } = seedOrder({ status: "in_progress" });
    const path = seedDeliveryFile(propertyId, orderId);
    flipOrderStatusBeforeUpdate(orderId, "canceled");

    const result = await confirmDelivery(orderId, path);

    expect(result).toMatchObject({ ok: false, error: "INVALID_STATE" });
    expect(rowsOf("property_videos")).toHaveLength(0);
    expect(orderRow(orderId)?.status).toBe("canceled");
    expect(h.objects.has(`${DELIVERED_BUCKET}/${path}`)).toBe(false);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("sipariş başına ikinci teslim (unique 23505) INVALID_STATE, yüklenen dosya temizlenir", async () => {
    const { orderId, propertyId } = seedOrder({ status: "in_progress" });
    h.db.property_videos = [
      { id: randomUUID(), property_id: propertyId, order_id: orderId, storage_path: "old.mp4", status: "published" },
    ];
    const path = seedDeliveryFile(propertyId, orderId);

    const result = await confirmDelivery(orderId, path);

    expect(result).toMatchObject({ ok: false, error: "INVALID_STATE" });
    expect(rowsOf("property_videos")).toHaveLength(1);
    expect(orderRow(orderId)?.status).toBe("in_progress");
    expect(h.objects.has(`${DELIVERED_BUCKET}/${path}`)).toBe(false);
  });
});
