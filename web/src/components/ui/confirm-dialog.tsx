"use client";

import { useEffect, useId, useRef, type KeyboardEvent, type ReactNode } from "react";

import { Alert } from "./alert";
import { Button } from "./button";

type ConfirmDialogProps = {
  title: string;
  children: ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
  onClose: () => void;
  pending?: boolean;
  error?: string | null;
  tone?: "default" | "danger";
};

// Onay penceresi: açılınca güvenli düğmeye (Vazgeç) odaklanır, Esc kapatır, Tab pencere içinde döner.
// Odağın tetikleyiciye dönmesi çağıranın işidir (onClose içinde).
export function ConfirmDialog({
  title,
  children,
  confirmLabel,
  onConfirm,
  onClose,
  pending = false,
  error,
  tone = "default",
}: ConfirmDialogProps) {
  const titleId = useId();
  const bodyId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    cancelRef.current?.focus();
  }, []);

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === "Escape" && !pending) {
      e.preventDefault();
      onClose();
      return;
    }
    if (e.key !== "Tab") return;
    const focusable = Array.from(
      panelRef.current?.querySelectorAll<HTMLElement>("button:not([disabled]), a[href]") ?? [],
    );
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink-900/50 p-4 sm:items-center">
      <div className="absolute inset-0" aria-hidden="true" onClick={() => !pending && onClose()} />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={bodyId}
        onKeyDown={onKeyDown}
        className="relative w-full max-w-md rounded-leaf bg-white p-6 font-body text-ink-900 shadow-[0_24px_60px_-20px_rgb(16_37_63/0.5)]"
      >
        <h2 id={titleId} className="font-display text-xl font-normal tracking-[-0.03em]">
          {title}
        </h2>
        <div id={bodyId} className="mt-2 text-sm text-slate-500">
          {children}
        </div>
        {error && (
          <div className="mt-4">
            <Alert variant="error">{error}</Alert>
          </div>
        )}
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button ref={cancelRef} variant="secondary" onClick={onClose} disabled={pending}>
            Vazgeç
          </Button>
          <Button
            onClick={onConfirm}
            isPending={pending}
            className={tone === "danger" ? "bg-brick-700 hover:bg-brick-700/90" : undefined}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
