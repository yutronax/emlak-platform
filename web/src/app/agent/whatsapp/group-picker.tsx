"use client";

import { useState } from "react";

import { Alert } from "@/components/ui/alert";
import type { WaGroupsOk, WaSetGroupsResult } from "@/lib/whatsapp/groups";

// EML-107 AC-1, AC-2, AC-10. Yalnız seçim UI'ı; kaydetme onSave prop'undan (server action) gelir.
// Bağlantı connected değilse liste salt-okunur ve "Yeniden bağlan" uyarısı gösterilir.

const SAVE_ERROR_MESSAGES: Partial<Record<string, string>> = {
  too_many: "En fazla 20 grup",
  unknown_group: "Liste güncel değil, yenile",
  unauthorized: "Oturumunuz sona erdi, tekrar giriş yapın.",
};
const DEFAULT_SAVE_ERROR = "Kaydedilemedi, tekrar deneyin.";

type Notice = { kind: "ok" | "error"; text: string } | null;

export type GroupPickerProps = {
  initial: WaGroupsOk;
  onSave: (jids: string[]) => Promise<WaSetGroupsResult>;
};

export function GroupPicker({ initial, onSave }: GroupPickerProps) {
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(initial.groups.filter((g) => g.selected).map((g) => g.jid)),
  );
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  // Kaydetmede not_connected dönerse, sayfa yenilenene kadar salt-okunur kalır.
  const [notConnected, setNotConnected] = useState(false);

  const readonly = initial.status !== "connected" || notConnected;

  if (initial.status === "none") {
    return (
      <section aria-labelledby="wa-groups-title" className="max-w-xl space-y-4">
        <h2 id="wa-groups-title" className="text-lg font-semibold text-ink-900">
          Grup seçimi
        </h2>
        <p className="text-sm text-ink-900">{"Önce WhatsApp'ını bağla"}</p>
      </section>
    );
  }

  const awaitingSync = initial.groups.length === 0 && initial.groups_synced_at === null;

  function toggle(jid: string) {
    setNotice(null);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(jid)) next.delete(jid);
      else if (next.size < initial.max) next.add(jid);
      return next;
    });
  }

  async function handleSave() {
    const jids = initial.groups.filter((g) => selected.has(g.jid)).map((g) => g.jid);
    setBusy(true);
    setNotice(null);
    const res = await onSave(jids);
    setBusy(false);
    if (res.ok) {
      setNotice(
        res.selected === 0
          ? { kind: "ok", text: "Hiçbir grup okunmuyor" }
          : { kind: "ok", text: "Kaydedildi" },
      );
      return;
    }
    if (res.error === "not_connected") {
      setNotConnected(true);
      return;
    }
    setNotice({ kind: "error", text: SAVE_ERROR_MESSAGES[res.error] ?? DEFAULT_SAVE_ERROR });
  }

  const primaryButton =
    "rounded-md bg-terracotta-700 px-4 py-2 text-sm font-medium text-white hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-900 disabled:opacity-50";

  return (
    <section aria-labelledby="wa-groups-title" className="max-w-xl space-y-4">
      <h2 id="wa-groups-title" className="text-lg font-semibold text-ink-900">
        Grup seçimi
      </h2>

      {readonly && (
        <Alert variant="error">
          <p>
            WhatsApp bağlantınız aktif değil; grup seçimi salt okunur. <strong>Yeniden bağlan</strong>
          </p>
        </Alert>
      )}

      {awaitingSync ? (
        <p className="text-sm text-slate-500">Gruplar yükleniyor…</p>
      ) : (
        <>
          <p className="text-sm text-slate-500">{`${selected.size}/${initial.max}`}</p>
          <ul className="space-y-2">
            {initial.groups.map((group) => {
              const checked = selected.has(group.jid);
              const full = !checked && selected.size >= initial.max;
              return (
                <li key={group.jid}>
                  <label className="flex items-start gap-2 text-sm text-ink-900">
                    <input
                      type="checkbox"
                      className="mt-1 h-4 w-4 shrink-0"
                      checked={checked}
                      disabled={readonly || busy || full}
                      onChange={() => toggle(group.jid)}
                    />
                    <span className="min-w-0 break-words">{group.name ?? "(adsız grup)"}</span>
                  </label>
                </li>
              );
            })}
          </ul>

          {initial.groups.length > 0 && (
            <button
              type="button"
              onClick={handleSave}
              disabled={readonly || busy}
              className={primaryButton}
            >
              Kaydet
            </button>
          )}
        </>
      )}

      {notice && (
        <Alert variant={notice.kind === "ok" ? "success" : "error"}>
          <p>{notice.text}</p>
        </Alert>
      )}
    </section>
  );
}
