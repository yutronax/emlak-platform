"use client";

import { useState, useTransition } from "react";

import { setSupportHandled } from "./actions";

// Admin: mesajı "işlendi" olarak işaretler / geri alır. İyimser değil; sunucu onayından sonra günceller.
export function HandledToggle({ id, initial }: { id: string; initial: boolean }) {
  const [handled, setHandled] = useState(initial);
  const [pending, start] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const next = !handled;
          const result = await setSupportHandled(id, next);
          if (result.ok) setHandled(next);
        })
      }
      className={`min-h-9 rounded-full px-3 text-xs font-medium disabled:opacity-60 ${
        handled
          ? "bg-moss-700/15 text-moss-700"
          : "border border-panel-line bg-panel-surface text-ink-900 hover:bg-panel-muted"
      }`}
    >
      {handled ? "✓ İşlendi" : "İşlendi işaretle"}
    </button>
  );
}
