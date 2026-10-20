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
