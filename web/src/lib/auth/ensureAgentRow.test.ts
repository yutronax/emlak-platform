import { beforeEach, describe, expect, it, vi } from "vitest";

import { ensureAgentRow } from "./ensureAgentRow";

type InsertResult = { error: { code?: string; message: string } | null };

// agents tablosu zinciri: .insert({id, company_name})
function setupSupabase(insertResult: InsertResult = { error: null }) {
  const insert = vi.fn().mockResolvedValue(insertResult);
  const chain: Record<string, unknown> = { insert };

  const from = vi.fn((table: string) => {
    if (table === "agents") return chain;
    throw new Error(`Beklenmeyen tablo: ${table}`);
  });

  const supabase = { from };
  return { supabase, from, insert };
}

describe("ensureAgentRow", () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
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
});
