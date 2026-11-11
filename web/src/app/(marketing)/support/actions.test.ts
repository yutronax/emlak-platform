import { beforeEach, describe, expect, it, vi } from "vitest";

import { createClient, createServiceRoleClient } from "@/lib/supabase/server";

import { sendSupportMessage } from "./actions";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
  createServiceRoleClient: vi.fn(),
}));

function form(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

function setup({ userId = null, insertError = null }: { userId?: string | null; insertError?: { message: string } | null } = {}) {
  const getUser = vi.fn().mockResolvedValue({ data: { user: userId ? { id: userId } : null } });
  vi.mocked(createClient).mockResolvedValue({ auth: { getUser } } as never);
  const insert = vi.fn().mockResolvedValue({ error: insertError });
  vi.mocked(createServiceRoleClient).mockReturnValue({ from: vi.fn(() => ({ insert })) } as never);
  return { insert };
}

describe("sendSupportMessage", () => {
  beforeEach(() => vi.clearAllMocks());

  it("geçerli mesajı support_messages'a yazar ve ok döner (anon → agent_id null)", async () => {
    const { insert } = setup();
    const result = await sendSupportMessage(form({ name: "Ayşe", contact: "0 532 000 00 00", message: "Yardım lazım" }));
    expect(result).toEqual({ ok: true });
    expect(insert).toHaveBeenCalledWith({ name: "Ayşe", contact: "0 532 000 00 00", message: "Yardım lazım", agent_id: null });
  });

  it("giriş yapmış kullanıcıda agent_id ilişkilendirilir", async () => {
    const { insert } = setup({ userId: "user-1" });
    await sendSupportMessage(form({ name: "Veli", contact: "a@b.com", message: "Merhaba" }));
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ agent_id: "user-1" }));
  });

  it.each([
    ["name", { name: "A", contact: "a@b.com", message: "yeterli" }],
    ["contact", { name: "Ayşe", contact: "ab", message: "yeterli" }],
    ["message", { name: "Ayşe", contact: "a@b.com", message: "kısa" }],
  ])("%s geçersizse INVALID_INPUT, insert çağrılmaz", async (field, fields) => {
    const { insert } = setup();
    const result = await sendSupportMessage(form(fields));
    expect(result).toMatchObject({ ok: false, error: "INVALID_INPUT", field });
    expect(insert).not.toHaveBeenCalled();
  });

  it("DB hatasında ok:false döner", async () => {
    setup({ insertError: { message: "boom" } });
    const result = await sendSupportMessage(form({ name: "Ayşe", contact: "a@b.com", message: "Yardım lazım" }));
    expect(result).toMatchObject({ ok: false });
  });
});
