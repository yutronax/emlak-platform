import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * EML-72 (parent EML-11) — admin-video-yukleme-paneli RLS + Storage yetki testleri.
 *
 * Kaynak: obss_project/artifacts/admin-video-yukleme-paneli/authz_test.md (11 satır
 * matrisin RLS/Storage kısmı: satır 1-8). Satır 9-11 app-level / imzalı URL
 * testleridir, bu dosyanın kapsamında değil.
 *
 * ZORUNLU: Mock YOK. Gerçek Supabase projesine (anon + service_role key) karşı
 * çalışır — mock'lanmış client authz'u kanıtlamaz.
 * Migration 0011 (property_videos admin policy'leri + property-videos bucket)
 * HENÜZ YAZILMADI — bu dosyadaki admin/Storage testlerinin KIRMIZI olması beklenir.
 *
 * Gerekli ortam değişkenleri (web/.env.local): NEXT_PUBLIC_SUPABASE_URL,
 * NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY.
 * Vitest .env.local'i otomatik yüklemediği için burada elle okunuyor.
 * Service key yoksa tüm suite describe.skipIf ile atlanır (crash etmez).
 *
 * Fixture'lar (her çalıştırmada rastgele, afterAll'da temizlenir):
 *  - Admin (A): agents.is_admin=true, hiçbir property'ye sahip değil.
 *  - Sahip-olmayan agent (B): is_admin=false, propB'ye sahip.
 *  - Sahip agent (C): is_admin=false, propC'ye sahip.
 *  - propC üzerinde iki seed video (videoForAdmin, videoForB) — service_role ile.
 */

const BUCKET = "property-videos";

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

type VideoRow = {
  id: string;
  property_id: string;
  storage_path: string;
  status: "draft" | "published";
  published_at: string | null;
};

function makeClient(key: string, accessToken?: string): SupabaseClient {
  return createClient(SUPABASE_URL as string, key, {
    auth: { autoRefreshToken: false, persistSession: false },
    ...(accessToken
      ? { global: { headers: { Authorization: `Bearer ${accessToken}` } } }
      : {}),
  });
}

describe.skipIf(!hasRealSupabaseEnv)(
  "admin-video-yukleme-paneli — property_videos RLS + property-videos Storage (EML-72)",
  () => {
    let serviceClient: SupabaseClient;
    let adminClient: SupabaseClient;
    let agentBClient: SupabaseClient;
    let agentCClient: SupabaseClient;
    let anonClient: SupabaseClient;

    let adminId: string;
    let agentBId: string;
    let agentCId: string;

    let propertyBId: string; // B'ye ait — admin için "sahibi değil" değil, B için "sahibi değil" hedef
    let propertyCId: string; // C'ye ait — admin ve B için "sahibi olmayan" hedef

    let videoForAdminId: string; // propC üzerinde, admin UPDATE hedefi (draft)
    let videoForBId: string; // propC üzerinde, B UPDATE hedefi (draft)

    // Temizlik için takip listeleri
    const createdVideoIds: string[] = [];
    const createdStoragePaths: string[] = [];

    const password = randomUUID();
    const emailAdmin = `admin-video-${randomUUID()}@example.com`;
    const emailB = `video-b-${randomUUID()}@example.com`;
    const emailC = `video-c-${randomUUID()}@example.com`;

    beforeAll(async () => {
      serviceClient = makeClient(SERVICE_ROLE_KEY as string);
      anonClient = makeClient(ANON_KEY as string);

      // --- Auth kullanıcıları ---
      const { data: adminUser, error: adminErr } = await serviceClient.auth.admin.createUser({
        email: emailAdmin,
        password,
        email_confirm: true,
      });
      if (adminErr || !adminUser.user) throw adminErr ?? new Error("admin kullanıcısı oluşturulamadı");
      adminId = adminUser.user.id;

      const { data: bUser, error: bErr } = await serviceClient.auth.admin.createUser({
        email: emailB,
        password,
        email_confirm: true,
      });
      if (bErr || !bUser.user) throw bErr ?? new Error("B kullanıcısı oluşturulamadı");
      agentBId = bUser.user.id;

      const { data: cUser, error: cErr } = await serviceClient.auth.admin.createUser({
        email: emailC,
        password,
        email_confirm: true,
      });
      if (cErr || !cUser.user) throw cErr ?? new Error("C kullanıcısı oluşturulamadı");
      agentCId = cUser.user.id;

      // --- agents satırları (önce is_admin=false, admin için sonra service ile true) ---
      const { error: agentsErr } = await serviceClient.from("agents").insert([
        { id: adminId, company_name: "Test Admin", phone: "5550000001" },
        { id: agentBId, company_name: "Test Danışman B", phone: "5550000002" },
        { id: agentCId, company_name: "Test Danışman C", phone: "5550000003" },
      ]);
      if (agentsErr) throw agentsErr;

      const { error: adminFlagErr } = await serviceClient
        .from("agents")
        .update({ is_admin: true })
        .eq("id", adminId);
      if (adminFlagErr) throw adminFlagErr;

      // --- properties ---
      const { data: propB, error: propBErr } = await serviceClient
        .from("properties")
        .insert({ agent_id: agentBId, title: "Test İlan B", address: "B Mah. 1" })
        .select("id")
        .single<{ id: string }>();
      if (propBErr || !propB) throw propBErr ?? new Error("propB oluşturulamadı");
      propertyBId = propB.id;

      const { data: propC, error: propCErr } = await serviceClient
        .from("properties")
        .insert({ agent_id: agentCId, title: "Test İlan C", address: "C Mah. 1" })
        .select("id")
        .single<{ id: string }>();
      if (propCErr || !propC) throw propCErr ?? new Error("propC oluşturulamadı");
      propertyCId = propC.id;

      // --- seed videolar (propC üzerinde, service_role ile) ---
      const { data: vAdmin, error: vAdminErr } = await serviceClient
        .from("property_videos")
        .insert({
          property_id: propertyCId,
          storage_path: `${propertyCId}/seed-admin-${randomUUID()}.mp4`,
          status: "draft",
        })
        .select("id")
        .single<{ id: string }>();
      if (vAdminErr || !vAdmin) throw vAdminErr ?? new Error("seed video (admin hedef) oluşturulamadı");
      videoForAdminId = vAdmin.id;
      createdVideoIds.push(videoForAdminId);

      const { data: vB, error: vBErr } = await serviceClient
        .from("property_videos")
        .insert({
          property_id: propertyCId,
          storage_path: `${propertyCId}/seed-b-${randomUUID()}.mp4`,
          status: "draft",
        })
        .select("id")
        .single<{ id: string }>();
      if (vBErr || !vB) throw vBErr ?? new Error("seed video (B hedef) oluşturulamadı");
      videoForBId = vB.id;
      createdVideoIds.push(videoForBId);

      // --- Oturumlu client'lar ---
      const signIn = async (email: string) => {
        const { data, error } = await makeClient(ANON_KEY as string).auth.signInWithPassword({
          email,
          password,
        });
        if (error || !data.session) throw error ?? new Error(`${email} girişi başarısız`);
        return makeClient(ANON_KEY as string, data.session.access_token);
      };

      adminClient = await signIn(emailAdmin);
      agentBClient = await signIn(emailB);
      agentCClient = await signIn(emailC);
    });

    afterAll(async () => {
      // Storage dosyaları
      if (createdStoragePaths.length > 0) {
        await serviceClient.storage.from(BUCKET).remove(createdStoragePaths);
      }
      // property_videos satırları
      if (createdVideoIds.length > 0) {
        await serviceClient.from("property_videos").delete().in("id", createdVideoIds);
      }
      // properties
      const propIds = [propertyBId, propertyCId].filter(Boolean);
      if (propIds.length > 0) {
        await serviceClient.from("properties").delete().in("id", propIds);
      }
      // agents + auth kullanıcıları
      for (const id of [adminId, agentBId, agentCId]) {
        if (!id) continue;
        await serviceClient.from("agents").delete().eq("id", id);
        await serviceClient.auth.admin.deleteUser(id);
      }
    });

    // ---------------------------------------------------------------------
    // Satır 1 — Admin, sahibi olmadığı property'ye INSERT → BAŞARILI
    // ---------------------------------------------------------------------
    it("authz #1 / AC-S3 — admin, kendisine ait olmayan property'ye property_videos INSERT yapabilir", async () => {
      const { data, error, status } = await adminClient
        .from("property_videos")
        .insert({
          property_id: propertyBId,
          storage_path: `${propertyBId}/admin-${randomUUID()}.mp4`,
          status: "draft",
        })
        .select("id, property_id, status")
        .single<Pick<VideoRow, "id" | "property_id" | "status">>();

      expect(error).toBeNull();
      expect([200, 201]).toContain(status);
      expect(data?.property_id).toBe(propertyBId);
      expect(data?.status).toBe("draft");

      if (data?.id) createdVideoIds.push(data.id);
    });

    // ---------------------------------------------------------------------
    // Satır 2 — Admin, başkasının videosunu UPDATE (status=published) → BAŞARILI
    // ---------------------------------------------------------------------
    it("authz #2 / AC-S3 — admin, kendisine ait olmayan property'nin videosunu published yapabilir", async () => {
      const { data, error, status } = await adminClient
        .from("property_videos")
        .update({ status: "published", published_at: new Date().toISOString() })
        .eq("id", videoForAdminId)
        .select("id, status")
        .single<Pick<VideoRow, "id" | "status">>();

      expect(error).toBeNull();
      expect(status).toBe(200);
      expect(data?.status).toBe("published");

      // Son durum service_role ile doğrulanır (yazma testi kuralı)
      const { data: check } = await serviceClient
        .from("property_videos")
        .select("status")
        .eq("id", videoForAdminId)
        .single<Pick<VideoRow, "status">>();
      expect(check?.status).toBe("published");
    });

    // ---------------------------------------------------------------------
    // Satır 3 — Sahip-olmayan agent (B), propC'ye INSERT → RLS reddi, satır oluşmaz
    // ---------------------------------------------------------------------
    it("authz #3 / AC-S2 — sahip-olmayan agent (B) başkasının property'sine INSERT yapamaz, satır oluşmaz", async () => {
      const marker = `${propertyCId}/rls-b-${randomUUID()}.mp4`;

      const { error, status } = await agentBClient
        .from("property_videos")
        .insert({ property_id: propertyCId, storage_path: marker, status: "draft" })
        .select();

      expect(error).not.toBeNull();
      expect(error?.code).toBe("42501");
      expect([401, 403]).toContain(status);

      const { data: check, error: checkErr } = await serviceClient
        .from("property_videos")
        .select("id")
        .eq("storage_path", marker);
      expect(checkErr).toBeNull();
      expect(check).toEqual([]);
    });

    // ---------------------------------------------------------------------
    // Satır 4 — Sahip-olmayan agent (B), başkasının videosunu UPDATE → reddedilir
    // ---------------------------------------------------------------------
    it("authz #4 / AC-S2 — sahip-olmayan agent (B) başkasının videosunu güncelleyemez, veri değişmez", async () => {
      const { data, error, status } = await agentBClient
        .from("property_videos")
        .update({ status: "published", published_at: new Date().toISOString() })
        .eq("id", videoForBId)
        .select();

      // Reddin kendisi: ya hata (403/404) ya da 0 satır etkilendi.
      expect(error !== null || (data ?? []).length === 0).toBe(true);
      if (error) expect([403, 404]).toContain(status);

      // Asıl kanıt: service_role ile veri tekrar okunur, değişmemiş olmalı.
      const { data: check, error: checkErr } = await serviceClient
        .from("property_videos")
        .select("status, published_at")
        .eq("id", videoForBId)
        .single<Pick<VideoRow, "status" | "published_at">>();
      expect(checkErr).toBeNull();
      expect(check?.status).toBe("draft");
      expect(check?.published_at).toBeNull();
    });

    // ---------------------------------------------------------------------
    // Satır 5 — Sahip agent (C), KENDİ property'sine INSERT → BAŞARILI (regresyon)
    // ---------------------------------------------------------------------
    it("authz #5 / AC-1 regresyon — sahip agent (C) kendi property'sine INSERT yapabilir (mevcut owner policy)", async () => {
      const { data, error, status } = await agentCClient
        .from("property_videos")
        .insert({
          property_id: propertyCId,
          storage_path: `${propertyCId}/owner-${randomUUID()}.mp4`,
          status: "draft",
        })
        .select("id, property_id")
        .single<Pick<VideoRow, "id" | "property_id">>();

      expect(error).toBeNull();
      expect([200, 201]).toContain(status);
      expect(data?.property_id).toBe(propertyCId);

      if (data?.id) createdVideoIds.push(data.id);
    });

    // ---------------------------------------------------------------------
    // Satır 6 — anon key SELECT: 200 + [] (RLS sessizce filtreler, Supabase normal davranışı)
    // Kontrast: service_role satırı görür (length 1), anon aynı sorguda [] görür.
    // ---------------------------------------------------------------------
    it("authz #6 / AC-S2 — anon key property_videos SELECT -> 200+[] (RLS sessizce filtreler, Supabase normal davranışı)", async () => {
      // 1) Önce service_role ile satırın gerçekten var olduğunu kanıtla (boş sonucun veri yokluğundan değil RLS'ten geldiğini ayırt etmek için)
      const { data: exists, error: existsErr, status: existsStatus } = await serviceClient
        .from("property_videos")
        .select("id")
        .eq("id", videoForBId);
      expect(existsErr).toBeNull();
      expect(existsStatus).toBe(200);
      expect(exists).not.toBeNull();
      expect(exists).toHaveLength(1);

      // 2) Aynı sorgu anon key ile: hata yok, HTTP 200, veri boş dizi (null değil)
      const { data, error, status } = await anonClient
        .from("property_videos")
        .select("id")
        .eq("id", videoForBId);

      expect(error).toBeNull();
      expect(status).toBe(200);
      expect(data).not.toBeNull();
      expect(data).toEqual([]);
    });

    it("authz #6 / AC-S2 — anon key property_videos INSERT → reddedilir, satır oluşmaz", async () => {
      const marker = `${propertyCId}/anon-${randomUUID()}.mp4`;

      const { error, status } = await anonClient
        .from("property_videos")
        .insert({ property_id: propertyCId, storage_path: marker, status: "draft" })
        .select();

      expect(error).not.toBeNull();
      expect([401, 403]).toContain(status);

      const { data: check } = await serviceClient
        .from("property_videos")
        .select("id")
        .eq("storage_path", marker);
      expect(check).toEqual([]);
    });

    // ---------------------------------------------------------------------
    // Satır 7 — Admin, property-videos bucket'ına herhangi bir property önekiyle yazar
    // ---------------------------------------------------------------------
    it("authz #7 / AC-S3 — admin, property-videos bucket'ına başka bir property önekiyle dosya yükleyebilir", async () => {
      const objectPath = `${propertyCId}/admin-storage-${randomUUID()}.mp4`;
      createdStoragePaths.push(objectPath);

      const blob = new Blob([Buffer.from("fake-mp4-bytes")], { type: "video/mp4" });
      const { data, error } = await adminClient.storage
        .from(BUCKET)
        .upload(objectPath, blob, { contentType: "video/mp4" });

      expect(error).toBeNull();
      expect(data?.path).toBe(objectPath);

      // Dosya gerçekten Storage'da mı? (service_role ile liste)
      const fileName = objectPath.split("/").pop() as string;
      const { data: listed, error: listErr } = await serviceClient.storage
        .from(BUCKET)
        .list(propertyCId, { search: fileName });
      expect(listErr).toBeNull();
      expect(listed?.some((f) => f.name === fileName)).toBe(true);
    });

    // ---------------------------------------------------------------------
    // Satır 8 — Sahip-olmayan agent (B), property-videos bucket'ına yazamaz
    // ---------------------------------------------------------------------
    it("authz #8 / AC-S2 — sahip-olmayan agent (B) property-videos bucket'ına yazamaz, dosya oluşmaz", async () => {
      const objectPath = `${propertyCId}/b-storage-${randomUUID()}.mp4`;
      const fileName = objectPath.split("/").pop() as string;
      // Başarısız olsa bile temizlik için takip et (yanlışlıkla oluşursa silinsin)
      createdStoragePaths.push(objectPath);

      const blob = new Blob([Buffer.from("fake-mp4-bytes")], { type: "video/mp4" });
      const { error } = await agentBClient.storage
        .from(BUCKET)
        .upload(objectPath, blob, { contentType: "video/mp4" });

      expect(error).not.toBeNull();

      // Asıl kanıt: service_role ile Storage listesi kontrol edilir
      const { data: listed, error: listErr } = await serviceClient.storage
        .from(BUCKET)
        .list(propertyCId, { search: fileName });
      expect(listErr).toBeNull();
      expect(listed?.some((f) => f.name === fileName)).toBe(false);
    });
  },
);
