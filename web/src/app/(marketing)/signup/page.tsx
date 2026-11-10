"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";

import { AuthShell } from "@/components/auth/auth-shell";
import { FieldError, GoogleButton, TextField } from "@/components/auth/field";
import { PasswordField } from "@/components/auth/password-field";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { errorText, FIELD_TEXT, isEmail } from "@/lib/auth-ui/messages";
import { checkPassword } from "@/lib/auth-ui/password-strength";
import { formatTrPhone, normalizeTrPhone } from "@/lib/auth-ui/phone";
import { getAuthService } from "@/lib/auth-ui/service";
import type { AuthResult } from "@/lib/auth-ui/types";

type Step = 1 | 2;
type Errors = Partial<Record<"email" | "password" | "companyName" | "phone" | "terms", string>>;

const linkClass = "font-medium text-terracotta-700 underline";

export default function SignupPage() {
  const [service] = useState(getAuthService);
  const [step, setStep] = useState<Step>(1);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [phone, setPhone] = useState("");
  const [terms, setTerms] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  // Adım değişince odak yeni adımın ilk alanına gider (klavye/ekran okuyucu kullanıcıları için).
  const prevStep = useRef(step);
  useEffect(() => {
    if (prevStep.current === step) return;
    prevStep.current = step;
    formRef.current?.querySelector<HTMLInputElement>(step === 1 ? "#email" : "#company_name")?.focus();
  }, [step]);

  function focusFirstError(next: Errors) {
    const order: [keyof Errors, string][] = [
      ["email", "#email"],
      ["password", "#password"],
      ["companyName", "#company_name"],
      ["phone", "#phone"],
      ["terms", "#terms"],
    ];
    const hit = order.find(([key]) => next[key]);
    if (hit) formRef.current?.querySelector<HTMLInputElement>(hit[1])?.focus();
  }

  function handleResult(result: AuthResult) {
    if (result.status === "ok") window.location.assign(result.redirectTo);
    else if (result.status === "check_email") setSentTo(result.email);
    else if (result.code === "oauth_cancelled") setNotice(errorText(result));
    else setFormError(errorText(result));
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
    const next: Errors = {};

    if (step === 1) {
      if (!isEmail(email)) next.email = FIELD_TEXT.email;
      if (!password) next.password = FIELD_TEXT.password;
      else if (!checkPassword(password).acceptable) next.password = FIELD_TEXT.weakPassword;
      setErrors(next);
      if (Object.keys(next).length) return focusFirstError(next);
      setStep(2);
      return;
    }

    const name = companyName.trim();
    const normalizedPhone = normalizeTrPhone(phone);
    if (name.length < 2 || name.length > 100) next.companyName = FIELD_TEXT.companyName;
    if (!normalizedPhone) next.phone = FIELD_TEXT.phone;
    if (!terms) next.terms = FIELD_TEXT.terms;
    setErrors(next);
    if (Object.keys(next).length || !normalizedPhone) return focusFirstError(next);

    await run(() =>
      service.signUp({ email: email.trim(), password, companyName: name, phone: normalizedPhone, termsAccepted: true }),
    );
  }

  const shell = (children: ReactNode) => (
    <AuthShell
      eyebrow="Ücretsiz deneyin"
      pitch={
        <>
          WhatsApp gruplarındaki ilanlar, <em className="accent">tek bir akışta</em>.
        </>
      }
    >
      {children}
    </AuthShell>
  );

  if (sentTo) {
    return shell(
      <div role="status" className="flex flex-col gap-3">
        <h2 className="font-display text-[2rem] leading-tight font-normal tracking-[-0.035em]">E-postanızı kontrol edin</h2>
        <p className="text-sm text-slate-500">
          Kaydınızı aldık. <strong className="font-medium text-ink-900">{sentTo}</strong> adresinin gelen kutusuna
          (ve spam klasörüne) bakın; onay bağlantısıyla hesabınızı açabilirsiniz. Bu adresle daha önce kayıt
          olduysanız doğrudan giriş yapın.
        </p>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
          <Link
            href="/login"
            className="inline-flex min-h-11 flex-1 items-center justify-center rounded-lg bg-ink-900 px-4 py-2.5 font-medium text-white hover:bg-ink-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta-600"
          >
            Giriş yap
          </Link>
          <Button
            variant="secondary"
            className="flex-1 py-2.5"
            onClick={() => {
              setSentTo(null);
              setStep(1);
            }}
          >
            E-postayı değiştir
          </Button>
        </div>
      </div>,
    );
  }

  return shell(
    <>
      <p className="text-xs font-medium tracking-wide text-terracotta-700">
        {step === 1 ? "Adım 1 / 2 · Hesap" : "Adım 2 / 2 · Şirket"}
      </p>
      <div className="mt-2 flex gap-1" aria-hidden="true">
        <span className="h-1 flex-1 rounded-full bg-terracotta-600" />
        <span className={`h-1 flex-1 rounded-full transition-colors ${step === 2 ? "bg-terracotta-600" : "bg-mist-200"}`} />
      </div>
      <h2 className="mt-4 font-display text-[2rem] leading-tight font-normal tracking-[-0.035em]">Ücretsiz Deneyin</h2>
      <p className="mt-2 font-body text-sm text-slate-500">
        Yeni bir şey öğrenmenize gerek yok. WhatsApp&apos;ı zaten kullanıyorsunuz, o kadarı yeterli.
      </p>

      <form
        ref={formRef}
        onSubmit={onSubmit}
        noValidate
        aria-busy={isPending}
        className="auth-step-enter mt-6 flex flex-col gap-4 font-body"
        key={step}
      >
        {step === 1 ? (
          <>
            {service.capabilities.google && (
              <GoogleButton disabled={isPending} onClick={() => run(() => service.signInWithGoogle("signup"))} />
            )}
            <TextField
              name="email"
              label="E-posta"
              type="email"
              autoComplete="email"
              inputMode="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              error={errors.email}
            />
            <PasswordField
              value={password}
              onChange={setPassword}
              autoComplete="new-password"
              error={errors.password}
              showStrength
            />
          </>
        ) : (
          <>
            <TextField
              name="company_name"
              label="Şirket adı"
              autoComplete="organization"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              error={errors.companyName}
            />
            <TextField
              name="phone"
              label="WhatsApp numarası"
              type="tel"
              autoComplete="tel-national"
              inputMode="tel"
              placeholder="5xx xxx xx xx"
              hint="İlan bildirimleri için WhatsApp'ta kullandığınız numara."
              value={phone}
              onChange={(e) => setPhone(formatTrPhone(e.target.value))}
              error={errors.phone}
            />
            <div className="flex flex-col gap-2">
              <label className="flex items-start gap-2 text-sm">
                <input
                  id="terms"
                  type="checkbox"
                  name="terms"
                  checked={terms}
                  onChange={(e) => setTerms(e.target.checked)}
                  aria-invalid={errors.terms ? "true" : undefined}
                  aria-describedby={errors.terms ? "terms-error" : undefined}
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
              <FieldError id="terms-error" message={errors.terms} />
            </div>
          </>
        )}

        {formError && <Alert variant="error">{formError}</Alert>}
        {notice && <p className="text-sm text-slate-500">{notice}</p>}

        <div className="flex gap-2">
          {step === 2 && (
            <Button variant="secondary" className="py-2.5" disabled={isPending} onClick={() => setStep(1)}>
              Geri
            </Button>
          )}
          <Button type="submit" isPending={isPending} className="flex-1 py-2.5">
            {step === 1 ? "Devam et" : isPending ? "Hesap oluşturuluyor…" : "Hesabı oluştur"}
          </Button>
        </div>
      </form>

      <p className="mt-6 text-center text-sm text-slate-500">
        Zaten hesabın var mı?{" "}
        <Link href="/login" className="font-medium text-terracotta-700 hover:underline">
          Giriş yap
        </Link>
      </p>
    </>,
  );
}
