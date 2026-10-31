"use server";

import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { isAllowedPushEndpoint, isValidKey } from "@/lib/push/endpoint";

/** AC-S7: bir emlakçının en fazla bu kadar cihaz satırı tutulur; fazlası en eskiden silinir. */
const MAX_DEVICES_PER_AGENT = 10;

export type PushActionResult =
  | { ok: true }
  | {
      ok: false;
      error: "unauthorized" | "invalid_endpoint" | "invalid_keys" | "save_failed" | "delete_failed";
    };

export type PushRegistrationStatusResult =
  | { ok: true; mine: boolean }
  | { ok: false; error: "unauthorized" | "invalid_endpoint" | "status_failed" };

export type SavePushSubscriptionInput = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
};

/**
 * Paylaşılan cihaz: bu endpoint oturumdaki kullanıcıya mı ait? RLS nedeniyle yalnız kendi
 * satırları görünür; başka agent'ın satırı için mine:false döner.
 */
export async function getPushRegistrationStatus(input: {
  endpoint: string;
}): Promise<PushRegistrationStatusResult> {
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  if (!authData?.user) return { ok: false, error: "unauthorized" };

  const endpoint = input?.endpoint;
  if (!isAllowedPushEndpoint(endpoint)) return { ok: false, error: "invalid_endpoint" };

  const { data, error } = await supabase
    .from("push_subscriptions")
    .select("id")
    .eq("endpoint", endpoint);
  if (error) {
    console.error("[push] status failed", { code: (error as { code?: string }).code });
    return { ok: false, error: "status_failed" };
  }
  return { ok: true, mine: (data ?? []).length > 0 };
}

/**
 * Bildirim aboneliğini kaydeder. agent_id istemciden alınmaz; oturumdaki kullanıcıdan gelir (AC-S1).
 * Endpoint aynı ise satır güncellenmez (ignore-duplicates): push_subscriptions'ta update policy yok.
 *
 * Paylaşılan cihaz: aynı endpoint başka bir agent'a aitse sahiplik devralınır. Endpoint + keys
 * sunabilmek cihaza sahip olmanın kanıtıdır. Service role yalnız bu tek `eq("endpoint")` silme için
 * kullanılır; RLS'in başka agent satırlarını görünmez kılması nedeniyle ayrı bir yol gerekir.
 */
export async function savePushSubscription(
  input: SavePushSubscriptionInput,
): Promise<PushActionResult> {
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  const user = authData?.user;
  if (!user) return { ok: false, error: "unauthorized" };

  const endpoint = input?.endpoint;
  if (!isAllowedPushEndpoint(endpoint)) return { ok: false, error: "invalid_endpoint" };

  const p256dh = input?.keys?.p256dh;
  const auth = input?.keys?.auth;
  if (!isValidKey(p256dh) || !isValidKey(auth)) return { ok: false, error: "invalid_keys" };

  // Sahiplik devri: aynı endpoint'in eski (başka agent) satırını kaldır. Yalnız endpoint eşleşmesi.
  const admin = createServiceRoleClient();
  const { error: releaseError } = await admin
    .from("push_subscriptions")
    .delete()
    .eq("endpoint", endpoint);
  if (releaseError) {
    console.error("[push] ownership release failed", { code: (releaseError as { code?: string }).code });
    return { ok: false, error: "save_failed" };
  }

  const { error: upsertError } = await supabase.from("push_subscriptions").upsert(
    { agent_id: user.id, endpoint, p256dh, auth },
    { onConflict: "endpoint", ignoreDuplicates: true },
  );
  if (upsertError) {
    console.error("[push] save failed", { code: (upsertError as { code?: string }).code });
    return { ok: false, error: "save_failed" };
  }

  // Cihaz üst sınırı (AC-S7). En yeni önce sıralanır; fazlası (en eski) silinir.
  const { data: rows, error: listError } = await supabase
    .from("push_subscriptions")
    .select("id, created_at")
    .eq("agent_id", user.id)
    .order("created_at", { ascending: false });
  if (listError) {
    // Kayıt başarılı; sınır temizliği bir sonraki kayıtta tekrar denenir.
    console.error("[push] device cap list failed", { code: (listError as { code?: string }).code });
    return { ok: true };
  }

  const excess = (rows ?? []).slice(MAX_DEVICES_PER_AGENT).map((r: { id: string }) => r.id);
  if (excess.length > 0) {
    const { error: deleteError } = await supabase
      .from("push_subscriptions")
      .delete()
      .in("id", excess);
    if (deleteError) {
      console.error("[push] device cap delete failed", { code: (deleteError as { code?: string }).code });
    }
  }

  return { ok: true };
}

/** Kapatma: yalnız oturumdaki kullanıcının o endpoint satırını siler. Satır yoksa da {ok:true}. */
export async function deletePushSubscription(input: {
  endpoint: string;
}): Promise<PushActionResult> {
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  const user = authData?.user;
  if (!user) return { ok: false, error: "unauthorized" };

  const endpoint = input?.endpoint;
  if (typeof endpoint !== "string" || endpoint.length === 0) {
    return { ok: false, error: "invalid_endpoint" };
  }

  const { error } = await supabase
    .from("push_subscriptions")
    .delete()
    .eq("endpoint", endpoint)
    .eq("agent_id", user.id);
  if (error) {
    console.error("[push] delete failed", { code: (error as { code?: string }).code });
    return { ok: false, error: "delete_failed" };
  }

  return { ok: true };
}
