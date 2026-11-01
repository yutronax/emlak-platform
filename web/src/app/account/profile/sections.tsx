"use client";

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";

import { FieldError, TextField } from "@/components/auth/field";
import { PasswordField } from "@/components/auth/password-field";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FIELD_TEXT } from "@/lib/auth-ui/messages";
import { formatTrPhone, normalizeTrPhone } from "@/lib/auth-ui/phone";
import type { CompanyInput, NotificationPrefs, Profile, ProfileService, SaveError, SaveResult } from "@/lib/profile-ui/types";
import { LOGO_TYPES, validateCompany, validateEmailChange, validateLogo, validatePasswordChange } from "@/lib/profile-ui/validation";

type SectionProps = {
  profile: Profile;
  service: ProfileService;
  onSaved: (p: Profile) => void;
  onDirty: (dirty: boolean) => void;
};

type Errors = Record<string, string | undefined>;

const ERROR_TEXT: Record<SaveError["code"], string> = {
  wrong_password: "Mevcut şifre hatalı.",
  too_large: "Logo en fazla 2 MB olabilir.",
  unsupported_type: "Logo PNG, JPG veya WEBP olmalı.",
  network: "Bağlantı sorunu, tekrar deneyin.",
  invalid: "Girilen bilgiler geçersiz.",
  unknown: "Bir sorun oluştu, tekrar deneyin.",
};

const errorText = (e: SaveError) => e.message ?? ERROR_TEXT[e.code];

// Tek bir kaydetme işleminin durumu: alan hatası alana, alansız hata bölüm alert'ine gider.
function useSave(formRef: React.RefObject<HTMLFormElement | null>) {
  const [pending, setPending] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Errors>({});

  function focusField(name: string) {
    formRef.current?.querySelector<HTMLElement>(`#${name}`)?.focus();
  }

  function reject(next: Errors) {
    setErrors(next);
    setSaved(null);
    const first = Object.keys(next).find((k) => next[k]);
    if (first) focusField(first);
    return Boolean(first);
  }

  async function run(action: () => Promise<SaveResult>, okText = "Kaydedildi") {
    if (pending) return null;
    setPending(true);
    setSaved(null);
    setFormError(null);
    try {
      const res = await action();
      if (res.status === "ok") {
        setErrors({});
        setSaved(okText);
        return res.profile;
      }
      if (res.field) reject({ [res.field]: errorText(res) });
      else setFormError(errorText(res));
    } catch {
      setFormError(ERROR_TEXT.network);
    } finally {
      setPending(false);
    }
    return null;
  }

  return { pending, saved, setSaved, formError, errors, setErrors, reject, run };
}

function SectionHeading({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="mb-6">
      <h2 className="font-display text-xl font-bold">{title}</h2>
      {children && <p className="mt-1 text-sm text-slate-500">{children}</p>}
    </div>
  );
}

function Feedback({ saved, formError }: { saved: string | null; formError: string | null }) {
  return (
    <>
      {formError && <Alert variant="error">{formError}</Alert>}
      <p role="status" className="text-sm font-medium text-moss-700 empty:hidden">
        {saved ?? ""}
      </p>
    </>
  );
}

const divider = "my-8 h-px bg-mist-200";

export function CompanySection({ profile, service, onSaved, onDirty }: SectionProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const pick = (p: Profile): CompanyInput => ({
    companyName: p.companyName,
    contactName: p.contactName,
    city: p.city,
    district: p.district,
  });
  const [baseline, setBaseline] = useState(() => pick(profile));
  const [form, setForm] = useState(baseline);
  const save = useSave(formRef);
  const logo = useSave(formRef);
  const [logoError, setLogoError] = useState<string | null>(null);

  const isDirty = (Object.keys(form) as (keyof CompanyInput)[]).some((k) => form[k] !== baseline[k]);
  useEffect(() => onDirty(isDirty), [isDirty, onDirty]);

  const set = (k: keyof CompanyInput) => (e: { target: { value: string } }) => {
    setForm((f) => ({ ...f, [k]: e.target.value }));
    save.setSaved(null);
  };

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (save.reject(validateCompany(form))) return;
    const trimmed = {
      companyName: form.companyName.trim(),
      contactName: form.contactName.trim(),
      city: form.city.trim(),
      district: form.district.trim(),
    };
    const p = await save.run(() => service.updateCompany(trimmed));
    if (p) {
      setBaseline(pick(p));
      setForm(pick(p));
      onSaved(p);
    }
  }

  async function onLogo(file: File | undefined) {
    if (!file) return;
    const invalid = validateLogo(file);
    setLogoError(invalid ?? null);
    if (invalid) return;
    const p = await logo.run(() => service.uploadLogo(file), "Logo güncellendi");
    if (p) onSaved(p);
  }

  async function onRemoveLogo() {
    const p = await logo.run(() => service.removeLogo(), "Logo kaldırıldı");
    if (p) onSaved(p);
  }

  const initials = profile.companyName.trim().slice(0, 2).toLocaleUpperCase("tr-TR");

  return (
    <form ref={formRef} onSubmit={onSubmit} noValidate aria-busy={save.pending} className="flex flex-col gap-4">
      <SectionHeading title="Şirket bilgileri">Müşterilerinize ve ekibimize görünen bilgiler.</SectionHeading>

      <div className="flex flex-wrap items-center gap-4">
        {profile.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- yerel önizleme (blob/imzalı URL), optimizasyon gereksiz
          <img
            src={profile.logoUrl}
            alt="Şirket logosu"
            className="h-16 w-16 rounded-xl border border-mist-200 object-cover"
          />
        ) : (
          <span
            aria-hidden="true"
            className="flex h-16 w-16 items-center justify-center rounded-xl bg-ink-900 font-display text-xl font-bold text-fog-50"
          >
            {initials}
          </span>
        )}
        <div className="flex flex-wrap gap-2">
          <label className="inline-flex cursor-pointer items-center rounded-md border border-ink-900 px-3 py-2 text-sm font-medium hover:bg-mist-200 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-terracotta-600">
            {profile.logoUrl ? "Logoyu değiştir" : "Logo yükle"}
            <input
              type="file"
              accept={LOGO_TYPES.join(",")}
              aria-label="Logo yükle"
              aria-describedby={logoError ? "logo-error" : "logo-hint"}
              className="sr-only"
              disabled={logo.pending}
              onChange={(e) => {
                void onLogo(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </label>
          {profile.logoUrl && (
            <Button variant="secondary" className="text-sm" disabled={logo.pending} onClick={onRemoveLogo}>
              Logoyu kaldır
            </Button>
          )}
        </div>
        <p id="logo-hint" className="basis-full text-xs text-slate-500">
          PNG, JPG veya WEBP · en fazla 2 MB · kare önerilir.
        </p>
        <div className="basis-full">
          <FieldError id="logo-error" message={logoError ?? undefined} />
          <Feedback saved={logo.saved} formError={logo.formError} />
        </div>
      </div>

      <div className={divider} />

      <TextField
        name="companyName"
        label="Şirket adı"
        autoComplete="organization"
        value={form.companyName}
        onChange={set("companyName")}
        error={save.errors.companyName}
        disabled={save.pending}
      />
      <TextField
        name="contactName"
        label="Yetkili adı"
        autoComplete="name"
        value={form.contactName}
        onChange={set("contactName")}
        error={save.errors.contactName}
        disabled={save.pending}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          name="city"
          label="Şehir"
          autoComplete="address-level1"
          value={form.city}
          onChange={set("city")}
          error={save.errors.city}
          disabled={save.pending}
        />
        <TextField
          name="district"
          label="İlçe (isteğe bağlı)"
          autoComplete="address-level2"
          value={form.district}
          onChange={set("district")}
          disabled={save.pending}
        />
      </div>

      <Feedback saved={save.saved} formError={save.formError} />
      <div>
        <Button type="submit" isPending={save.pending} disabled={!isDirty}>
          {save.pending ? "Kaydediliyor…" : "Kaydet"}
        </Button>
      </div>
    </form>
  );
}

export function ContactSection({ profile, service, onSaved, onDirty }: SectionProps) {
  const phoneRef = useRef<HTMLFormElement>(null);
  const emailRef = useRef<HTMLFormElement>(null);
  const [phoneBase, setPhoneBase] = useState(() => formatTrPhone(profile.whatsappPhone ?? ""));
  const [phone, setPhone] = useState(phoneBase);
  const [email, setEmail] = useState("");
  const phoneSave = useSave(phoneRef);
  const emailSave = useSave(emailRef);

  const isDirty = phone !== phoneBase || email !== "";
  useEffect(() => onDirty(isDirty), [isDirty, onDirty]);

  async function onPhone(e: FormEvent) {
    e.preventDefault();
    const normalized = normalizeTrPhone(phone);
    if (phoneSave.reject({ whatsappPhone: normalized ? undefined : FIELD_TEXT.phone }) || !normalized) return;
    const p = await phoneSave.run(() => service.updateWhatsapp(normalized));
    if (p) {
      const formatted = formatTrPhone(p.whatsappPhone ?? "");
      setPhoneBase(formatted);
      setPhone(formatted);
      onSaved(p);
    }
  }

  async function onEmail(e: FormEvent) {
    e.preventDefault();
    const invalid = validateEmailChange(email, profile.email);
    if (emailSave.reject({ newEmail: invalid })) return;
    const p = await emailSave.run(() => service.requestEmailChange(email.trim()), "");
    if (p) {
      setEmail("");
      emailSave.setSaved(null);
      onSaved(p);
    }
  }

  return (
    <div className="flex flex-col">
      <SectionHeading title="İletişim">İlan bildirimleri ve hesap e-postaları buraya gelir.</SectionHeading>

      <form ref={phoneRef} onSubmit={onPhone} noValidate aria-busy={phoneSave.pending} className="flex flex-col gap-4">
        <TextField
          name="whatsappPhone"
          label="WhatsApp numarası"
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          placeholder="5xx xxx xx xx"
          hint="Takip ettiğiniz gruplara bağlı numara."
          value={phone}
          onChange={(e) => {
            setPhone(formatTrPhone(e.target.value));
            phoneSave.setSaved(null);
          }}
          error={phoneSave.errors.whatsappPhone}
          disabled={phoneSave.pending}
        />
        <Feedback saved={phoneSave.saved} formError={phoneSave.formError} />
        <div>
          <Button type="submit" isPending={phoneSave.pending} disabled={phone === phoneBase}>
            Numarayı kaydet
          </Button>
        </div>
      </form>

      <div className={divider} />

      <form ref={emailRef} onSubmit={onEmail} noValidate aria-busy={emailSave.pending} className="flex flex-col gap-4">
        <div>
          <p className="text-sm font-medium">E-posta</p>
          <p className="mt-1 text-sm break-all text-slate-500">{profile.email}</p>
        </div>
        {profile.pendingEmail && (
          <p role="status" className="rounded-md border border-mist-200 bg-fog-50 px-4 py-3 text-sm">
            {profile.pendingEmail} adresine onay bağlantısı gönderildi. Onaylanana kadar {profile.email} geçerli.
          </p>
        )}
        <TextField
          name="newEmail"
          label="Yeni e-posta"
          type="email"
          inputMode="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={emailSave.errors.newEmail}
          disabled={emailSave.pending}
        />
        {emailSave.formError && <Alert variant="error">{emailSave.formError}</Alert>}
        <div>
          <Button type="submit" variant="secondary" isPending={emailSave.pending} disabled={!email}>
            Onay bağlantısı gönder
          </Button>
        </div>
      </form>
    </div>
  );
}

type SecurityProps = SectionProps & { navigate: (url: string) => void };

export function SecuritySection({ service, onDirty, navigate }: SecurityProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const [pw, setPw] = useState({ current: "", next: "", confirm: "" });
  const save = useSave(formRef);
  const [signingOut, setSigningOut] = useState<"this" | "all" | null>(null);
  const [signOutError, setSignOutError] = useState<string | null>(null);

  const isDirty = Boolean(pw.current || pw.next || pw.confirm);
  useEffect(() => onDirty(isDirty), [isDirty, onDirty]);

  const set = (k: keyof typeof pw) => (v: string) => {
    setPw((s) => ({ ...s, [k]: v }));
    save.setSaved(null);
  };

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (save.reject(validatePasswordChange(pw))) return;
    const p = await save.run(
      () => service.changePassword({ current: pw.current, next: pw.next }),
      "Şifreniz güncellendi.",
    );
    if (p) setPw({ current: "", next: "", confirm: "" });
  }

  async function signOut(scope: "this" | "all") {
    setSigningOut(scope);
    setSignOutError(null);
    try {
      const res = await service.signOut(scope);
      if (res.status === "ok") return navigate(res.redirectTo);
      setSignOutError(errorText(res));
    } catch {
      setSignOutError(ERROR_TEXT.network);
    }
    setSigningOut(null);
  }

  return (
    <div className="flex flex-col">
      <form ref={formRef} onSubmit={onSubmit} noValidate aria-busy={save.pending} className="flex flex-col gap-4">
        <SectionHeading title="Şifre">Güçlü ve başka yerde kullanmadığınız bir şifre seçin.</SectionHeading>
        <PasswordField
          id="current"
          label="Mevcut şifre"
          value={pw.current}
          onChange={set("current")}
          autoComplete="current-password"
          error={save.errors.current}
        />
        <PasswordField
          id="next"
          label="Yeni şifre"
          value={pw.next}
          onChange={set("next")}
          autoComplete="new-password"
          error={save.errors.next}
          showStrength
        />
        <PasswordField
          id="confirm"
          label="Yeni şifre (tekrar)"
          value={pw.confirm}
          onChange={set("confirm")}
          autoComplete="new-password"
          error={save.errors.confirm}
        />
        <Feedback saved={save.saved} formError={save.formError} />
        <div>
          <Button type="submit" isPending={save.pending} disabled={!isDirty}>
            Şifreyi güncelle
          </Button>
        </div>
      </form>

      <div className={divider} />

      <h2 className="font-display text-xl font-bold">Oturumlar</h2>
      <p className="mt-1 text-sm text-slate-500">
        Bir cihazı kaybettiyseniz veya şifrenizi başka biri biliyorsa tüm cihazlardan çıkış yapın.
      </p>
      {signOutError && (
        <div className="mt-4">
          <Alert variant="error">{signOutError}</Alert>
        </div>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        <Button variant="secondary" isPending={signingOut === "this"} disabled={signingOut !== null} onClick={() => signOut("this")}>
          Bu cihazda çıkış yap
        </Button>
        <Button
          variant="secondary"
          isPending={signingOut === "all"}
          disabled={signingOut !== null}
          onClick={() => signOut("all")}
          className="border-brick-700 text-brick-700 hover:bg-brick-700/10"
        >
          Tüm cihazlardan çıkış yap
        </Button>
      </div>
    </div>
  );
}

const PREFS: { key: keyof NotificationPrefs; title: string; desc: string }[] = [
  {
    key: "newListingPush",
    title: "Yeni ilan anlık bildirimi",
    desc: "Takip ettiğiniz gruplara ilan düşünce. Bu cihazda izin vermek için paneldeki zil simgesini kullanın.",
  },
  { key: "newListingEmail", title: "Yeni ilan e-postası", desc: "Anlık bildirim yerine e-posta ile." },
  { key: "videoOrderEmail", title: "Video siparişi güncellemeleri", desc: "Teklif, hazırlık ve teslim adımlarında e-posta." },
  { key: "weeklySummaryEmail", title: "Haftalık özet", desc: "Pazartesi sabahı geçen haftanın ilanları." },
];

export function NotificationsSection({ profile, service, onSaved, onDirty }: SectionProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const [baseline, setBaseline] = useState(profile.notifications);
  const [prefs, setPrefs] = useState(baseline);
  const save = useSave(formRef);

  const isDirty = PREFS.some(({ key }) => prefs[key] !== baseline[key]);
  useEffect(() => onDirty(isDirty), [isDirty, onDirty]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const p = await save.run(() => service.updateNotifications(prefs));
    if (p) {
      setBaseline(p.notifications);
      setPrefs(p.notifications);
      onSaved(p);
    }
  }

  return (
    <form ref={formRef} onSubmit={onSubmit} noValidate aria-busy={save.pending} className="flex flex-col gap-4">
      <SectionHeading title="Bildirimler">Neyi, nereden duymak istediğinizi seçin.</SectionHeading>
      <ul className="flex flex-col divide-y divide-mist-200">
        {PREFS.map(({ key, title, desc }) => {
          const on = prefs[key];
          return (
            <li key={key} className="flex items-start justify-between gap-4 py-4 first:pt-0">
              <div className="min-w-0">
                <p id={`pref-${key}`} className="text-sm font-medium">
                  {title}
                </p>
                <p id={`pref-${key}-desc`} className="mt-0.5 text-sm text-slate-500">
                  {desc}
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={on}
                aria-labelledby={`pref-${key}`}
                aria-describedby={`pref-${key}-desc`}
                disabled={save.pending}
                onClick={() => {
                  setPrefs((s) => ({ ...s, [key]: !s[key] }));
                  save.setSaved(null);
                }}
                className={`relative mt-0.5 inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta-600 motion-reduce:transition-none ${
                  on ? "bg-moss-700" : "bg-slate-500/40"
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform motion-reduce:transition-none ${
                    on ? "translate-x-5" : "translate-x-0.5"
                  }`}
                />
              </button>
            </li>
          );
        })}
      </ul>
      <Feedback saved={save.saved} formError={save.formError} />
      <div>
        <Button type="submit" isPending={save.pending} disabled={!isDirty}>
          {save.pending ? "Kaydediliyor…" : "Kaydet"}
        </Button>
      </div>
    </form>
  );
}
