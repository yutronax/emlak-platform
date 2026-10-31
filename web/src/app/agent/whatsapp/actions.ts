"use server";

import { createClient } from "@/lib/supabase/server";
import {
  getMyWaGroups as getMyWaGroupsRpc,
  setMyWaGroupSelection as setMyWaGroupSelectionRpc,
  type WaGroupsResult,
  type WaSetGroupsResult,
} from "@/lib/whatsapp/groups";
import {
  acceptWaConsent as acceptWaConsentRpc,
  getMyWaStatus as getMyWaStatusRpc,
  requestWaAction as requestWaActionRpc,
  type WaConsentResult,
  type WaActionResult,
  type WaStatusResult,
} from "@/lib/whatsapp/status";

// EML-106. Oturumlu istemci; agent_id hiçbir yerden alınmaz (AC-S1). Kimlik RPC içinde auth.uid().

const ACTIONS = ["connect", "disconnect"] as const;

export async function getMyWaStatus(): Promise<WaStatusResult> {
  const supabase = await createClient();
  return getMyWaStatusRpc(supabase);
}

// EML-107 AC-12: "bağlantıyı kaldır" (disconnect) = bağlantıyı kes + verilerimi sil.
// Önce bağlantı kesme isteği gider; ardından delete_my_wa_data çağrılır. Silme başarısızsa
// (hata ya da throw) başarı bildirilmez: sessiz başarı yasak.
// request_wa_action DB'de bağlantıyı 'disconnect' olarak işaretler. Bağlantı zaten kesikse
// (not_connected) silme yine çağrılır: önceki denemede silme başarısız olduysa yeniden denemede
// veri temizlenebilsin. Diğer hatalarda (rpc_failed, unauthorized vb.) silme çağrılmaz.
export async function requestWaAction(action: string): Promise<WaActionResult> {
  if (!(ACTIONS as readonly string[]).includes(action)) {
    return { ok: false, error: "invalid_action" };
  }
  const supabase = await createClient();
  const result = await requestWaActionRpc(supabase, action as (typeof ACTIONS)[number]);
  if (action !== "disconnect") return result;
  if (!result.ok && result.error !== "not_connected") return result;

  try {
    const { data, error } = await supabase.rpc("delete_my_wa_data");
    if (error) return { ok: false, error: "rpc_failed" };
    const r = (data !== null && typeof data === "object" ? data : {}) as { ok?: unknown };
    if (r.ok !== true) return { ok: false, error: "rpc_failed" };
  } catch {
    return { ok: false, error: "rpc_failed" };
  }
  return result.ok ? result : { ok: true, status: "disconnected" };
}

export async function acceptWaConsent(version: string): Promise<WaConsentResult> {
  if (typeof version !== "string" || version.length === 0 || version.length > 32) {
    return { ok: false, error: "invalid_version" };
  }
  const supabase = await createClient();
  return acceptWaConsentRpc(supabase, version);
}

// EML-109: bağlantı kurulduktan sonra sidecar grup senkronunu tamamlayınca liste poll ile okunur.
export async function getMyWaGroupsAction(): Promise<WaGroupsResult> {
  const supabase = await createClient();
  return getMyWaGroupsRpc(supabase);
}

// EML-107 AC-2: yalnız JID dizisi gider; üst sınır (20) ve JID doğrulaması RPC'de.
export async function setMyWaGroupSelection(jids: string[]): Promise<WaSetGroupsResult> {
  if (
    !Array.isArray(jids) ||
    !jids.every((jid) => typeof jid === "string" && jid.length > 0 && jid.length <= 200)
  ) {
    return { ok: false, error: "invalid_input" };
  }
  const supabase = await createClient();
  return setMyWaGroupSelectionRpc(supabase, jids);
}
