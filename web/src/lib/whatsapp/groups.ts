import type { SupabaseClient } from "@supabase/supabase-js";

// EML-107 Davranış Sözleşmesi: get_my_wa_groups / set_my_wa_group_selection.
// RPC sarmalayıcıları agent_id ALMAZ (AC-S1/AC-S2): kimlik her zaman auth.uid() ile.

export type WaGroup = { jid: string; name: string | null; selected: boolean };

export type WaGroupsOk = {
  ok: true;
  status: string;
  groups: WaGroup[];
  max: number;
  groups_synced_at: string | null;
};

export type WaGroupsResult = WaGroupsOk | { ok: false; error: string };

export type WaSetGroupsResult = { ok: true; selected: number } | { ok: false; error: string };

type RawRecord = Record<string, unknown>;

function asRecord(raw: unknown): RawRecord {
  return raw !== null && typeof raw === "object" ? (raw as RawRecord) : {};
}

function parseGroups(raw: unknown): WaGroup[] {
  if (!Array.isArray(raw)) return [];
  const groups: WaGroup[] = [];
  for (const item of raw) {
    const r = asRecord(item);
    if (typeof r.jid !== "string") continue;
    groups.push({
      jid: r.jid,
      name: typeof r.name === "string" ? r.name : null,
      selected: r.selected === true,
    });
  }
  return groups;
}

/** Kendi WhatsApp gruplarım (get_my_wa_groups). */
export async function getMyWaGroups(supabase: SupabaseClient): Promise<WaGroupsResult> {
  try {
    const { data, error } = await supabase.rpc("get_my_wa_groups");
    if (error) return { ok: false, error: "rpc_failed" };
    const r = asRecord(data);
    if (r.ok !== true) {
      return { ok: false, error: typeof r.error === "string" ? r.error : "rpc_failed" };
    }
    return {
      ok: true,
      status: typeof r.status === "string" ? r.status : "none",
      groups: parseGroups(r.groups),
      max: typeof r.max === "number" ? r.max : 20,
      groups_synced_at: typeof r.groups_synced_at === "string" ? r.groups_synced_at : null,
    };
  } catch {
    return { ok: false, error: "rpc_failed" };
  }
}

/** Okunacak grup seçimini tamamen değiştirir (set_my_wa_group_selection). */
export async function setMyWaGroupSelection(
  supabase: SupabaseClient,
  jids: string[],
): Promise<WaSetGroupsResult> {
  try {
    const { data, error } = await supabase.rpc("set_my_wa_group_selection", {
      p_group_jids: jids,
    });
    if (error) return { ok: false, error: "rpc_failed" };
    const r = asRecord(data);
    if (r.ok === true) {
      return { ok: true, selected: typeof r.selected === "number" ? r.selected : 0 };
    }
    return { ok: false, error: typeof r.error === "string" ? r.error : "rpc_failed" };
  } catch {
    return { ok: false, error: "rpc_failed" };
  }
}
