"use client";

import { useEffect, useRef } from "react";

import { SUPPORT_WHATSAPP_URL } from "@/lib/contact";

import { primaryAction, secondaryAction, StatusScreen } from "./status-screen";

// error.tsx ve global-error.tsx ortak içeriği. Hata mesajı gösterilmez (production'da zaten genel);
// sunucu kaydıyla eşleştirmek için yalnız digest.
export function ErrorScreen({ error, retry }: { error: unknown; retry: () => void }) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const digest = error instanceof Error ? (error as Error & { digest?: string }).digest : undefined;

  useEffect(() => {
    console.error(error);
    headingRef.current?.focus();
  }, [error]);

  return (
    <StatusScreen
      mark="!"
      eyebrow="Beklenmeyen hata"
      title="Bir şeyler ters gitti"
      headingRef={headingRef}
      actions={
        <>
          <button type="button" onClick={() => retry()} className={primaryAction}>
            Tekrar dene
          </button>
          {/* Hata sınırı sonrası istemci yönlendirmesine güvenmek yerine tam sayfa geçiş. */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a href="/" className={secondaryAction}>
            Ana sayfa
          </a>
        </>
      }
    >
      <p>Sayfa yüklenirken beklenmeyen bir sorun oluştu. Tekrar deneyebilir ya da ana sayfaya dönebilirsiniz.</p>
      <p className="mt-3 text-sm">
        Sorun sürerse{" "}
        <a
          href={SUPPORT_WHATSAPP_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-fog-50 underline underline-offset-4"
        >
          WhatsApp&apos;tan bize yazın
        </a>
        .
      </p>
      {digest && <p className="mt-3 font-mono text-xs text-fog-50/50">Hata kodu: {digest}</p>}
    </StatusScreen>
  );
}
