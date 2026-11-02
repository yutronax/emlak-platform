"use client";
import Link from "next/link";
import { useRef, useState, type FormEvent } from "react";

import { AuthShell } from "@/components/auth/auth-shell";
import { GoogleButton, TextField } from "@/components/auth/field";
import { PasswordField } from "@/components/auth/password-field";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { errorText, FIELD_TEXT, isEmail } from "@/lib/auth-ui/messages";
import { getAuthService } from "@/lib/auth-ui/service";
import type { AuthResult } from "@/lib/auth-ui/types";

type FieldErrors = { email?: string; password?: string };

export default function LoginPage() {
  const [service] = useState(getAuthService);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  function handleResult(result: AuthResult) {
    if (result.status === "ok") {
      window.location.assign(result.redirectTo);
      return;
    }
    if (result.status === "error") {
      // Google penceresini kapatmak hata değildir; form olduğu gibi kalır.
      if (result.code === "oauth_cancelled") setNotice(errorText(result));
      else setFormError(errorText(result));
    }
  }

  async function run(action: () => Promise<AuthResult>) {
    setFormError(null);
    setNotice(null);
    setIsPending(true);
    try {
      handleResult(await action());
    } finally {
      setIsPending(false);
    }
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const errors: FieldErrors = {};
    if (!isEmail(email)) errors.email = FIELD_TEXT.email;
    if (!password) errors.password = FIELD_TEXT.password;
    setFieldErrors(errors);
    if (errors.email || errors.password) {
      formRef.current?.querySelector<HTMLInputElement>(errors.email ? "#email" : "#password")?.focus();
      return;
    }
    await run(() => service.signIn({ email: email.trim(), password }));
  }

  return (
    <AuthShell
      eyebrow="Tekrar hoş geldiniz"
      pitch={
        <>
          Gruplardaki ilanlar sizi <em className="accent">bekliyor</em>.
        </>
      }
    >
      <h2 className="font-display text-[2rem] leading-tight font-normal tracking-[-0.035em]">Giriş yap</h2>
      <p className="mt-2 font-body text-sm text-slate-500">
        Hesabınıza girin, takip ettiğiniz WhatsApp gruplarındaki ilanlara buradan devam edin.
      </p>

      <form ref={formRef} onSubmit={onSubmit} noValidate aria-busy={isPending} className="mt-6 flex flex-col gap-4 font-body">
        {service.capabilities.google && (
          <GoogleButton disabled={isPending} onClick={() => run(() => service.signInWithGoogle("login"))} />
        )}
        <TextField
          name="email"
          label="E-posta"
          type="email"
          autoComplete="email"
          inputMode="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={fieldErrors.email}
        />
        <PasswordField
          value={password}
          onChange={setPassword}
          autoComplete="current-password"
          error={fieldErrors.password}
        />
        <Link href="/sifremi-unuttum" className="self-end text-sm font-medium text-terracotta-700 hover:underline">
          Şifremi unuttum
        </Link>
        {formError && <Alert variant="error">{formError}</Alert>}
        {notice && <p className="text-sm text-slate-500">{notice}</p>}
        <Button type="submit" isPending={isPending} className="py-2.5">
          {isPending ? "Giriş yapılıyor…" : "Giriş yap"}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-slate-500">
        Hesabınız yok mu?{" "}
        <Link href="/signup" className="font-medium text-terracotta-700 hover:underline">
          Ücretsiz deneyin
        </Link>
      </p>
    </AuthShell>
  );
}
