import { beforeEach, describe, expect, it, vi } from "vitest";

import { createClient } from "@/lib/supabase/server";

import {
  changePassword,
  confirmLogo,
  createLogoUpload,
  loadProfile,
  removeLogo,
  requestEmailChange,
  signOutProfile,
  updateCompany,
  updateNotifications,
  updateWhatsapp,
} from "./actions";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
}));

const UID = "11111111-1111-1111-1111-111111111111";
const ROW = {
  company_name: "Acme Emlak",
  contact_name: "Ayşe Yılmaz",
  city: "İzmir",
  district: "Bornova",
  phone: "5321234567",
  logo_path: null as string | null,
  notify_new_listing_push: true,
  notify_new_listing_email: false,
  notify_video_order_email: true,
  notify_weekly_summary_email: false,
};

type Opts = { row?: Partial<typeof ROW> | null; user?: Record<string, unknown> | null; updateError?: unknown };

// Zincirlenebilir sahte Supabase istemcisi: agents select/update, storage, auth.
function setup(opts: Opts = {}) {
  const row = opts.row === null ? null : { ...ROW, ...opts.row };
  const user =
    opts.user === null ? null : { id: UID, email: "ayse@acme.com", new_email: null, ...(opts.user ?? {}) };
  const update = vi.fn(() => ({ eq: vi.fn(async () => ({ error: opts.updateError ?? null })) }));
  const maybeSingle = vi.fn(async () => ({ data: row, error: null }));
  const from = vi.fn(() => ({
    select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle })) })),
    update,
  }));
  const bucket = {
    createSignedUrl: vi.fn(async () => ({ data: { signedUrl: "https://cdn.test/logo?sig" }, error: null })),
    createSignedUploadUrl: vi.fn(async () => ({ data: { signedUrl: "https://up.test/put", token: "t" }, error: null })),
    list: vi.fn(async () => ({ data: [{ name: "logo.png" }], error: null })),
    remove: vi.fn(async () => ({ data: [], error: null })),
  };
  const storage = { from: vi.fn(() => bucket) };
  const auth = {
    getUser: vi.fn(async () => ({ data: { user }, error: null })),
    signInWithPassword: vi.fn(async () => ({ data: {}, error: null })),
    updateUser: vi.fn(async () => ({ data: {}, error: null })),
    signOut: vi.fn(async () => ({ error: null })),
  };
  vi.mocked(createClient).mockResolvedValue({ from, storage, auth } as never);
  return { from, update, bucket, storage, auth };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://emlak.example.com");
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("loadProfile", () => {
  it("satırı UI modeline çevirir: telefon +90, boş alanlar '', bildirimler", async () => {
    setup();

    expect(await loadProfile()).toEqual({
      status: "ok",
      profile: {
        companyName: "Acme Emlak",
        contactName: "Ayşe Yılmaz",
        city: "İzmir",
        district: "Bornova",
        logoUrl: null,
        email: "ayse@acme.com",
        pendingEmail: null,
        whatsappPhone: "+905321234567",
        notifications: { newListingPush: true, newListingEmail: false, videoOrderEmail: true, weeklySummaryEmail: false },
      },
    });
  });

  it("logo varsa imzalı URL; bekleyen e-posta değişikliği new_email'den", async () => {
    const { bucket } = setup({ row: { logo_path: `${UID}/logo.png` }, user: { new_email: "yeni@acme.com" } });

    const res = await loadProfile();
    expect(res.status === "ok" && res.profile.logoUrl).toBe("https://cdn.test/logo?sig");
    expect(res.status === "ok" && res.profile.pendingEmail).toBe("yeni@acme.com");
    expect(bucket.createSignedUrl).toHaveBeenCalledWith(`${UID}/logo.png`, 3600);
  });

  it("oturum yoksa veya satır yoksa error", async () => {
    setup({ user: null });
    expect(await loadProfile()).toEqual({ status: "error" });
    setup({ row: null });
    expect(await loadProfile()).toEqual({ status: "error" });
  });
});

describe("updateCompany", () => {
  it("doğrular, kırpar ve yalnız kendi satırını günceller", async () => {
    const { update } = setup();

    const res = await updateCompany({ companyName: " Yeni Emlak ", contactName: "Mehmet Kaya", city: "İzmir", district: "" });

    expect(update).toHaveBeenCalledWith({
      company_name: "Yeni Emlak",
      contact_name: "Mehmet Kaya",
      city: "İzmir",
      district: null,
    });
    expect(res.status).toBe("ok");
  });

  it("geçersiz girişte veritabanına gitmez, alanlı hata döner", async () => {
    const { update } = setup();

    expect(await updateCompany({ companyName: "A", contactName: "Mehmet", city: "İzmir", district: "" })).toMatchObject({
      status: "error",
      code: "invalid",
      field: "companyName",
    });
    expect(update).not.toHaveBeenCalled();
  });

  it("veritabanı hatası network olarak döner, ayrıntı sızmaz", async () => {
    setup({ updateError: { code: "42501", message: "permission denied for column x" } });

    const res = await updateCompany({ companyName: "Acme", contactName: "Mehmet", city: "İzmir", district: "" });
    expect(res).toEqual({ status: "error", code: "network" });
  });
});

describe("updateWhatsapp", () => {
  it("+90 biçimini veritabanındaki 10 haneye çevirir", async () => {
    const { update } = setup();

    await updateWhatsapp("+905551112233");
    expect(update).toHaveBeenCalledWith({ phone: "5551112233" });
  });

  it("geçersiz numarayı reddeder", async () => {
    const { update } = setup();

    expect(await updateWhatsapp("+902121234567")).toMatchObject({ status: "error", field: "whatsappPhone" });
    expect(update).not.toHaveBeenCalled();
  });
});

describe("logo", () => {
  it("yükleme adresi yalnız kullanıcının klasöründe ve izinli tipte üretilir", async () => {
    const { bucket } = setup();

    const res = await createLogoUpload("image/webp", 1000);
    expect(res).toEqual({ status: "ok", path: `${UID}/logo.webp`, uploadUrl: "https://up.test/put" });
    expect(bucket.createSignedUploadUrl).toHaveBeenCalledWith(`${UID}/logo.webp`, { upsert: true });

    expect(await createLogoUpload("image/gif", 1000)).toMatchObject({ status: "error", code: "unsupported_type" });
    expect(await createLogoUpload("image/png", 3 * 1024 * 1024)).toMatchObject({ status: "error", code: "too_large" });
  });

  it("onayda başkasının yolu reddedilir; kendi yolu kaydedilir", async () => {
    const { update } = setup();

    expect(await confirmLogo("22222222-2222-2222-2222-222222222222/logo.png")).toMatchObject({
      status: "error",
      code: "invalid",
    });
    expect(update).not.toHaveBeenCalled();

    await confirmLogo(`${UID}/logo.png`);
    expect(update).toHaveBeenCalledWith({ logo_path: `${UID}/logo.png` });
  });

  it("kaldırınca depodaki dosyalar silinir ve yol boşaltılır", async () => {
    const { update, bucket } = setup({ row: { logo_path: `${UID}/logo.png` } });

    await removeLogo();
    expect(bucket.remove).toHaveBeenCalledWith([`${UID}/logo.png`]);
    expect(update).toHaveBeenCalledWith({ logo_path: null });
  });
});

describe("hesap güvenliği", () => {
  it("e-posta değişikliği onay bağlantısıyla istenir", async () => {
    const { auth } = setup();

    await requestEmailChange("yeni@acme.com");
    expect(auth.updateUser).toHaveBeenCalledWith(
      { email: "yeni@acme.com" },
      { emailRedirectTo: "https://emlak.example.com/auth/callback?next=/account/profile" },
    );
  });

  it("aynı e-posta reddedilir", async () => {
    const { auth } = setup();

    expect(await requestEmailChange("AYSE@acme.com")).toMatchObject({ status: "error", field: "newEmail" });
    expect(auth.updateUser).not.toHaveBeenCalled();
  });

  it("mevcut şifre yanlışsa yeni şifre yazılmaz", async () => {
    const { auth } = setup();
    auth.signInWithPassword.mockResolvedValueOnce({ data: {}, error: { message: "Invalid login credentials" } } as never);

    expect(await changePassword({ current: "yanlis123", next: "Yeni12345" })).toEqual({
      status: "error",
      code: "wrong_password",
      field: "current",
    });
    expect(auth.updateUser).not.toHaveBeenCalled();
  });

  it("mevcut şifre doğruysa yeni şifre yazılır", async () => {
    const { auth } = setup();

    const res = await changePassword({ current: "eski1234", next: "Yeni12345" });
    expect(auth.signInWithPassword).toHaveBeenCalledWith({ email: "ayse@acme.com", password: "eski1234" });
    expect(auth.updateUser).toHaveBeenCalledWith({ password: "Yeni12345" });
    expect(res.status).toBe("ok");
  });

  it("zayıf yeni şifre sunucuda da reddedilir", async () => {
    const { auth } = setup();

    expect(await changePassword({ current: "eski1234", next: "abc" })).toMatchObject({ status: "error", field: "next" });
    expect(auth.signInWithPassword).not.toHaveBeenCalled();
  });

  it("bildirim tercihleri sütunlara yazılır", async () => {
    const { update } = setup();

    await updateNotifications({ newListingPush: false, newListingEmail: true, videoOrderEmail: true, weeklySummaryEmail: true });
    expect(update).toHaveBeenCalledWith({
      notify_new_listing_push: false,
      notify_new_listing_email: true,
      notify_video_order_email: true,
      notify_weekly_summary_email: true,
    });
  });

  it("tüm cihazlardan çıkış global kapsamla yapılır ve girişe döner", async () => {
    const { auth } = setup();

    expect(await signOutProfile("all")).toEqual({ status: "ok", redirectTo: "/login" });
    expect(auth.signOut).toHaveBeenCalledWith({ scope: "global" });
  });
});
