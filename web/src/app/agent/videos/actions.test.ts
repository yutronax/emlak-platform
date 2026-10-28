import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  MAX_PHOTO_BYTES,
  MAX_PHOTOS,
  MAX_RAW_VIDEOS,
} from "@/lib/video-orders/limits";

import {
  type CreateVideoOrderInput,
  confirmUpload,
  createVideoOrder,
  getDeliveredVideoUrl,
  removeAsset,
  requestUploadUrl,
  submitVideoOrder,
} from "./actions";

/**
 * Agent video siparişi server action testleri (AC-S1, AC-S2, AC-S3, AC-S4 + davranış sözleşmesi).
 *
 * Supabase istemcisi bellek içi bir sahte ile değiştirilir: tablolar Map/dizi,
 * sorgu zinciri (select/eq/insert/update/delete/maybeSingle/single/count) gerçek filtreleri uygular.
 * RLS simüle edilmez; sahiplik kontrolünün KODDA yapıldığı bu testlerle doğrulanır.
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
type Result = { data: unknown; error: { code?: string; message: string } | null; count?: number };

const h = vi.hoisted(() => {
  const db: Record<string, Row[]> = {};
  const objects = new Map<string, { size: number }>();
  const state: {
    user: { id: string } | null;
    injectError: { table: string; op: string; message: string } | null;
  } = { user: null, injectError: null };
  const calls = {
    createSignedUploadUrl: vi.fn(),
    createSignedUrl: vi.fn(),
    remove: vi.fn(),
  };

  function query(table: string): Q {
    let op: "select" | "insert" | "update" | "delete" = "select";
    let payload: Row | Row[] | null = null;
    let single = false;
    let headOnly = false;
    let countExact = false;
    const filters: Array<[string, unknown]> = [];
    const rows = (): Row[] => (db[table] ??= []);
    const matches = (row: Row) => filters.every(([col, val]) => row[col] === val);

    const exec = (): Result => {
      const injected = state.injectError;
      if (injected && injected.table === table && injected.op === op) {
        return { data: null, error: { message: injected.message } };
      }
      if (op === "insert") {
        const list = Array.isArray(payload) ? payload : [payload as Row];
        const inserted: Row[] = [];
        for (const item of list) {
          if (table === "video_order_assets" && rows().some((r) => r.storage_path === item.storage_path)) {
            return { data: null, error: { code: "23505", message: "duplicate key" } };
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
      if (countExact && headOnly) return { data: null, error: null, count: hit.length };
      if (single) return { data: hit[0] ?? null, error: null };
      return { data: hit, error: null };
    };

    const api: Q = {
      select(_cols, opts) {
        if (op === "select") {
          headOnly = Boolean(opts?.head);
          countExact = opts?.count === "exact";
        }
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

const AGENT = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const BUCKET = "video-order-assets";

function rowsOf(table: string): Row[] {
  return h.db[table] ?? [];
}

function resetDb() {
  for (const key of Object.keys(h.db)) delete h.db[key];
  h.objects.clear();
  h.state.injectError = null;
  h.db.video_services = [
    { code: "photos", name: "Fotoğraflardan video", price_minor_unit: 75000, currency: "TRY" },
    { code: "raw_video", name: "Kendi videonuzdan", price_minor_unit: 75000, currency: "TRY" },
    { code: "onsite", name: "Yerinde çekim", price_minor_unit: null, currency: "TRY" },
  ];
  h.state.user = { id: AGENT };
}

function seedOrder(opts: { agentId?: string; serviceCode?: string; status?: string } = {}): string {
  const id = randomUUID();
  const agentId = opts.agentId ?? AGENT;
  const propertyId = randomUUID();
  h.db.properties = [...rowsOf("properties"), { id: propertyId, agent_id: agentId, title: "Test mülk", address: "Test adres" }];
  h.db.video_orders = [
    ...rowsOf("video_orders"),
    {
      id,
      agent_id: agentId,
      property_id: propertyId,
      service_code: opts.serviceCode ?? "photos",
      status: opts.status ?? "draft",
      price_minor_unit: 75000,
      currency: "TRY",
    },
  ];
  return id;
}

function orderRow(id: string): Row | undefined {
  return rowsOf("video_orders").find((r) => r.id === id);
}

function putObject(path: string, size: number) {
  h.objects.set(`${BUCKET}/${path}`, { size });
}

function seedAsset(orderId: string, kind: "photo" | "raw_video", agentId = AGENT): string {
  const id = randomUUID();
  const ext = kind === "photo" ? "jpg" : "mp4";
  const path = `${agentId}/${orderId}/${id}.${ext}`;
  h.db.video_order_assets = [
    ...rowsOf("video_order_assets"),
    { id, order_id: orderId, kind, storage_path: path, size_bytes: 1024 },
  ];
  putObject(path, 1024);
  return id;
}

function assetsOf(orderId: string): Row[] {
  return rowsOf("video_order_assets").filter((r) => r.order_id === orderId);
}

function pathFor(orderId: string, ext = "jpg", agentId = AGENT): string {
  return `${agentId}/${orderId}/${randomUUID()}.${ext}`;
}

const validInput: CreateVideoOrderInput = {
  serviceCode: "photos",
  title: "Kadıköy 2+1 daire",
  address: "Moda Caddesi No: 5, Kadıköy",
};

const photoFile = (name = "salon.jpg", size = 1024) => ({ name, type: "image/jpeg", size });
const videoFile = (name = "tanitim.mp4", size = 1024) => ({ name, type: "video/mp4", size });

beforeEach(() => {
  vi.clearAllMocks();
  resetDb();
});

// ---------------------------------------------------------------------------
// Oturum
// ---------------------------------------------------------------------------
describe("oturum — oturumsuz çağrı /login'e yönlendirir", () => {
  it.each([
    ["createVideoOrder", () => createVideoOrder(validInput)],
    ["requestUploadUrl", () => requestUploadUrl(randomUUID(), photoFile())],
    ["confirmUpload", () => confirmUpload(randomUUID(), `${AGENT}/x/y.jpg`, 1)],
    ["removeAsset", () => removeAsset(randomUUID(), randomUUID())],
    ["submitVideoOrder", () => submitVideoOrder(randomUUID())],
    ["getDeliveredVideoUrl", () => getDeliveredVideoUrl(randomUUID())],
  ])("%s", async (_name, call) => {
    h.state.user = null;
    await expect(call()).rejects.toThrow("NEXT_REDIRECT:/login");
    expect(h.calls.createSignedUploadUrl).not.toHaveBeenCalled();
    expect(rowsOf("video_orders")).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// createVideoOrder
// ---------------------------------------------------------------------------
describe("createVideoOrder", () => {
  it("fotoğraf siparişi draft olarak yaratılır, property de yazılır", async () => {
    const result = await createVideoOrder(validInput);

    expect(result).toEqual({ ok: true, orderId: expect.any(String), status: "draft" });
    if (!result.ok) throw new Error("beklenmeyen hata");
    const order = orderRow(result.orderId);
    expect(order).toMatchObject({ agent_id: AGENT, service_code: "photos", status: "draft" });
    expect(rowsOf("properties")).toContainEqual(
      expect.objectContaining({ agent_id: AGENT, title: "Kadıköy 2+1 daire" }),
    );
  });

  it("AC-S2: istemciden gelen fiyat yok sayılır, DB fiyatı kullanılır", async () => {
    h.db.video_services = rowsOf("video_services").map((s) =>
      s.code === "photos" ? { ...s, price_minor_unit: 88800 } : s,
    );
    const tampered = {
      ...validInput,
      priceMinorUnit: 1,
      price_minor_unit: 1,
    } as unknown as CreateVideoOrderInput;

    const result = await createVideoOrder(tampered);

    if (!result.ok) throw new Error("beklenmeyen hata");
    expect(orderRow(result.orderId)?.price_minor_unit).toBe(88800);
  });

  it("yerinde çekim: quote_pending, fiyat null, zaman notu saklanır", async () => {
    const result = await createVideoOrder({
      serviceCode: "onsite",
      title: "Beşiktaş stüdyo",
      address: "Akaretler Sırası 12, Beşiktaş",
      onsitePreferredTime: "Hafta içi öğleden sonra",
    });

    if (!result.ok) throw new Error("beklenmeyen hata");
    expect(result.status).toBe("quote_pending");
    expect(orderRow(result.orderId)).toMatchObject({
      status: "quote_pending",
      price_minor_unit: null,
      onsite_preferred_time: "Hafta içi öğleden sonra",
    });
  });

  it("yerinde çekimde uygun zaman notu boşsa INVALID_INPUT, hiçbir şey yazılmaz", async () => {
    const result = await createVideoOrder({
      serviceCode: "onsite",
      title: "Beşiktaş stüdyo",
      address: "Akaretler Sırası 12, Beşiktaş",
    });

    expect(result).toMatchObject({ ok: false, error: "INVALID_INPUT" });
    expect(rowsOf("video_orders")).toHaveLength(0);
    expect(rowsOf("properties")).toHaveLength(0);
  });

  it("bilinmeyen hizmet kodu ve kısa başlık INVALID_INPUT döner", async () => {
    await expect(
      createVideoOrder({ ...validInput, serviceCode: "drone" as unknown as "photos" }),
    ).resolves.toMatchObject({ ok: false, error: "INVALID_INPUT" });
    await expect(createVideoOrder({ ...validInput, title: "ab" })).resolves.toMatchObject({
      ok: false,
      error: "INVALID_INPUT",
    });
    expect(rowsOf("video_orders")).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// AC-S1 — başkasının siparişi: NOT_FOUND, hiçbir yan etki yok
// ---------------------------------------------------------------------------
describe("AC-S1 — başkasının siparişi NOT_FOUND döner", () => {
  let foreign: string;

  beforeEach(() => {
    foreign = seedOrder({ agentId: OTHER, status: "draft" });
  });

  it("requestUploadUrl: Storage'a imzalı URL üretilmez", async () => {
    const result = await requestUploadUrl(foreign, photoFile());

    expect(result).toMatchObject({ ok: false, error: "NOT_FOUND" });
    expect(h.calls.createSignedUploadUrl).not.toHaveBeenCalled();
  });

  it("confirmUpload: asset satırı yazılmaz", async () => {
    const path = `${AGENT}/${foreign}/${randomUUID()}.jpg`;
    putObject(path, 1024);

    const result = await confirmUpload(foreign, path, 1024);

    expect(result).toMatchObject({ ok: false, error: "NOT_FOUND" });
    expect(assetsOf(foreign)).toHaveLength(0);
  });

  it("removeAsset: dosya ve satır silinmez", async () => {
    const assetId = seedAsset(foreign, "photo", OTHER);

    const result = await removeAsset(foreign, assetId);

    expect(result).toMatchObject({ ok: false, error: "NOT_FOUND" });
    expect(assetsOf(foreign)).toHaveLength(1);
    expect(h.calls.remove).not.toHaveBeenCalled();
  });

  it("submitVideoOrder: sipariş durumu değişmez", async () => {
    const result = await submitVideoOrder(foreign);

    expect(result).toMatchObject({ ok: false, error: "NOT_FOUND" });
    expect(orderRow(foreign)?.status).toBe("draft");
  });

  it("getDeliveredVideoUrl: teslim videosu için imzalı URL üretilmez", async () => {
    const delivered = seedOrder({ agentId: OTHER, status: "delivered" });
    h.db.property_videos = [{ id: randomUUID(), order_id: delivered, storage_path: "p/v.mp4", status: "published" }];

    const result = await getDeliveredVideoUrl(delivered);

    expect(result).toMatchObject({ ok: false, error: "NOT_FOUND" });
    expect(h.calls.createSignedUrl).not.toHaveBeenCalled();
  });

  it("var olmayan ve başkasına ait sipariş aynı yanıtı verir (varlık sızmaz)", async () => {
    const missing = await requestUploadUrl(randomUUID(), photoFile());
    const notOwned = await requestUploadUrl(foreign, photoFile());

    expect(notOwned).toEqual(missing);
  });
});

// ---------------------------------------------------------------------------
// requestUploadUrl — AC-S3
// ---------------------------------------------------------------------------
describe("requestUploadUrl — AC-S3 (yol, MIME/uzantı, boyut, sayı, durum)", () => {
  it("yol sunucuda üretilir: `${agentId}/${orderId}/<uuid>.<ext>`, orijinal dosya adı yola girmez", async () => {
    const orderId = seedOrder();

    const result = await requestUploadUrl(orderId, photoFile("Salon Fotoğrafı.JPG"));

    if (!result.ok) throw new Error("beklenmeyen hata");
    expect(result.path).toMatch(
      new RegExp(`^${AGENT}/${orderId}/[0-9a-f-]{36}\\.jpg$`),
    );
    expect(result.path).not.toContain("Salon");
    expect(result.assetId).toBe(result.path.split("/")[2].split(".")[0]);
    expect(result.signedUrl).toContain(result.path);
    expect(h.calls.createSignedUploadUrl).toHaveBeenCalledWith(BUCKET, result.path);
  });

  it("dosya adındaki path manipülasyonu yola girmez", async () => {
    const orderId = seedOrder();

    const result = await requestUploadUrl(orderId, {
      name: "../../baska/evil.png",
      type: "image/png",
      size: 1024,
    });

    if (!result.ok) throw new Error("beklenmeyen hata");
    expect(result.path.startsWith(`${AGENT}/${orderId}/`)).toBe(true);
    expect(result.path).not.toContain("..");
    expect(result.path).not.toContain("baska");
  });

  it("izinsiz uzantı (.exe) UNSUPPORTED_FILE, Storage'a dokunulmaz", async () => {
    const orderId = seedOrder();

    const result = await requestUploadUrl(orderId, { name: "virus.exe", type: "application/x-msdownload", size: 1024 });

    expect(result).toMatchObject({ ok: false, error: "UNSUPPORTED_FILE" });
    expect(h.calls.createSignedUploadUrl).not.toHaveBeenCalled();
  });

  it("uzantı ile MIME uyuşmazsa UNSUPPORTED_FILE", async () => {
    const orderId = seedOrder();

    const result = await requestUploadUrl(orderId, { name: "salon.jpg", type: "video/mp4", size: 1024 });

    expect(result).toMatchObject({ ok: false, error: "UNSUPPORTED_FILE" });
  });

  it("ham video siparişine fotoğraf, fotoğraf siparişine video yüklenemez", async () => {
    const rawOrder = seedOrder({ serviceCode: "raw_video" });
    const photoOrder = seedOrder({ serviceCode: "photos" });

    await expect(requestUploadUrl(rawOrder, photoFile())).resolves.toMatchObject({
      ok: false,
      error: "UNSUPPORTED_FILE",
    });
    await expect(requestUploadUrl(photoOrder, videoFile())).resolves.toMatchObject({
      ok: false,
      error: "UNSUPPORTED_FILE",
    });
  });

  it("fotoğraf 20 MB üstüyse FILE_TOO_LARGE", async () => {
    const orderId = seedOrder();

    const result = await requestUploadUrl(orderId, photoFile("buyuk.jpg", MAX_PHOTO_BYTES + 1));

    expect(result).toMatchObject({ ok: false, error: "FILE_TOO_LARGE" });
    expect(h.calls.createSignedUploadUrl).not.toHaveBeenCalled();
  });

  it("31. fotoğraf (30 dolu) LIMIT_REACHED", async () => {
    const orderId = seedOrder();
    for (let i = 0; i < MAX_PHOTOS; i++) seedAsset(orderId, "photo");

    const result = await requestUploadUrl(orderId, photoFile());

    expect(result).toMatchObject({ ok: false, error: "LIMIT_REACHED" });
    expect(h.calls.createSignedUploadUrl).not.toHaveBeenCalled();
  });

  it("AC 6. video reddi: 5 dolu iken yeni video LIMIT_REACHED", async () => {
    const orderId = seedOrder({ serviceCode: "raw_video" });
    for (let i = 0; i < MAX_RAW_VIDEOS; i++) seedAsset(orderId, "raw_video");

    const result = await requestUploadUrl(orderId, videoFile());

    expect(result).toMatchObject({ ok: false, error: "LIMIT_REACHED" });
    expect(h.calls.createSignedUploadUrl).not.toHaveBeenCalled();
  });

  it("draft olmayan siparişe yükleme URL'si INVALID_STATE", async () => {
    const orderId = seedOrder({ status: "awaiting_payment" });

    const result = await requestUploadUrl(orderId, photoFile());

    expect(result).toMatchObject({ ok: false, error: "INVALID_STATE" });
    expect(h.calls.createSignedUploadUrl).not.toHaveBeenCalled();
  });

  it("yerinde çekim siparişine (quote_pending) dosya yüklenemez", async () => {
    const orderId = seedOrder({ serviceCode: "onsite", status: "quote_pending" });

    await expect(requestUploadUrl(orderId, photoFile())).resolves.toMatchObject({
      ok: false,
      error: "INVALID_STATE",
    });
  });
});

// ---------------------------------------------------------------------------
// confirmUpload — AC-S3 yol doğrulaması ve Storage varlık kontrolü
// ---------------------------------------------------------------------------
describe("confirmUpload — yol ve varlık doğrulaması", () => {
  it("geçerli yol + Storage'da var olan dosya → asset satırı yazılır, id yoldaki uuid", async () => {
    const orderId = seedOrder();
    const path = pathFor(orderId, "jpg");
    putObject(path, 2048);

    const result = await confirmUpload(orderId, path, 2048);

    if (!result.ok) throw new Error("beklenmeyen hata");
    expect(result.assetId).toBe(path.slice(`${AGENT}/${orderId}/`.length).split(".")[0]);
    expect(assetsOf(orderId)).toEqual([
      expect.objectContaining({ id: result.assetId, kind: "photo", storage_path: path, size_bytes: 2048 }),
    ]);
  });

  it("farklı emlakçının prefix'iyle başlayan yol reddedilir", async () => {
    const orderId = seedOrder();
    const path = pathFor(orderId, "jpg", OTHER);
    putObject(path, 1024);

    await expect(confirmUpload(orderId, path, 1024)).resolves.toMatchObject({
      ok: false,
      error: "INVALID_INPUT",
    });
    expect(assetsOf(orderId)).toHaveLength(0);
  });

  it("başka siparişin yolu (doğru agent, yanlış order) reddedilir", async () => {
    const orderId = seedOrder();
    const otherOrder = seedOrder();
    const path = pathFor(otherOrder, "jpg");
    putObject(path, 1024);

    await expect(confirmUpload(orderId, path, 1024)).resolves.toMatchObject({
      ok: false,
      error: "INVALID_INPUT",
    });
    expect(assetsOf(orderId)).toHaveLength(0);
  });

  it("Storage'da olmayan dosya için asset yazılmaz", async () => {
    const orderId = seedOrder();
    const path = pathFor(orderId, "jpg");

    await expect(confirmUpload(orderId, path, 1024)).resolves.toMatchObject({
      ok: false,
      error: "INVALID_INPUT",
    });
    expect(assetsOf(orderId)).toHaveLength(0);
  });

  it("izinsiz uzantı UNSUPPORTED_FILE", async () => {
    const orderId = seedOrder();
    const path = pathFor(orderId, "exe");
    putObject(path, 1024);

    await expect(confirmUpload(orderId, path, 1024)).resolves.toMatchObject({
      ok: false,
      error: "UNSUPPORTED_FILE",
    });
  });

  it("istemcinin bildirdiği boyut Storage'daki boyutla uyuşmazsa reddedilir", async () => {
    const orderId = seedOrder();
    const path = pathFor(orderId, "jpg");
    putObject(path, 100);

    await expect(confirmUpload(orderId, path, 200)).resolves.toMatchObject({
      ok: false,
      error: "INVALID_INPUT",
    });
    expect(assetsOf(orderId)).toHaveLength(0);
  });

  it("sınır aşılmışsa (31. fotoğraf) LIMIT_REACHED ve yetim dosya silinir", async () => {
    const orderId = seedOrder();
    for (let i = 0; i < MAX_PHOTOS; i++) seedAsset(orderId, "photo");
    const path = pathFor(orderId, "jpg");
    putObject(path, 1024);

    const result = await confirmUpload(orderId, path, 1024);

    expect(result).toMatchObject({ ok: false, error: "LIMIT_REACHED" });
    expect(h.objects.has(`${BUCKET}/${path}`)).toBe(false);
    expect(assetsOf(orderId)).toHaveLength(MAX_PHOTOS);
  });

  it("RT-2: DB ASSET_LIMIT_REACHED derse LIMIT_REACHED ve yetim dosya silinir", async () => {
    const orderId = seedOrder({ serviceCode: "raw_video" });
    const path = pathFor(orderId, "mp4");
    putObject(path, 1024);
    h.state.injectError = { table: "video_order_assets", op: "insert", message: "ASSET_LIMIT_REACHED" };

    const result = await confirmUpload(orderId, path, 1024);

    expect(result).toMatchObject({ ok: false, error: "LIMIT_REACHED" });
    expect(h.calls.remove).toHaveBeenCalledWith(BUCKET, [path]);
    expect(assetsOf(orderId)).toHaveLength(0);
  });

  it("draft olmayan siparişte INVALID_STATE", async () => {
    const orderId = seedOrder({ status: "in_progress" });
    const path = pathFor(orderId, "jpg");
    putObject(path, 1024);

    await expect(confirmUpload(orderId, path, 1024)).resolves.toMatchObject({
      ok: false,
      error: "INVALID_STATE",
    });
  });
});

// ---------------------------------------------------------------------------
// removeAsset
// ---------------------------------------------------------------------------
describe("removeAsset", () => {
  it("draft siparişte dosya hem Storage'dan hem tablodan silinir", async () => {
    const orderId = seedOrder();
    const assetId = seedAsset(orderId, "photo");
    const storedPath = assetsOf(orderId)[0].storage_path as string;

    const result = await removeAsset(orderId, assetId);

    expect(result).toEqual({ ok: true });
    expect(h.calls.remove).toHaveBeenCalledWith(BUCKET, [storedPath]);
    expect(assetsOf(orderId)).toHaveLength(0);
  });

  it("draft olmayan siparişte INVALID_STATE, dosya kalır", async () => {
    const orderId = seedOrder({ status: "awaiting_payment" });
    const assetId = seedAsset(orderId, "photo");

    const result = await removeAsset(orderId, assetId);

    expect(result).toMatchObject({ ok: false, error: "INVALID_STATE" });
    expect(assetsOf(orderId)).toHaveLength(1);
  });

  it("RT-3: DB ORDER_NOT_DRAFT derse INVALID_STATE, Storage'dan silinmez", async () => {
    const orderId = seedOrder();
    const assetId = seedAsset(orderId, "photo");
    h.state.injectError = { table: "video_order_assets", op: "delete", message: "ORDER_NOT_DRAFT" };

    const result = await removeAsset(orderId, assetId);

    expect(result).toMatchObject({ ok: false, error: "INVALID_STATE" });
    expect(h.calls.remove).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// submitVideoOrder — en az asset kuralı ve durum geçişi
// ---------------------------------------------------------------------------
describe("submitVideoOrder", () => {
  it("fotoğraf siparişinde 2 fotoğrafla gönderilemez (en az 3)", async () => {
    const orderId = seedOrder();
    seedAsset(orderId, "photo");
    seedAsset(orderId, "photo");

    const result = await submitVideoOrder(orderId);

    expect(result).toMatchObject({ ok: false, error: "INVALID_INPUT" });
    expect(orderRow(orderId)?.status).toBe("draft");
  });

  it("fotoğraf siparişi 3 fotoğrafla awaiting_payment olur", async () => {
    const orderId = seedOrder();
    for (let i = 0; i < 3; i++) seedAsset(orderId, "photo");

    const result = await submitVideoOrder(orderId);

    expect(result).toEqual({ ok: true, status: "awaiting_payment" });
    expect(orderRow(orderId)?.status).toBe("awaiting_payment");
  });

  it("ham video siparişinde en az 1 video şartı", async () => {
    const orderId = seedOrder({ serviceCode: "raw_video" });
    await expect(submitVideoOrder(orderId)).resolves.toMatchObject({ ok: false, error: "INVALID_INPUT" });

    seedAsset(orderId, "raw_video");
    await expect(submitVideoOrder(orderId)).resolves.toEqual({ ok: true, status: "awaiting_payment" });
  });

  it("yerinde çekim (quote_pending) agent tarafından gönderilemez", async () => {
    const orderId = seedOrder({ serviceCode: "onsite", status: "quote_pending" });

    await expect(submitVideoOrder(orderId)).resolves.toMatchObject({ ok: false, error: "INVALID_STATE" });
    expect(orderRow(orderId)?.status).toBe("quote_pending");
  });

  it("zaten gönderilmiş sipariş tekrar gönderilemez", async () => {
    const orderId = seedOrder({ status: "awaiting_payment" });
    for (let i = 0; i < 3; i++) seedAsset(orderId, "photo");

    await expect(submitVideoOrder(orderId)).resolves.toMatchObject({ ok: false, error: "INVALID_STATE" });
  });
});

// ---------------------------------------------------------------------------
// getDeliveredVideoUrl — AC-9 / AC-S6
// ---------------------------------------------------------------------------
describe("getDeliveredVideoUrl", () => {
  it("delivered + sahip → property-videos bucket'ından 600 sn imzalı URL", async () => {
    const orderId = seedOrder({ status: "delivered" });
    const storagePath = `${AGENT}/teslim.mp4`;
    h.db.property_videos = [{ id: randomUUID(), order_id: orderId, storage_path: storagePath, status: "published" }];

    const result = await getDeliveredVideoUrl(orderId);

    if (!result.ok) throw new Error("beklenmeyen hata");
    expect(result.url).toContain("ttl=600");
    expect(h.calls.createSignedUrl).toHaveBeenCalledWith("property-videos", storagePath, 600);
  });

  it("teslim edilmemiş siparişte INVALID_STATE, URL üretilmez", async () => {
    const orderId = seedOrder({ status: "in_progress" });

    await expect(getDeliveredVideoUrl(orderId)).resolves.toMatchObject({ ok: false, error: "INVALID_STATE" });
    expect(h.calls.createSignedUrl).not.toHaveBeenCalled();
  });
});
