"use client";

import { useActionState } from "react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

import { verifyMfa } from "./actions";

type FormState = { status: "error"; message: string } | null;

export function MfaForm({ factorId }: { factorId: string }) {
  const [state, formAction, isPending] = useActionState(
    async (_prev: FormState, formData: FormData): Promise<FormState> => verifyMfa(formData),
    null,
  );

  return (
    <form action={formAction} noValidate className="flex flex-col gap-4 font-body">
      <input type="hidden" name="factorId" defaultValue={factorId} />
      <div className="flex flex-col gap-1.5">
        <label htmlFor="mfa-code" className="text-sm font-medium text-ink-900">
          Doğrulama kodu
        </label>
        <input
          id="mfa-code"
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          className="rounded-md border border-slate-300 px-3 py-2 text-center font-mono text-lg tracking-[0.3em] focus-visible:outline-2 focus-visible:outline-terracotta-600"
        />
      </div>
      {state && <Alert variant="error">{state.message}</Alert>}
      <Button type="submit" isPending={isPending} className="py-2.5">
        Doğrula
      </Button>
    </form>
  );
}
