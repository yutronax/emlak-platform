"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

export async function approveListing(formData: FormData): Promise<void> {
  const rawListingId = String(formData.get("raw_listing_id") ?? "");
  if (!rawListingId) return;

  const supabase = await createClient();
  // approve_raw_listing RPC'si SECURITY INVOKER çalışır: admin olmayan bir
  // kullanıcı buraya düşerse (örn. doğrudan POST), RLS policy'leri yine de
  // reddeder — asıl yetki kontrolü veritabanında, burada değil.
  const { error } = await supabase.rpc("approve_raw_listing", {
    p_raw_listing_id: rawListingId,
  });

  if (error) {
    throw new Error(`İlan onaylanamadı: ${error.message}`);
  }

  revalidatePath("/admin/listings");
}

export async function rejectListing(formData: FormData): Promise<void> {
  const rawListingId = String(formData.get("raw_listing_id") ?? "");
  if (!rawListingId) return;

  const supabase = await createClient();
  const { error } = await supabase.rpc("reject_raw_listing", {
    p_raw_listing_id: rawListingId,
  });

  if (error) {
    throw new Error(`İlan reddedilemedi: ${error.message}`);
  }

  revalidatePath("/admin/listings");
}
