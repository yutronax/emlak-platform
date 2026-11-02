"use server";

import { normalizeTrPhone } from "@/lib/auth-ui/phone";
import { checkPassword } from "@/lib/auth-ui/password-strength";
import type { CompanyInput, NotificationPrefs, Profile, SaveError, SaveResult } from "@/lib/profile-ui/types";
import { LOGO_MAX_BYTES, LOGO_TYPES, validateCompany, validateEmailChange } from "@/lib/profile-ui/validation";
import { createClient } from "@/lib/supabase/server";

// Gerçek profil servisi (kullanici-profili/frontend_contract.md). Yetki RLS + 0026 sütun grant'leriyle;
// her sorgu ayrıca auth.uid() satırına sınırlı. Veritabanı hata ayrıntısı istemciye dönmez.

const BUCKET = "agent-logos";
const COLUMNS =
  "company_name, contact_name, city, district, phone, logo_path, notify_new_listing_push, notify_new_listing_email, notify_video_order_email, notify_weekly_summary_email";

type Row = {
  company_name: string;
  contact_name: string | null;
  city: string | null;
  district: string | null;
  phone: string | null;
  logo_path: string | null;
  notify_new_listing_push: boolean;
  notify_new_listing_email: boolean;
  notify_video_order_email: boolean;
  notify_weekly_summary_email: boolean;
};

const NETWORK: SaveError = { status: "error", code: "network" };
const invalid = (field: string, message: string): SaveError => ({ status: "error", code: "invalid", field, message });

async function session() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  return { supabase, user: data.user };
}

export async function loadProfile(): Promise<{ status: "ok"; profile: Profile } | { status: "error" }> {
  const { supabase, user } = await session();
  if (!user) return { status: "error" };

  const { data, error } = await supabase.from("agents").select(COLUMNS).eq("id", user.id).maybeSingle();
  const row = data as Row | null;
  if (error || !row) {
    if (error) console.error("profile_load_failed", { code: error.code });
    return { status: "error" };
  }

  let logoUrl: string | null = null;
  if (row.logo_path) {
    const { data: signed } = await supabase.storage.from(BUCKET).createSignedUrl(row.logo_path, 3600);
    logoUrl = signed?.signedUrl ?? null;
  }

  return {
    status: "ok",
    profile: {
      companyName: row.company_name,
      contactName: row.contact_name ?? "",
      city: row.city ?? "",
      district: row.district ?? "",
      logoUrl,
      email: user.email ?? "",
      pendingEmail: (user as { new_email?: string | null }).new_email ?? null,
      whatsappPhone: row.phone ? `+90${row.phone}` : null,
      notifications: {
        newListingPush: row.notify_new_listing_push,
        newListingEmail: row.notify_new_listing_email,
        videoOrderEmail: row.notify_video_order_email,
        weeklySummaryEmail: row.notify_weekly_summary_email,
      },
    },
  };
}

// Kendi satırını günceller, ardından güncel profili döner.
async function patch(values: Partial<Row>): Promise<SaveResult> {
  const { supabase, user } = await session();
  if (!user) return NETWORK;
  const { error } = await supabase.from("agents").update(values).eq("id", user.id);
  if (error) {
    console.error("profile_update_failed", { code: (error as { code?: string }).code });
    return NETWORK;
  }
  const res = await loadProfile();
  return res.status === "ok" ? res : NETWORK;
}

export async function updateCompany(input: CompanyInput): Promise<SaveResult> {
  const errors = validateCompany(input);
  const first = (Object.keys(errors) as (keyof CompanyInput)[])[0];
  if (first) return invalid(first, errors[first]!);
  return patch({
    company_name: input.companyName.trim(),
    contact_name: input.contactName.trim(),
    city: input.city.trim(),
    district: input.district.trim() || null,
  });
}

export async function updateWhatsapp(phone: string): Promise<SaveResult> {
  const normalized = normalizeTrPhone(phone);
  if (!normalized) return invalid("whatsappPhone", "Geçerli bir cep telefonu girin (5xx xxx xx xx).");
  // Veritabanında +90'sız 10 hane (0026 agents_phone_format).
  return patch({ phone: normalized.slice(3) });
}

export async function updateNotifications(prefs: NotificationPrefs): Promise<SaveResult> {
  return patch({
    notify_new_listing_push: prefs.newListingPush,
    notify_new_listing_email: prefs.newListingEmail,
    notify_video_order_email: prefs.videoOrderEmail,
    notify_weekly_summary_email: prefs.weeklySummaryEmail,
  });
}

// Logo: sunucu işlemi gövde sınırına (1 MB) takılmamak için tarayıcı imzalı adrese doğrudan yükler.
export async function createLogoUpload(
  type: string,
  size: number,
): Promise<{ status: "ok"; path: string; uploadUrl: string } | SaveError> {
  if (!LOGO_TYPES.includes(type)) return { status: "error", code: "unsupported_type" };
  if (size > LOGO_MAX_BYTES) return { status: "error", code: "too_large" };
  const { supabase, user } = await session();
  if (!user) return NETWORK;

  const ext = type === "image/jpeg" ? "jpg" : type.split("/")[1];
  const path = `${user.id}/logo.${ext}`;
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUploadUrl(path, { upsert: true });
  if (error || !data) return NETWORK;
  return { status: "ok", path, uploadUrl: data.signedUrl };
}

export async function confirmLogo(path: string): Promise<SaveResult> {
  const { user } = await session();
  if (!user) return NETWORK;
  // Yalnız kendi klasörü ve beklenen dosya adı (0026 agents_logo_path_owner ile aynı kural).
  if (!new RegExp(`^${user.id}/logo\\.(png|jpg|webp)$`).test(path)) return invalid("logo", "Geçersiz dosya.");
  return patch({ logo_path: path });
}

export async function removeLogo(): Promise<SaveResult> {
  const { supabase, user } = await session();
  if (!user) return NETWORK;
  const { data } = await supabase.from("agents").select("logo_path").eq("id", user.id).maybeSingle();
  const current = (data as { logo_path: string | null } | null)?.logo_path;
  if (current) await supabase.storage.from(BUCKET).remove([current]);
  return patch({ logo_path: null });
}

export async function requestEmailChange(newEmail: string): Promise<SaveResult> {
  const { supabase, user } = await session();
  if (!user) return NETWORK;
  const problem = validateEmailChange(newEmail, user.email ?? "");
  if (problem) return invalid("newEmail", problem);

  const { error } = await supabase.auth.updateUser(
    { email: newEmail.trim() },
    // Onay bağlantısı profile döner; adres sunucu sabitinden (AC-S5).
    { emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback?next=/account/profile` },
  );
  if (error) {
    if ((error as { status?: number }).status === 429) {
      return { status: "error", code: "unknown", message: "Çok fazla deneme. Biraz sonra tekrar deneyin." };
    }
    // Adresin başka hesapta kayıtlı olduğu açıklanmaz.
    return { status: "error", code: "unknown", message: "E-posta değiştirilemedi. Adresi kontrol edip tekrar deneyin." };
  }
  const res = await loadProfile();
  if (res.status !== "ok") return NETWORK;
  return { status: "ok", profile: { ...res.profile, pendingEmail: res.profile.pendingEmail ?? newEmail.trim() } };
}

export async function changePassword(input: { current: string; next: string }): Promise<SaveResult> {
  if (!checkPassword(input.next).acceptable) return invalid("next", "Daha güçlü bir şifre seçin.");
  if (input.next === input.current) return invalid("next", "Yeni şifre mevcut şifreden farklı olmalı.");

  const { supabase, user } = await session();
  if (!user?.email) return NETWORK;
  // Mevcut şifre doğrulanmadan yeni şifre yazılmaz (oturum çalınmasına karşı).
  const { error: authError } = await supabase.auth.signInWithPassword({ email: user.email, password: input.current });
  if (authError) return { status: "error", code: "wrong_password", field: "current" };

  const { error } = await supabase.auth.updateUser({ password: input.next });
  if (error) return { status: "error", code: "unknown", message: "Şifre güncellenemedi. Tekrar deneyin." };
  const res = await loadProfile();
  return res.status === "ok" ? res : NETWORK;
}

export async function signOutProfile(scope: "this" | "all"): Promise<{ status: "ok"; redirectTo: string } | SaveError> {
  const supabase = await createClient();
  const { error } = await supabase.auth.signOut({ scope: scope === "all" ? "global" : "local" });
  if (error) console.error("profile_signout_failed", { scope });
  // Hata olsa da kullanıcı çıkmak istedi; girişe gönderilir.
  return { status: "ok", redirectTo: "/login" };
}
