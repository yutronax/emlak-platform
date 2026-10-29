"use client";

import Link from "next/link";
import { useActionState } from "react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

import { signup } from "./actions";

type SignupState = { error: string } | { message: string } | null;

const initialState: SignupState = null;

// Sunucu aynı metni döner (actions.ts); istemci de işaretsiz gönderimi ağa çıkmadan reddeder.
const TERMS_ERROR = "Devam etmek için şartları kabul etmeniz gerekiyor.";

const inputClass =
  "rounded-md border border-mist-200 bg-white px-3 py-2 focus-visible:outline-2 focus-visible:outline-ink-900";

const linkClass = "font-medium text-terracotta-700 underline";

export default function SignupPage() {
  const [state, formAction, isPending] = useActionState(
    async (_prev: SignupState, formData: FormData) => {
      if (formData.get("terms") !== "on") return { error: TERMS_ERROR };
      return signup(formData);
    },
    initialState,
  );

  const hasError = state !== null && "error" in state && state.error !== "";
  const termsError = hasError && state.error === TERMS_ERROR;

  return (
    <main className="bg-fog-50 text-ink-900">
      <div className="mx-auto w-full max-w-6xl px-4 pt-10 pb-12 md:px-6 md:pt-16">
      <div className="mx-auto w-full max-w-sm">
        <h2 className="font-display text-2xl font-bold">Ücretsiz Deneyin</h2>
        <p className="mt-2 font-body text-sm text-slate-500">
          Yeni bir şey öğrenmenize gerek yok. WhatsApp&apos;ı zaten kullanıyorsunuz, o kadarı yeterli.
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
              className={inputClass}
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
              autoComplete="new-password"
              className={inputClass}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="company_name" className="text-sm font-medium">
              Şirket adı
            </label>
            <input
              id="company_name"
              name="company_name"
              required
              autoComplete="organization"
              className={inputClass}
            />
          </div>
          <div className="flex flex-col gap-2">
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                name="terms"
                aria-describedby={termsError ? "terms-error" : undefined}
                className="mt-1 h-4 w-4 accent-terracotta-600"
              />
              <span>
                <Link href="/kullanim-sartlari" target="_blank" rel="noopener noreferrer" className={linkClass}>
                  Kullanım Şartları
                </Link>
                &apos;nı ve{" "}
                <Link href="/kvkk" target="_blank" rel="noopener noreferrer" className={linkClass}>
                  KVKK Aydınlatma Metni
                </Link>
                &apos;ni okudum, kabul ediyorum.
              </span>
            </label>
            {termsError && (
              <div id="terms-error">
                <Alert variant="error">{TERMS_ERROR}</Alert>
              </div>
            )}
          </div>
          {hasError && !termsError && <Alert variant="error">{state.error}</Alert>}
          {state && "message" in state && state.message && (
            <Alert variant="success">{state.message}</Alert>
          )}
          <Button type="submit" isPending={isPending}>
            Ücretsiz Deneyin
          </Button>
        </form>
        <p className="mt-4 text-center text-sm text-slate-500">
          Zaten hesabın var mı?{" "}
          <Link href="/login" className="font-medium text-terracotta-700 hover:underline">
            Giriş yap
          </Link>
        </p>
      </div>
      </div>
    </main>
  );
}
