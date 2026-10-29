import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ensureAgentRow } from "./ensureAgentRow";

type InsertResult = { error: { code?: string; message: string } | null };
type RpcResult = { data: unknown; error: { code?: string; message: string } | null };

const FAKE_NOW = "2026-10-28T10:00:00.000Z";

// agents tablosu zinciri: .insert({...}) ; start_trial RPC: .rpc("start_trial")
function setupSupabase(
  insertResult: InsertResult = { error: null },
  rpcResult: RpcResult = { data: true, error: null },
) {
  const insert = vi.fn().mockResolvedValue(insertResult);
  const chain: Record<string, unknown> = { insert };

  const from = vi.fn((table: string) => {
    if (table === "agents") return chain;
    throw new Error(`Beklenmeyen tablo: ${table}`);
  });

  const rpc = vi.fn().mockResolvedValue(rpcResult);

  const supabase = { from, rpc };
  return { supabase, from, insert, rpc };
}

describe("ensureAgentRow", () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("başarılı insert: agents.insert sadece {id, company_name} ile çağrılır, is_admin HİÇ gönderilmez", async () => {
    const { supabase, from, insert } = setupSupabase({ error: null });

    await ensureAgentRow(supabase as never, "user-1", "Acme Emlak");

    expect(from).toHaveBeenCalledWith("agents");
    expect(insert).toHaveBeenCalledWith({ id: "user-1", company_name: "Acme Emlak" });
  });

  it("AC-5/AC-S4: 23505 (duplicate) hatası sessizce yutulur, hata fırlatılmaz", async () => {
    const { supabase } = setupSupabase({
      error: { code: "23505", message: "duplicate key value violates unique constraint" },
    });

    await expect(ensureAgentRow(supabase as never, "user-1", "Acme Emlak")).resolves.toBeUndefined();
  });

  it("başka bir hata (23505 dışında) THROW EDİLİR ve console.error çağrılır", async () => {
    const { supabase } = setupSupabase({
      error: { code: "42501", message: "permission denied" },
    });

    await expect(ensureAgentRow(supabase as never, "user-1", "Acme Emlak")).rejects.toMatchObject({
      code: "42501",
    });
    expect(consoleErrorSpy).toHaveBeenCalled();
  });

  it("network/beklenmeyen bir hata (code yok) da THROW EDİLİR ve console.error çağrılır", async () => {
    const { supabase } = setupSupabase({
      error: { message: "network error" },
    });

    await expect(ensureAgentRow(supabase as never, "user-1", "Acme Emlak")).rejects.toMatchObject({
      message: "network error",
    });
    expect(consoleErrorSpy).toHaveBeenCalled();
  });

  describe("AC-3 — KVKK onay alanları (sunucuda üretilir)", () => {
    it("terms.accepted=true ile insert terms_accepted_at (sunucu zamanı) ve terms_version '2026-10' içerir", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(FAKE_NOW));
      const { supabase, insert } = setupSupabase({ error: null });

      await ensureAgentRow(supabase as never, "user-1", "Acme Emlak", { accepted: true });

      expect(insert).toHaveBeenCalledWith({
        id: "user-1",
        company_name: "Acme Emlak",
        terms_accepted_at: FAKE_NOW,
        terms_version: "2026-10",
      });
    });

    it("AC-S4: istemciden gelen terms_accepted_at / terms_version değerleri yok sayılır", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(FAKE_NOW));
      const { supabase, insert } = setupSupabase({ error: null });

      await ensureAgentRow(supabase as never, "user-1", "Acme Emlak", {
        accepted: true,
        acceptedAt: "2000-01-01T00:00:00.000Z",
        version: "1999-01",
      } as never);

      expect(insert).toHaveBeenCalledWith({
        id: "user-1",
        company_name: "Acme Emlak",
        terms_accepted_at: FAKE_NOW,
        terms_version: "2026-10",
      });
    });

    it("terms.accepted=false veya terms verilmemişse terms alanları insert'e HİÇ girmez", async () => {
      const { supabase, insert } = setupSupabase({ error: null });

      await ensureAgentRow(supabase as never, "user-1", "Acme Emlak", { accepted: false });

      const payload = insert.mock.calls[0][0] as Record<string, unknown>;
      expect(payload).toEqual({ id: "user-1", company_name: "Acme Emlak" });
      expect(payload).not.toHaveProperty("terms_accepted_at");
      expect(payload).not.toHaveProperty("terms_version");
    });
  });

  describe("AC-4 / AC-6 — start_trial() RPC çağrısı", () => {
    it("agents insert'ünden sonra supabase.rpc('start_trial') ARGÜMANSIZ çağrılır", async () => {
      const { supabase, rpc } = setupSupabase({ error: null }, { data: true, error: null });

      await ensureAgentRow(supabase as never, "user-1", "Acme Emlak", { accepted: true });

      expect(rpc).toHaveBeenCalledTimes(1);
      expect(rpc).toHaveBeenCalledWith("start_trial");
    });

    it("start_trial, agents insert'ünden SONRA çağrılır", async () => {
      const { supabase, insert, rpc } = setupSupabase({ error: null }, { data: true, error: null });

      await ensureAgentRow(supabase as never, "user-1", "Acme Emlak", { accepted: true });

      expect(insert.mock.invocationCallOrder[0]).toBeLessThan(rpc.mock.invocationCallOrder[0]);
    });

    it("agents insert hata verirse start_trial ÇAĞRILMAZ", async () => {
      const { supabase, rpc } = setupSupabase({
        error: { code: "42501", message: "permission denied" },
      });

      await expect(ensureAgentRow(supabase as never, "user-1", "Acme Emlak")).rejects.toMatchObject({
        code: "42501",
      });
      expect(rpc).not.toHaveBeenCalled();
    });

    it("AC-6: start_trial RPC error dönerse fonksiyon THROW ETMEZ (kayıt başarılı kalır)", async () => {
      const { supabase } = setupSupabase(
        { error: null },
        { data: null, error: { code: "P0001", message: "plan bulunamadı" } },
      );

      await expect(
        ensureAgentRow(supabase as never, "user-1", "Acme Emlak", { accepted: true }),
      ).resolves.toBeUndefined();
    });

    it("AC-6: start_trial RPC error dönerse console.error('trial_create_failed', {agent_id, error_code}) tam eşleşmeyle çağrılır", async () => {
      const { supabase } = setupSupabase(
        { error: null },
        { data: null, error: { code: "P0001", message: "plan bulunamadı" } },
      );

      await ensureAgentRow(supabase as never, "user-1", "Acme Emlak", { accepted: true });

      expect(consoleErrorSpy).toHaveBeenCalledWith("trial_create_failed", {
        agent_id: "user-1",
        error_code: "P0001",
      });
    });

    it("AC-6: start_trial RPC reject ederse (exception) fonksiyon THROW ETMEZ ve trial_create_failed loglanır", async () => {
      const { supabase, rpc } = setupSupabase({ error: null });
      rpc.mockRejectedValueOnce({ code: "08006", message: "connection failure" });

      await expect(
        ensureAgentRow(supabase as never, "user-1", "Acme Emlak", { accepted: true }),
      ).resolves.toBeUndefined();
      expect(consoleErrorSpy).toHaveBeenCalledWith("trial_create_failed", {
        agent_id: "user-1",
        error_code: "08006",
      });
    });

    it("start_trial false dönerse (zaten var) trial_create_failed LOGLANMAZ", async () => {
      const { supabase } = setupSupabase({ error: null }, { data: false, error: null });

      await expect(
        ensureAgentRow(supabase as never, "user-1", "Acme Emlak", { accepted: true }),
      ).resolves.toBeUndefined();
      expect(consoleErrorSpy).not.toHaveBeenCalledWith("trial_create_failed", expect.anything());
    });

    it("start_trial true dönerse trial_create_failed LOGLANMAZ", async () => {
      const { supabase } = setupSupabase({ error: null }, { data: true, error: null });

      await ensureAgentRow(supabase as never, "user-1", "Acme Emlak", { accepted: true });

      expect(consoleErrorSpy).not.toHaveBeenCalledWith("trial_create_failed", expect.anything());
    });
  });

  describe("AC-S8 — log PII içermez", () => {
    it("trial_create_failed logunda e-posta, mesaj veya token yoktur (yalnız agent_id ve error_code)", async () => {
      const { supabase } = setupSupabase(
        { error: null },
        {
          data: null,
          error: { code: "P0001", message: "hata user@example.com token=abc123" },
        },
      );

      await ensureAgentRow(supabase as never, "user-1", "Acme Emlak", { accepted: true });

      const serialized = JSON.stringify(consoleErrorSpy.mock.calls);
      expect(serialized).not.toContain("@");
      expect(serialized).not.toContain("example.com");
      expect(serialized).not.toContain("abc123");
      expect(serialized).not.toContain("Acme Emlak");
    });
  });
});
