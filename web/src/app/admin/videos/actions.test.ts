import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * EML-72 (parent EML-11) — admin/videos server action unit testleri.
 *
 * Kaynak: obss_project/artifacts/admin-video-yukleme-paneli/plan.md
 *  - actions.ts: `uploadVideo(formData)`, `publishVideo(formData)`, export `buildVideoStoragePath(propertyId, filename)`.
 *  - Desen: throw-based (`{ok,error}` DEĞİL), `/admin/listings/actions.ts` ile aynı.
 *
 * Mock hedefleri, actions.ts'in GERÇEK import satırlarıyla birebir:
 *  - `@/lib/auth/requireAdmin`  (actions.ts: import { requireAdmin } from "@/lib/auth/requireAdmin")
 *  - `next/cache`               (revalidatePath)
 *  - `next/navigation`          (redirect)
 * Supabase client'ı ayrıca mock'lanmaz: requireAdmin, `supabase` nesnesini döner;
 * bu fake o nesne üzerinden sağlanır (requireAdmin mock'u içinde).
 *
 * Bu dosya RED olmalı: actions.ts henüz yok.
 */

// ---------------------------------------------------------------------------
// Fake Supabase + requireAdmin state (vi.mock factory'leri hoist edildiği için
// vi.hoisted içinde tanımlanır)
// ---------------------------------------------------------------------------
const h = vi.hoisted(() => {
  const state: {
    adminResult: unknown;
    property: { id: string } | null;
  } = {
    adminResult: null,
    property: null,
  };

  const storageUpload = vi.fn(async (_path: string, _body: unknown, _opts?: unknown) => ({
    data: { path: "ok" },
    error: null as null | { message: string },
  }));
  const storageRemove = vi.fn(async (_paths: string[]) => ({ data: [], error: null }));
  const videoInsert = vi.fn((_row: unknown) => chainFor("property_videos"));
  const videoUpdate = vi.fn((_row: unknown) => chainFor("property_videos"));

  function chainFor(table: string): Record<string, unknown> {
    const chain: Record<string, unknown> = {};
    for (const m of ["select", "eq", "maybeSingle", "single"]) {
      chain[m] = vi.fn(() => chain);
    }
    chain.insert = videoInsert;
    chain.update = videoUpdate;
    chain.then = (
      onFulfilled: (v: unknown) => unknown,
      onRejected?: (e: unknown) => unknown,
    ) => {
      let resolved: unknown;
      if (table === "properties") {
        resolved = { data: state.property, error: null };
      } else {
        resolved = { data: { id: "video-1", status: "draft" }, error: null };
      }
      return Promise.resolve(resolved).then(onFulfilled, onRejected);
    };
    return chain;
  }

  const fakeSupabase = {
    from: vi.fn((table: string) => chainFor(table)),
    storage: {
      from: vi.fn((_bucket: string) => ({
        upload: storageUpload,
        remove: storageRemove,
      })),
    },
  };

  return { state, storageUpload, storageRemove, videoInsert, videoUpdate, fakeSupabase };
});

vi.mock("@/lib/auth/requireAdmin", () => ({
  requireAdmin: vi.fn(async () => h.state.adminResult),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn((to: string) => {
    throw new Error(`NEXT_REDIRECT:${to}`);
  }),
}));

// Gerçek action modülü — mock'lardan SONRA import edilmeli (vitest hoist'i bunu garanti eder).
import { buildVideoStoragePath, publishVideo, uploadVideo } from "./actions";

// ---------------------------------------------------------------------------
// Yardımcılar
// ---------------------------------------------------------------------------
const MB = 1024 * 1024;

function adminOk(): unknown {
  return { ok: true, supabase: h.fakeSupabase, userId: randomUUID() };
}

function makeVideoForm(propertyId: string, file: File): FormData {
  const fd = new FormData();
  fd.set("property_id", propertyId);
  fd.set("video", file);
  return fd;
}

function fileNamed(name: string, type: string, sizeBytes = 1024): File {
  return new File([new Uint8Array(sizeBytes)], name, { type });
}

beforeEach(() => {
  vi.clearAllMocks();
  h.state.adminResult = adminOk();
  h.state.property = { id: randomUUID() };
});

// ---------------------------------------------------------------------------
// AC-S1 — path üretici: HER ZAMAN `${propertyId}/` öneki
// ---------------------------------------------------------------------------
describe("buildVideoStoragePath — AC-S1 (path öneki her zaman property_id)", () => {
  const propertyIds = [randomUUID(), randomUUID(), randomUUID()];

  it.each(propertyIds)(
    "propertyId=%s için yol `${propertyId}/<uuid>.<ext>` biçiminde üretilir",
    (propertyId) => {
      const storagePath = buildVideoStoragePath(propertyId, "tanitim.mp4");

      expect(storagePath.startsWith(`${propertyId}/`)).toBe(true);
      expect(storagePath).toMatch(
        new RegExp(`^${propertyId}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\\.mp4$`),
      );
    },
  );

  it("client'tan gelen dosya adı yolun içine GİRMEZ (path manipülasyonu tasarımla engellenir)", () => {
    const propertyId = randomUUID();
    const malicious = "../../other-property/evil.mp4";

    const storagePath = buildVideoStoragePath(propertyId, malicious);

    expect(storagePath.startsWith(`${propertyId}/`)).toBe(true);
    expect(storagePath).not.toContain("other-property");
    expect(storagePath).not.toContain("..");
  });

  it("uzantı yalnızca izinli değerlerden (mp4/webm/mov) türetilir", () => {
    const propertyId = randomUUID();
    expect(buildVideoStoragePath(propertyId, "a.webm")).toMatch(/\.webm$/);
    expect(buildVideoStoragePath(propertyId, "a.mov")).toMatch(/\.mov$/);
  });
});

// ---------------------------------------------------------------------------
// AC-3 — geçersiz format
// ---------------------------------------------------------------------------
describe("uploadVideo — geçersiz format (AC-3)", () => {
  it(".exe dosyası → tam eşleşen hata mesajı, Storage/DB yazımı yok", async () => {
    const fd = makeVideoForm(randomUUID(), fileNamed("virus.exe", "application/x-msdownload"));

    await expect(uploadVideo(fd)).rejects.toThrow(
      new Error("Sadece MP4, WebM veya MOV yükleyebilirsiniz"),
    );
    expect(h.storageUpload).not.toHaveBeenCalled();
    expect(h.videoInsert).not.toHaveBeenCalled();
  });

  it(".txt dosyası → tam eşleşen hata mesajı, Storage/DB yazımı yok", async () => {
    const fd = makeVideoForm(randomUUID(), fileNamed("notlar.txt", "text/plain"));

    await expect(uploadVideo(fd)).rejects.toThrow(
      new Error("Sadece MP4, WebM veya MOV yükleyebilirsiniz"),
    );
    expect(h.storageUpload).not.toHaveBeenCalled();
    expect(h.videoInsert).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// AC-4 — boyut limiti (>50MB)
// ---------------------------------------------------------------------------
describe("uploadVideo — boyut limiti (AC-4)", () => {
  it("50MB + 1 byte → tam eşleşen hata mesajı, Storage/DB yazımı yok", async () => {
    const oversized = fileNamed("buyuk.mp4", "video/mp4", 50 * MB + 1);
    const fd = makeVideoForm(randomUUID(), oversized);

    await expect(uploadVideo(fd)).rejects.toThrow(new Error("Dosya 50MB sınırını aşıyor"));
    expect(h.storageUpload).not.toHaveBeenCalled();
    expect(h.videoInsert).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// AC-5 — geçersiz / bulunamayan property_id
// ---------------------------------------------------------------------------
describe("uploadVideo — geçersiz property (AC-5)", () => {
  it("property bulunamadı (maybeSingle null) → tam eşleşen hata, Storage yazımı yok", async () => {
    h.state.property = null;
    const fd = makeVideoForm(randomUUID(), fileNamed("tanitim.mp4", "video/mp4"));

    await expect(uploadVideo(fd)).rejects.toThrow(new Error("Geçersiz mülk"));
    expect(h.storageUpload).not.toHaveBeenCalled();
    expect(h.videoInsert).not.toHaveBeenCalled();
  });

  it("property_id boş string → tam eşleşen hata, Storage yazımı yok", async () => {
    h.state.property = null;
    const fd = makeVideoForm("", fileNamed("tanitim.mp4", "video/mp4"));

    await expect(uploadVideo(fd)).rejects.toThrow(new Error("Geçersiz mülk"));
    expect(h.storageUpload).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Yetki — requireAdmin (actions.ts ile AYNI desen: no-session→redirect, not-admin→throw)
// ---------------------------------------------------------------------------
describe("uploadVideo / publishVideo — requireAdmin (yetki)", () => {
  it("oturum yok (no-session) → /login'e redirect, upload yapılmaz", async () => {
    h.state.adminResult = { ok: false, reason: "no-session" };
    const fd = makeVideoForm(randomUUID(), fileNamed("tanitim.mp4", "video/mp4"));

    await expect(uploadVideo(fd)).rejects.toThrow(new Error("NEXT_REDIRECT:/login"));
    expect(h.storageUpload).not.toHaveBeenCalled();
    expect(h.videoInsert).not.toHaveBeenCalled();
  });

  it("admin değil (not-admin) → tam eşleşen yetki hatası, upload yapılmaz", async () => {
    h.state.adminResult = { ok: false, reason: "not-admin" };
    const fd = makeVideoForm(randomUUID(), fileNamed("tanitim.mp4", "video/mp4"));

    await expect(uploadVideo(fd)).rejects.toThrow(new Error("Bu işlem için yetkiniz yok"));
    expect(h.storageUpload).not.toHaveBeenCalled();
    expect(h.videoInsert).not.toHaveBeenCalled();
  });

  it("admin değil (not-admin) → publishVideo da reddeder, update yapılmaz", async () => {
    h.state.adminResult = { ok: false, reason: "not-admin" };
    const fd = new FormData();
    fd.set("video_id", randomUUID());

    await expect(publishVideo(fd)).rejects.toThrow(new Error("Bu işlem için yetkiniz yok"));
    expect(h.videoUpdate).not.toHaveBeenCalled();
  });
});
