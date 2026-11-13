"use client";

import { useRef, useState } from "react";

import { sendSupportMessage } from "@/app/(marketing)/support/actions";

// "Destek" mesaj formu. Varsayılan (floating): sabit konumlu yüzen buton. inline: metin akışında
// `label` yazılı bir buton (sayfa metninin içine gömmek için). Mesaj sunucuya kaydedilir,
// admin panelinden okunur. Native <dialog>: odak hapsi, Escape ile kapanma, arka plan etkisizleşmesi.
export function SupportDialog({
  hideOnMobile = false,
  variant = "floating",
  label = "Destek formu",
  className,
}: {
  hideOnMobile?: boolean;
  variant?: "floating" | "inline";
  label?: string;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState("");

  function open() {
    setState("idle");
    setError("");
    ref.current?.showModal();
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setState("sending");
    const result = await sendSupportMessage(new FormData(event.currentTarget));
    if (result.ok) {
      setState("sent");
    } else {
      setState("idle");
      setError(result.message);
    }
  }

  const inputClass =
    "min-h-11 w-full rounded-lg border border-panel-line bg-panel-muted/40 px-3 py-2 text-base text-ink-900 transition-colors focus-visible:bg-panel-surface focus-visible:outline-2 focus-visible:outline-ink-900";

  return (
    <>
      {variant === "inline" ? (
        <button type="button" onClick={open} className={className}>
          {label}
        </button>
      ) : (
        <button
          type="button"
          onClick={open}
          aria-label="Destek"
          className={`fixed right-4 bottom-4 z-50 ${hideOnMobile ? "hidden md:flex" : "flex"} h-12 w-12 flex-col items-center justify-center rounded-leaf bg-ink-900 text-white shadow-lg ring-2 ring-cream-50 transition-colors hover:bg-ink-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta-600 md:h-auto md:w-auto md:flex-row md:gap-2 md:px-4 md:py-3`}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
            <path d="M4 5h16v11H9l-5 4V5Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
          </svg>
          <span className="hidden font-body text-sm font-medium md:inline">Destek</span>
        </button>
      )}

      <dialog
        ref={ref}
        aria-label="Destek mesajı"
        onClick={(e) => {
          if (e.target === ref.current) ref.current?.close();
        }}
        className="m-auto w-[min(30rem,calc(100vw-2rem))] rounded-xl border border-panel-line bg-panel-surface p-0 text-ink-900 shadow-[0_24px_64px_rgb(38_51_45/24%)] backdrop:bg-panel-deep/50 backdrop:backdrop-blur-sm"
      >
        <div className="flex items-start justify-between gap-3 border-b border-panel-line px-5 py-4">
          <div>
            <h2 className="font-display text-xl tracking-[-0.01em]">Destek</h2>
            <p className="mt-0.5 font-body text-sm text-charcoal/70">Mesajınızı bırakın, size dönelim.</p>
          </div>
          <button
            type="button"
            onClick={() => ref.current?.close()}
            aria-label="Kapat"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-xl text-charcoal/70 hover:bg-panel-muted"
          >
            ×
          </button>
        </div>

        {state === "sent" ? (
          <div className="flex flex-col items-start gap-3 p-5">
            <p className="font-body text-ink-900">Mesajınız alındı. En kısa sürede dönüş yapacağız.</p>
            <button
              type="button"
              onClick={() => ref.current?.close()}
              className="min-h-11 rounded-lg bg-terracotta-600 px-4 text-sm font-semibold text-white hover:bg-terracotta-700"
            >
              Kapat
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-5">
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium">Adınız</span>
              <input name="name" required minLength={2} maxLength={80} autoComplete="name" className={inputClass} />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium">Telefon veya e-posta</span>
              <input
                name="contact"
                required
                minLength={3}
                maxLength={120}
                placeholder="0 5xx xxx xx xx ya da ornek@eposta.com"
                className={inputClass}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium">Mesajınız</span>
              <textarea
                name="message"
                required
                minLength={5}
                maxLength={2000}
                rows={4}
                className={`${inputClass} py-2`}
              />
            </label>
            {error && (
              <p role="alert" className="font-body text-sm text-brick-700">
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={state === "sending"}
              className="min-h-11 rounded-lg bg-terracotta-600 px-4 text-sm font-semibold text-white hover:bg-terracotta-700 disabled:opacity-60"
            >
              {state === "sending" ? "Gönderiliyor…" : "Gönder"}
            </button>
          </form>
        )}
      </dialog>
    </>
  );
}
