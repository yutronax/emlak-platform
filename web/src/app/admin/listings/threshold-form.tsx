"use client";

import { type FormEvent, useState } from "react";

import { Alert } from "@/components/ui/alert";

// EML-107 AC-7 (eşik UI) ve AC-S5. Eşik app_settings('personal_auto_approve_threshold'); 0-1 dışı reddedilir.
// Kaydetme onSave prop'undan (server action → admin_set_threshold RPC) gelir.

const RANGE_ERROR = "0 ile 1 arasında bir değer girin";
const SAVE_ERROR_MESSAGES: Partial<Record<string, string>> = {
  forbidden: "Yetkiniz yok",
  invalid_value: RANGE_ERROR,
};
const DEFAULT_SAVE_ERROR = "Kaydedilemedi, tekrar deneyin.";

export type ThresholdSaveResult = { ok: true } | { ok: false; error: string };

type Notice = { kind: "ok" | "error"; text: string } | null;

// Boş, sayı olmayan, sonsuz ve 0-1 dışı değerler geçersiz.
function parseThreshold(input: string): number | null {
  if (input.trim() === "") return null;
  const n = Number(input);
  return Number.isFinite(n) && n >= 0 && n <= 1 ? n : null;
}

export function ThresholdForm({
  value,
  onSave,
}: {
  value: number;
  onSave: (value: number) => Promise<ThresholdSaveResult>;
}) {
  const [input, setInput] = useState(String(value));
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = parseThreshold(input);
    if (parsed === null) {
      setNotice({ kind: "error", text: RANGE_ERROR });
      return;
    }
    setBusy(true);
    setNotice(null);
    const res = await onSave(parsed);
    setBusy(false);
    if (res.ok) {
      setNotice({ kind: "ok", text: "Kaydedildi" });
      return;
    }
    setNotice({ kind: "error", text: SAVE_ERROR_MESSAGES[res.error] ?? DEFAULT_SAVE_ERROR });
  }

  return (
    <form noValidate onSubmit={handleSubmit} className="mt-4 space-y-3">
      <label className="block text-sm text-zinc-700">
        Otomatik onay eşiği (0-1)
        <input
          type="number"
          min={0}
          max={1}
          step="0.01"
          inputMode="decimal"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          className="mt-1 block w-full max-w-xs rounded border px-3 py-1.5 text-sm"
        />
      </label>
      <button
        type="submit"
        disabled={busy}
        className="rounded bg-zinc-900 px-3 py-1.5 text-sm text-white hover:bg-zinc-700 disabled:opacity-50"
      >
        Kaydet
      </button>
      {notice && (
        <Alert variant={notice.kind === "ok" ? "success" : "error"}>
          <p>{notice.text}</p>
        </Alert>
      )}
    </form>
  );
}
