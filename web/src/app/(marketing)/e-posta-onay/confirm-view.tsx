"use client";

import Link from "next/link";
import { useRef, useState, type FormEvent } from "react";

import { AuthShell } from "@/components/auth/auth-shell";
import { TextField } from "@/components/auth/field";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FIELD_TEXT, isEmail } from "@/lib/auth-ui/messages";
import type { ConfirmService } from "@/lib/confirm-ui/types";

export type ConfirmState = "onaylandi" | "gecersiz";

const ERROR_TEXT = {
  network: "Bağlantı sorunu, tekrar deneyin.",
  rate_limited: "Çok fazla deneme. Biraz sonra tekrar deneyin.",
} as const;

const primaryLink =
  "inline-flex items-center justify-center rounded-md bg-terracotta-600 px-4 py-2.5 font-medium text-white hover:bg-terracotta-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-900";
const secondaryLink =
  "inline-flex items-center justify-center rounded-md border border-ink-900 px-4 py-2.5 font-medium text-ink-900 hover:bg-mist-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-900";

const STEPS = [
  { title: "WhatsApp'ı bağlayın", desc: "Telefonunuzdan QR kodu okutun; bir dakika sürer." },
  { title: "Takip edeceğiniz grupları seçin", desc: "Yalnız seçtiğiniz gruplardaki ilanlar okunur." },
  { title: "İlanlar panelinize düşsün", desc: "Gruplara gelen ilanlar ayrıştırılıp tek akışta toplanır." },
];

export function ConfirmView({ state, service }: { state: ConfirmState; service: ConfirmService | null }) {
  return (
    <AuthShell
      eyebrow={state === "onaylandi" ? "Hesap hazır" : "E-posta onayı"}
      pitch={
        state === "onaylandi" ? (
          <>
            Hoş geldiniz. <span className="text-terracotta-600">İlk ilanlar birkaç adım ötede.</span>
          </>
        ) : (
          <>
            Bir bağlantı eskimiş; <span className="text-terracotta-600">yenisini hemen gönderelim.</span>
          </>
        )
      }
    >
      {state === "onaylandi" ? <Confirmed /> : <Invalid service={service} />}
    </AuthShell>
  );
}

function Confirmed() {
  return (
    <div className="flex flex-col gap-5 font-body">
      <div>
        <h2 className="font-display text-[1.75rem] leading-tight font-bold">E-postanız onaylandı</h2>
        <p className="mt-2 text-sm text-slate-500">Hesabınız hazır. Üç adımda ilk ilanlarınızı görürsünüz.</p>
      </div>
      <ol aria-label="Sonraki adımlar" className="flex flex-col gap-3">
        {STEPS.map((s, i) => (
          <li key={s.title} className="flex gap-3">
            <span
              aria-hidden="true"
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-ink-900 font-display text-sm font-bold text-fog-50"
            >
              {i + 1}
            </span>
            <div>
              <p className="text-sm font-medium">{s.title}</p>
              <p className="text-sm text-slate-500">{s.desc}</p>
            </div>
          </li>
        ))}
      </ol>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Link href="/agent/whatsapp" className={`${primaryLink} flex-1`}>
          WhatsApp&apos;ı bağla
        </Link>
        <Link href="/agent/dashboard" className={`${secondaryLink} flex-1`}>
          Panele git
        </Link>
      </div>
    </div>
  );
}

function Invalid({ service }: { service: ConfirmService | null }) {
  const [email, setEmail] = useState("");
  const [fieldError, setFieldError] = useState<string | undefined>();
  const [formError, setFormError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!service || pending) return;
    const value = email.trim();
    if (!isEmail(value)) {
      setFieldError(FIELD_TEXT.email);
      formRef.current?.querySelector<HTMLInputElement>("#email")?.focus();
      return;
    }
    setFieldError(undefined);
    setFormError(null);
    setPending(true);
    try {
      const res = await service.resend(value);
      if (res.status === "ok") setSentTo(value);
      else setFormError(ERROR_TEXT[res.code]);
    } catch {
      setFormError(ERROR_TEXT.network);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-5 font-body">
      <div>
        <h2 className="font-display text-[1.75rem] leading-tight font-bold">Bu onay bağlantısı geçersiz</h2>
        <p className="mt-2 text-sm text-slate-500">Süresi dolmuş ya da daha önce kullanılmış olabilir.</p>
      </div>

      {service &&
        (sentTo ? (
          <p role="status" className="rounded-md border border-moss-700/30 bg-moss-700/10 px-4 py-3 text-sm text-moss-700">
            {sentTo} ile kayıtlı bir hesap varsa yeni bağlantı gönderdik. Gelen kutunuza (ve spam klasörüne) bakın.
          </p>
        ) : (
          <form ref={formRef} onSubmit={onSubmit} noValidate aria-busy={pending} className="flex flex-col gap-4">
            <TextField
              name="email"
              label="E-posta"
              type="email"
              inputMode="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              error={fieldError}
              disabled={pending}
            />
            {formError && <Alert variant="error">{formError}</Alert>}
            <Button type="submit" isPending={pending} className="py-2.5">
              {pending ? "Gönderiliyor…" : "Yeni bağlantı gönder"}
            </Button>
          </form>
        ))}

      <p className="text-center text-sm text-slate-500">
        Hesabınızı zaten onayladıysanız{" "}
        <Link href="/login" className="font-medium text-terracotta-700 hover:underline">
          Giriş yap
        </Link>
      </p>
    </div>
  );
}
