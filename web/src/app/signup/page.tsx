"use client";

import { useActionState } from "react";

import { signup } from "./actions";

type SignupState = { error: string } | { message: string } | null;

const initialState: SignupState = null;

export default function SignupPage() {
  const [state, formAction, isPending] = useActionState(
    async (_prev: SignupState, formData: FormData) => signup(formData),
    initialState,
  );

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-4 p-8">
      <h1 className="text-xl font-semibold">Kayıt</h1>
      <form action={formAction} className="flex flex-col gap-3">
        <input
          name="email"
          type="email"
          required
          placeholder="E-posta"
          className="rounded border px-3 py-2"
        />
        <input
          name="password"
          type="password"
          required
          placeholder="Şifre"
          className="rounded border px-3 py-2"
        />
        <input
          name="company_name"
          required
          placeholder="Şirket adı"
          className="rounded border px-3 py-2"
        />
        {state && "error" in state && state.error && (
          <p className="text-sm text-red-600">{state.error}</p>
        )}
        {state && "message" in state && state.message && (
          <p className="text-sm text-green-700">{state.message}</p>
        )}
        <button
          type="submit"
          disabled={isPending}
          className="rounded bg-foreground px-4 py-2 text-background disabled:opacity-50"
        >
          {isPending ? "Kayıt olunuyor…" : "Kayıt ol"}
        </button>
      </form>
    </main>
  );
}
