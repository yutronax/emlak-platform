"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/auth/requireAdmin";
import { createServiceRoleClient } from "@/lib/supabase/server";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Destek mesajını "işlendi" işaretler ya da geri alır. Yalnız admin; okuma/yazma servis rolüyle.
export async function setSupportHandled(id: string, handled: boolean): Promise<{ ok: boolean }> {
  if (typeof id !== "string" || !UUID_RE.test(id)) return { ok: false };
  const auth = await requireAdmin();
  if (!auth.ok) return { ok: false };

  const admin = createServiceRoleClient();
  const { error } = await admin
    .from("support_messages")
    .update({ handled_at: handled ? new Date().toISOString() : null })
    .eq("id", id);
  if (error) {
    console.error("support_messages güncellenemedi", error);
    return { ok: false };
  }
  revalidatePath("/admin/support");
  return { ok: true };
}
