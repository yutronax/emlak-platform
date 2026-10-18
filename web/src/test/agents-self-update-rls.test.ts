import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * EML-18 / EML-23 — agents_self_update RLS yetki yükseltme testleri.
 *
 * ZORUNLU: Mock YOK (fake-supabase.ts kullanılmaz). Bu testler gerçek bir
 * Supabase projesine (anon + service_role key ile) karşı çalışır.
 * Henüz migration 0004 (fix) UYGULANMADI — bu dosyadaki testlerin şu an
 * KIRMIZI (fail) olması beklenir; code-copilot migration'ı yazıp uyguladıktan
 * sonra yeşile dönmeli.
 *
 * Gerekli ortam değişkenleri (web/.env.local): NEXT_PUBLIC_SUPABASE_URL,
 * NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY.
 * Vitest .env.local'i otomatik yüklemediği için burada elle okunuyor.
 * SUPABASE_SERVICE_ROLE_KEY şu an .env.local'de YOK — bu durumda tüm suite
 * `describe.skip` ile atlanır (crash etmez), mock'la ikame edilmez.
 */

function loadEnvLocal(): void {
  const envPath = path.resolve(__dirname, "../../.env.local");
  if (!fs.existsSync(envPath)) return;
  const content = fs.readFileSync(envPath, "utf8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

loadEnvLocal();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const hasRealSupabaseEnv = Boolean(SUPABASE_URL && ANON_KEY && SERVICE_ROLE_KEY);

type AgentRow = {
  id: string;
  company_name: string;
  phone: string | null;
  is_admin: boolean;
  created_at: string;
};

describe.skipIf(!hasRealSupabaseEnv)(
  "agents_self_update RLS — yetki yükseltme açığı (EML-18)",
  () => {
    let serviceClient: SupabaseClient;
    let clientA: SupabaseClient;
    let clientB: SupabaseClient;
    let anonClient: SupabaseClient;
    let userAId: string;
    let userBId: string;
    let originalCreatedAtA: string;

    const emailA = `rls-test-a-${randomUUID()}@example.com`;
    const emailB = `rls-test-b-${randomUUID()}@example.com`;
    const passwordA = randomUUID();
    const passwordB = randomUUID();

    beforeAll(async () => {
      serviceClient = createClient(SUPABASE_URL as string, SERVICE_ROLE_KEY as string, {
        auth: { autoRefreshToken: false, persistSession: false },
      });

      const { data: createdA, error: createErrA } = await serviceClient.auth.admin.createUser({
        email: emailA,
        password: passwordA,
        email_confirm: true,
      });
      if (createErrA || !createdA.user) throw createErrA ?? new Error("userA oluşturulamadı");
      userAId = createdA.user.id;

      const { data: createdB, error: createErrB } = await serviceClient.auth.admin.createUser({
        email: emailB,
        password: passwordB,
        email_confirm: true,
      });
      if (createErrB || !createdB.user) throw createErrB ?? new Error("userB oluşturulamadı");
      userBId = createdB.user.id;

      const { error: insertErrA } = await serviceClient
        .from("agents")
        .insert({ id: userAId, company_name: "Test Danışman A", phone: "5551112222" });
      if (insertErrA) throw insertErrA;

      const { error: insertErrB } = await serviceClient
        .from("agents")
        .insert({ id: userBId, company_name: "Test Danışman B", phone: "5553334444" });
      if (insertErrB) throw insertErrB;

      const { data: insertedA, error: fetchErrA } = await serviceClient
        .from("agents")
        .select("created_at")
        .eq("id", userAId)
        .single<Pick<AgentRow, "created_at">>();
      if (fetchErrA || !insertedA) throw fetchErrA ?? new Error("userA created_at okunamadı");
      originalCreatedAtA = insertedA.created_at;

      anonClient = createClient(SUPABASE_URL as string, ANON_KEY as string, {
        auth: { autoRefreshToken: false, persistSession: false },
      });

      const signInA = await createClient(SUPABASE_URL as string, ANON_KEY as string, {
        auth: { autoRefreshToken: false, persistSession: false },
      }).auth.signInWithPassword({ email: emailA, password: passwordA });
      if (signInA.error || !signInA.data.session) throw signInA.error ?? new Error("A girişi başarısız");
      clientA = createClient(SUPABASE_URL as string, ANON_KEY as string, {
        auth: { autoRefreshToken: false, persistSession: false },
        global: {
          headers: { Authorization: `Bearer ${signInA.data.session.access_token}` },
        },
      });

      const signInB = await createClient(SUPABASE_URL as string, ANON_KEY as string, {
        auth: { autoRefreshToken: false, persistSession: false },
      }).auth.signInWithPassword({ email: emailB, password: passwordB });
      if (signInB.error || !signInB.data.session) throw signInB.error ?? new Error("B girişi başarısız");
      clientB = createClient(SUPABASE_URL as string, ANON_KEY as string, {
        auth: { autoRefreshToken: false, persistSession: false },
        global: {
          headers: { Authorization: `Bearer ${signInB.data.session.access_token}` },
        },
      });
    });

    afterAll(async () => {
      if (userAId) await serviceClient.auth.admin.deleteUser(userAId);
      if (userBId) await serviceClient.auth.admin.deleteUser(userBId);
    });

    it("AC-1 / Davranış Sözleşmesi #1 — sahibi izinli alanları günceller, is_admin false kalır", async () => {
      const { data, error, status } = await clientA
        .from("agents")
        .update({ company_name: "Güncellenmiş A", phone: "5559998888" })
        .eq("id", userAId)
        .select()
        .single<AgentRow>();

      expect(error).toBeNull();
      expect(status).toBe(200);
      expect(data?.company_name).toBe("Güncellenmiş A");
      expect(data?.is_admin).toBe(false);
    });

    it("AC-2 — id/created_at alanları değiştirilemez", async () => {
      const fakeCreatedAt = new Date();
      fakeCreatedAt.setMonth(fakeCreatedAt.getMonth() - 1);

      const { error, status } = await clientA
        .from("agents")
        .update({ created_at: fakeCreatedAt.toISOString() })
        .eq("id", userAId)
        .select();

      expect(error).not.toBeNull();
      expect(error?.code).toBe("42501");
      expect(status).toBe(403);

      const { data: check } = await serviceClient
        .from("agents")
        .select("created_at")
        .eq("id", userAId)
        .single<Pick<AgentRow, "created_at">>();
      expect(check?.created_at).toBe(originalCreatedAtA);
    });

    it("AC-S1 / Davranış Sözleşmesi #2 — is_admin=true denemesi 403 + Postgres 42501 ile reddedilir, DB'de false kalır", async () => {
      const { error, status } = await clientA
        .from("agents")
        .update({ is_admin: true })
        .eq("id", userAId)
        .select();

      expect(error).not.toBeNull();
      expect(error?.code).toBe("42501");
      expect(status).toBe(403);

      const { data: check } = await serviceClient
        .from("agents")
        .select("is_admin")
        .eq("id", userAId)
        .single<Pick<AgentRow, "is_admin">>();
      expect(check?.is_admin).toBe(false);
    });

    it("Davranış Sözleşmesi #7 — kısmi başarı yok: izinli+izinsiz alan birlikte tüm istek reddedilir", async () => {
      const { error, status } = await clientA
        .from("agents")
        .update({ company_name: "Uygulanmamalı", is_admin: true })
        .eq("id", userAId)
        .select();

      expect(error).not.toBeNull();
      expect(error?.code).toBe("42501");
      expect(status).toBe(403);

      const { data: check } = await serviceClient
        .from("agents")
        .select("company_name, is_admin")
        .eq("id", userAId)
        .single<Pick<AgentRow, "company_name" | "is_admin">>();
      expect(check?.company_name).not.toBe("Uygulanmamalı");
      expect(check?.is_admin).toBe(false);
    });

    it("AC-S2 / Davranış Sözleşmesi #3 — başka kullanıcının satırını güncelleme 0 satır etkiler, hata yok", async () => {
      const { data, error, status } = await clientA
        .from("agents")
        .update({ company_name: "Ele Geçirilmiş B" })
        .eq("id", userBId)
        .select();

      expect(error).toBeNull();
      expect(status).toBe(200);
      expect(data).toEqual([]);

      const { data: check } = await serviceClient
        .from("agents")
        .select("company_name")
        .eq("id", userBId)
        .single<Pick<AgentRow, "company_name">>();
      expect(check?.company_name).toBe("Test Danışman B");
    });

    it("AC-S2 ek / Davranış Sözleşmesi #4 — anon key ile UPDATE denemesi 0 satır etkiler (auth.uid() null, eşleşen satır yok)", async () => {
      const { data, error, status } = await anonClient
        .from("agents")
        .update({ company_name: "Anon Deneme" })
        .eq("id", userAId)
        .select();

      expect(error).toBeNull();
      expect(status).toBe(200);
      expect(data).toEqual([]);

      const { data: check } = await serviceClient
        .from("agents")
        .select("company_name")
        .eq("id", userAId)
        .single<Pick<AgentRow, "company_name">>();
      expect(check?.company_name).not.toBe("Anon Deneme");
    });

    it("AC-3 — service_role ile is_admin güncellemesi başarılı olur (admin akışı kırılmamalı)", async () => {
      const { data, error, status } = await serviceClient
        .from("agents")
        .update({ is_admin: true })
        .eq("id", userAId)
        .select()
        .single<AgentRow>();

      expect(error).toBeNull();
      expect(status).toBe(200);
      expect(data?.is_admin).toBe(true);

      await serviceClient.from("agents").update({ is_admin: false }).eq("id", userAId);
    });
  },
);
