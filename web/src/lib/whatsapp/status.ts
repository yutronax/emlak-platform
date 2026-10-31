import type { SupabaseClient } from "@supabase/supabase-js";

// EML-106 / EML-104 Davranış Sözleşmesi. RPC sarmalayıcıları agent_id ALMAZ (AC-S1):
// kimlik her zaman oturumdan (auth.uid()) gelir. Hata durumunda {ok:false,error:'rpc_failed'}.

/** AC-1: onay metninin sürümü; accept_wa_consent RPC'si ile birebir aynı olmalı. */
export const WA_CONSENT_VERSION = "2026-10";

export type WaStatusView =
  | { status: "none" }
  | { status: "pending" }
  | { status: "qr"; qr: string; qr_expires_at: string | null }
  | { status: "connected"; phone_masked: string | null }
  | { status: "disconnected"; error_code: string | null }
  | { status: "logged_out" }
  | { status: "error"; error_code: string | null };

export type WaStatusResult = ({ ok: true } & WaStatusView) | { ok: false; error: "rpc_failed" };

export type WaActionResult = { ok: true; status: string } | { ok: false; error: string };

export type WaConsentResult = { ok: true } | { ok: false; error: string };

type RawRecord = Record<string, unknown>;

function asString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

// Yalnız bilinen alanları kopyalar: qr yalnız status='qr' iken taşınır (AC-S2).
function parseView(raw: unknown): WaStatusView {
  const r: RawRecord = raw !== null && typeof raw === "object" ? (raw as RawRecord) : {};
  switch (r.status) {
    case "pending":
      return { status: "pending" };
    case "qr": {
      const qr = asString(r.qr);
      // QR yoksa (süre dolmuş ya da henüz yok) bekleme durumuna düşülür; poll devam eder.
      if (qr === null) return { status: "pending" };
      return { status: "qr", qr, qr_expires_at: asString(r.qr_expires_at) };
    }
    case "connected":
      return { status: "connected", phone_masked: asString(r.phone_masked) };
    case "disconnected":
      return { status: "disconnected", error_code: asString(r.error_code) };
    case "logged_out":
      return { status: "logged_out" };
    case "error":
      return { status: "error", error_code: asString(r.error_code) };
    default:
      return { status: "none" };
  }
}

/** Kendi WhatsApp bağlantı durumum (get_my_wa_status). */
export async function getMyWaStatus(supabase: SupabaseClient): Promise<WaStatusResult> {
  try {
    const { data, error } = await supabase.rpc("get_my_wa_status");
    if (error) return { ok: false, error: "rpc_failed" };
    return { ok: true, ...parseView(data) };
  } catch {
    return { ok: false, error: "rpc_failed" };
  }
}

/** connect / disconnect isteği (request_wa_action). Yalnız action adı gider. */
export async function requestWaAction(
  supabase: SupabaseClient,
  action: "connect" | "disconnect",
): Promise<WaActionResult> {
  try {
    const { data, error } = await supabase.rpc("request_wa_action", { p_action: action });
    if (error) return { ok: false, error: "rpc_failed" };
    const r = (data !== null && typeof data === "object" ? data : {}) as RawRecord;
    if (r.ok === true) {
      return { ok: true, status: typeof r.status === "string" ? r.status : "pending" };
    }
    return { ok: false, error: typeof r.error === "string" ? r.error : "rpc_failed" };
  } catch {
    return { ok: false, error: "rpc_failed" };
  }
}

/** Ban riski onayı (accept_wa_consent). Sürüm ve zaman sunucuda kaydedilir (AC-S7). */
export async function acceptWaConsent(
  supabase: SupabaseClient,
  version: string,
): Promise<WaConsentResult> {
  try {
    const { data, error } = await supabase.rpc("accept_wa_consent", { p_version: version });
    if (error) return { ok: false, error: "rpc_failed" };
    const r = (data !== null && typeof data === "object" ? data : {}) as RawRecord;
    if (r.ok === true) return { ok: true };
    return { ok: false, error: typeof r.error === "string" ? r.error : "rpc_failed" };
  } catch {
    return { ok: false, error: "rpc_failed" };
  }
}
