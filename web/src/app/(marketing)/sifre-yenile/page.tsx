"use client";

import Link from "next/link";
import { useActionState } from "react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

import { updatePassword } from "./actions";

const EXPIRED_MESSAGE = "Bağlantının süresi dolmuş";

type UpdateState = { error: string } | null;

const inputClass =
  "rounded-md border border-mist-200 bg-white px-3 py-2 focus-visible:outline-2 focus-visible:outline-ink-900";

export default function ResetPasswordPage() {
  const [state, formAction, isPending] = useActionState(
    async (_prev: UpdateState, formData: FormData) => updatePassword(formData),
    null,
  );

  const expired = state?.error === EXPIRED_MESSAGE;

  return (
    <main className="bg-fog-50 font-body text-ink-900">
      <div className="mx-auto w-full max-w-6xl px-4 pt-10 pb-12 md:px-6 md:pt-16">
        <div className="mx-auto flex w-full max-w-sm flex-col gap-4">
          <h1 className="font-display text-2xl font-bold">Yeni şifre belirleyin</h1>

          <form action={formAction} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <label htmlFor="password" className="text-sm font-medium">
                Yeni şifre
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                className={inputClass}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="password_confirm" className="text-sm font-medium">
                Yeni şifre (tekrar)
              </label>
              <input
                id="password_confirm"
                name="password_confirm"
                type="password"
                autoComplete="new-password"
                className={inputClass}
              />
            </div>

            {state?.error && <Alert variant="error">{state.error}</Alert>}
            {expired && (
              <Link href="/sifremi-unuttum" className="text-sm font-medium text-terracotta-700 underline">
                Yeni bağlantı iste
              </Link>
            )}

            <Button type="submit" isPending={isPending}>
              Şifreyi güncelle
            </Button>
          </form>
        </div>
      </div>
    </main>
  );
}
