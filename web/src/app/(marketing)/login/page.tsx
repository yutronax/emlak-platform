"use client";
import Link from "next/link";
import { useActionState } from "react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

import { login } from "./actions";

const initialState: { error: string } | null = null;

export default function LoginPage() {
  const [state, formAction, isPending] = useActionState(
    async (_prev: { error: string } | null, formData: FormData) => login(formData),
    initialState,
  );

  return (
    <main className="bg-fog-50 text-ink-900">
      <div className="mx-auto w-full max-w-6xl px-4 pt-10 pb-12 md:px-6 md:pt-16">
      <div className="mx-auto w-full max-w-sm">
        <h2 className="font-display text-2xl font-bold">Giriş yap</h2>
        <p className="mt-2 font-body text-sm text-slate-500">
          Hesabınıza girin, takip ettiğiniz WhatsApp gruplarındaki ilanlara buradan devam edin.
        </p>
        <form action={formAction} className="mt-6 flex flex-col gap-4 font-body">
          <div className="flex flex-col gap-1">
            <label htmlFor="email" className="text-sm font-medium">
              E-posta
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              className="rounded-md border border-mist-200 bg-white px-3 py-2 focus-visible:outline-2 focus-visible:outline-ink-900"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="password" className="text-sm font-medium">
              Şifre
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              className="rounded-md border border-mist-200 bg-white px-3 py-2 focus-visible:outline-2 focus-visible:outline-ink-900"
            />
          </div>
          <Link href="/sifremi-unuttum" className="self-end text-sm font-medium text-terracotta-700 hover:underline">
            Şifremi unuttum
          </Link>
          {state?.error && <Alert variant="error">{state.error}</Alert>}
          <Button type="submit" isPending={isPending}>
            Giriş yap
          </Button>
        </form>
        <p className="mt-4 text-center text-sm text-slate-500">
          Hesabınız yok mu?{" "}
          <Link href="/signup" className="font-medium text-terracotta-700 hover:underline">
            Ücretsiz deneyin
          </Link>
        </p>
      </div>
      </div>
    </main>
  );
}
