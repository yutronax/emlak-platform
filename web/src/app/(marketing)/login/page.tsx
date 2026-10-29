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
    <main className="grid min-h-[calc(100vh-4rem)] md:grid-cols-2">
      <section className="flex flex-col justify-center gap-3 bg-ink-900 px-6 py-8 text-white md:px-12 md:py-16">
        <h1 className="font-display text-2xl font-bold md:text-4xl">Emlak Platformu</h1>
        <p className="font-body text-sm text-white/80 md:text-base">
          Hesabınıza girin, takip ettiğiniz WhatsApp gruplarındaki ilanlara buradan devam edin.
        </p>
        <div className="mt-6 hidden rounded-2xl bg-fog-50 p-6 md:block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/illustrations/secure-login.svg" alt="" aria-hidden="true" className="h-56 w-full object-contain" />
        </div>
      </section>

      <section className="flex items-center justify-center bg-fog-50 px-6 py-12 text-ink-900">
        <div className="w-full max-w-sm">
          <h2 className="font-display text-2xl font-bold">Giriş yap</h2>
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
      </section>
    </main>
  );
}
