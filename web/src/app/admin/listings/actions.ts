"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireAdmin } from "@/lib/auth/requireAdmin";

export async function approveListing(formData: FormData): Promise<void> {
  const rawListingId = String(formData.get("raw_listing_id") ?? "");
  if (!rawListingId) return;

  // Uygulama seviyesi admin kontrolü — RPC'den ÖNCE. RLS/SECURITY INVOKER
  // ikinci katman olarak kalır (defense-in-depth).
  const auth = await requireAdmin();
  if (!auth.ok) {
    if (auth.reason === "no-session") {
      redirect("/login");
    }
    throw new Error("Bu işlem için yetkiniz yok");
  }
  const { supabase } = auth;

  const { error } = await supabase.rpc("approve_raw_listing", {
    p_raw_listing_id: rawListingId,
  });

  if (error) {
    console.error("İlan onaylanamadı", error);
    throw new Error("İlan onaylanamadı, lütfen tekrar deneyin");
  }

  revalidatePath("/admin/listings");
}

// EML-107 AC-7 / AC-S5: eşik yalnız admin RPC'siyle değişir. Yetki kontrolü RPC'den önce;
// RPC de kendi içinde admin doğrular (defense-in-depth).
export async function setPersonalThreshold(
  value: number,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 1) {
    return { ok: false, error: "invalid_value" };
  }

  const auth = await requireAdmin();
  if (!auth.ok) {
    if (auth.reason === "no-session") {
      redirect("/login");
    }
    return { ok: false, error: "forbidden" };
  }
  const { supabase } = auth;

  const { data, error } = await supabase.rpc("admin_set_threshold", { p_threshold: value });
  if (error) {
    console.error("eşik güncellenemedi", error);
    return { ok: false, error: "rpc_failed" };
  }
  const result = (data ?? {}) as { ok?: boolean; error?: string };
  if (result.ok === true) {
    revalidatePath("/admin/listings");
    return { ok: true };
  }
  return { ok: false, error: typeof result.error === "string" ? result.error : "rpc_failed" };
}

export async function rejectListing(formData: FormData): Promise<void> {
  const rawListingId = String(formData.get("raw_listing_id") ?? "");
  if (!rawListingId) return;

  const auth = await requireAdmin();
  if (!auth.ok) {
    if (auth.reason === "no-session") {
      redirect("/login");
    }
    throw new Error("Bu işlem için yetkiniz yok");
  }
  const { supabase } = auth;

  const { error } = await supabase.rpc("reject_raw_listing", {
    p_raw_listing_id: rawListingId,
  });

  if (error) {
    console.error("İlan reddedilemedi", error);
    throw new Error("İlan reddedilemedi, lütfen tekrar deneyin");
  }

  revalidatePath("/admin/listings");
}
