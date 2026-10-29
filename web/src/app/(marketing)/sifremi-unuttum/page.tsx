"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

import { requestPasswordReset } from "./actions";

const COOLDOWN_MS = 60_000;

export default function ForgotPasswordPage() {
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [sentAt, setSentAt] = useState<number | null>(null);
  const [now, setNow] = useState(0);
  const [isPending, startTransition] = useTransition();

  // Gönderimden sonra 60 sn pasif: yalnız sentAt varken saniyede bir güncellenir.
  useEffect(() => {
    if (sentAt === null) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [sentAt]);

  const remaining =
    sentAt === null ? 0 : Math.max(0, Math.ceil((sentAt + COOLDOWN_MS - now) / 1000));

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await requestPasswordReset(formData);
      if ("ok" in result) {
        const current = Date.now();
        setNow(current);
        setSentAt(current);
        setSent(true);
        setError(null);
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <main className="bg-fog-50 font-body text-ink-900">
      <div className="mx-auto w-full max-w-6xl px-4 pt-10 pb-12 md:px-6 md:pt-16">
      <div className="mx-auto flex w-full max-w-sm flex-col gap-4">
      <h1 className="font-display text-2xl font-bold">Şifremi unuttum</h1>
      <p className="text-sm text-slate-500">
        Kayıtlı e-posta adresinizi girin, şifre sıfırlama bağlantısı gönderelim.
      </p>

      <form action={handleSubmit} noValidate className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <label htmlFor="email" className="text-sm font-medium">
            E-posta
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            className="rounded-md border border-mist-200 bg-white px-3 py-2 focus-visible:outline-2 focus-visible:outline-ink-900"
          />
        </div>

        {error && <Alert variant="error">{error}</Alert>}

        {sent && (
          <Alert variant="success">
            <p>Bu adrese kayıtlı bir hesap varsa sıfırlama bağlantısı gönderdik.</p>
            <p>E-posta gelmediyse spam klasörünü kontrol edin; 60 sn sonra tekrar gönderebilirsiniz.</p>
          </Alert>
        )}

        <Button type="submit" isPending={isPending} disabled={remaining > 0}>
          Sıfırlama bağlantısı gönder
        </Button>
      </form>

      <Link href="/login" className="text-center text-sm font-medium text-terracotta-700 hover:underline">
        Girişe dön
      </Link>
      </div>
      </div>
    </main>
  );
}
