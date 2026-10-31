"use server";

import { createClient } from "@/lib/supabase/server";
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

export async function requestWaAction(action: string): Promise<WaActionResult> {
  if (!(ACTIONS as readonly string[]).includes(action)) {
    return { ok: false, error: "invalid_action" };
  }
  const supabase = await createClient();
  return requestWaActionRpc(supabase, action as (typeof ACTIONS)[number]);
}

export async function acceptWaConsent(version: string): Promise<WaConsentResult> {
  if (typeof version !== "string" || version.length === 0 || version.length > 32) {
    return { ok: false, error: "invalid_version" };
  }
  const supabase = await createClient();
  return acceptWaConsentRpc(supabase, version);
}
