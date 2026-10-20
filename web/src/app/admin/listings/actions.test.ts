import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { requireAdmin } from "@/lib/auth/requireAdmin";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

import { approveListing, rejectListing } from "./actions";

vi.mock("@/lib/auth/requireAdmin", () => ({
  requireAdmin: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn(() => {
    throw new Error("NEXT_REDIRECT");
  }),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

type RpcResult = { error: { message: string } | null };

// Aynı rpc spy hem requireAdmin'in döndürdüğü client'ta hem de createClient
// mock'unda bulunur: action, yetki kontrolünü geçmeden RPC'ye gitmemeli.
function setupSupabase(rpcResult: RpcResult = { error: null }) {
  const rpc = vi.fn().mockResolvedValue(rpcResult);
  const supabase = { rpc };
  vi.mocked(createClient).mockResolvedValue(supabase as never);
  return { rpc, supabase };
}

function mockAdmin(supabase: unknown) {
  vi.mocked(requireAdmin).mockResolvedValue({
    ok: true,
    supabase: supabase as never,
    userId: "admin-1",
  });
}

function makeFormData(id = "raw-1") {
  const fd = new FormData();
  fd.set("raw_listing_id", id);
  return fd;
}

const actions = [
  {
    name: "approveListing",
    fn: approveListing,
    rpcName: "approve_raw_listing",
    genericFailure: /İlan onaylanamadı.*lütfen tekrar deneyin/i,
  },
  {
    name: "rejectListing",
    fn: rejectListing,
    rpcName: "reject_raw_listing",
    genericFailure: /İlan reddedilemedi.*lütfen tekrar deneyin/i,
  },
] as const;

describe.each(actions)("$name", ({ fn, rpcName, genericFailure }) => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  // AC-S1 (Elevation): admin değilse RPC'ye hiç gidilmez, generic hata throw edilir.
  it("AC-S1: requireAdmin not-admin dönerse rpc ÇAĞRILMAZ ve 'yetkiniz yok' hatası fırlatır", async () => {
    const { rpc } = setupSupabase({ error: null });
    vi.mocked(requireAdmin).mockResolvedValue({
      ok: false,
      reason: "not-admin",
    });

    await expect(fn(makeFormData())).rejects.toThrow(/yetkiniz yok/i);
    expect(rpc).not.toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalled();
  });

  // AC-S1 (oturum yok) / AC-S2: action içinde oturum yoksa /login'e yönlendirilir.
  it("AC-S1/S2: requireAdmin no-session dönerse redirect('/login') çağrılır ve rpc ÇAĞRILMAZ", async () => {
    const { rpc } = setupSupabase({ error: null });
    vi.mocked(requireAdmin).mockResolvedValue({
      ok: false,
      reason: "no-session",
    });

    await expect(fn(makeFormData())).rejects.toThrow("NEXT_REDIRECT");
    expect(redirect).toHaveBeenCalledWith("/login");
    expect(rpc).not.toHaveBeenCalled();
  });

  // AC-4: admin happy path — mevcut davranış korunur.
  it("AC-4: admin ise rpc ÇAĞRILIR ve başarılıysa hata fırlatmaz", async () => {
    const { rpc, supabase } = setupSupabase({ error: null });
    mockAdmin(supabase);

    await expect(fn(makeFormData("raw-42"))).resolves.toBeUndefined();
    expect(rpc).toHaveBeenCalledWith(rpcName, {
      p_raw_listing_id: "raw-42",
    });
  });

  // AC-S3 (Info disclosure): gerçek DB hata detayı istemciye sızmamalı.
  it("AC-S3: rpc hata dönerse hata mesajı DB detayını İÇERMEZ, generic metin içerir ve console.error çağrılır", async () => {
    const { rpc, supabase } = setupSupabase({
      error: { message: "Postgres internal detail XYZ" },
    });
    mockAdmin(supabase);

    let caught: unknown;
    try {
      await fn(makeFormData());
    } catch (err) {
      caught = err;
    }

    expect(rpc).toHaveBeenCalled();
    expect(caught).toBeInstanceOf(Error);
    const message = (caught as Error).message;
    expect(message).not.toContain("Postgres internal detail XYZ");
    expect(message).toMatch(genericFailure);
    expect(consoleErrorSpy).toHaveBeenCalled();
  });
});
