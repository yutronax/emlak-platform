"use client";

import { useState } from "react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { validatePublish, type PublishErrors, type PublishInput } from "@/lib/showcase-ui/publish";

import { publishToShowcase, unpublishFromShowcase } from "../showcase-actions";

type Field = { key: Exclude<keyof PublishInput, "deal" | "phoneConsent" | "description">; label: string; hint?: string; required?: boolean };

const FIELDS: Field[] = [
  { key: "price", label: "Fiyat (TL)", hint: "Kiralıksa aylık kira", required: true },
  { key: "city", label: "Şehir", required: true },
  { key: "district", label: "İlçe" },
  { key: "rooms", label: "Oda sayısı", hint: "Örn. 3+1", required: true },
  { key: "areaM2", label: "Alan (m²)", required: true },
  { key: "floor", label: "Kat" },
  { key: "buildingAge", label: "Bina yaşı" },
  { key: "heating", label: "Isınma" },
];

const inputClass =
  "min-h-11 w-full rounded-md border border-mist-200 bg-white px-3 py-2 text-base text-ink-900 focus-visible:outline-2 focus-visible:outline-terracotta-600 aria-[invalid=true]:border-brick-700";

// Teslim edilen videoyu vitrine çıkarma/kaldırma. Telefon onayı olmadan yayın yok (KVKK).
export function ShowcaseForm({
  orderId,
  initial,
  published,
  phone,
}: {
  orderId: string;
  initial: PublishInput;
  published: boolean;
  phone: string | null;
}) {
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState<PublishErrors>({});
  const [isPublished, setIsPublished] = useState(published);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  const set = <K extends keyof PublishInput>(key: K, v: PublishInput[K]) => setValues((s) => ({ ...s, [key]: v }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    const local = validatePublish(values);
    setErrors(local.errors);
    if (!local.columns) return;
    setPending(true);
    const res = await publishToShowcase(orderId, values).catch(() => null);
    setPending(false);
    if (res?.status === "ok") {
      setIsPublished(true);
      setMessage({ tone: "success", text: "İlanınız vitrinde yayında." });
    } else if (res?.status === "invalid") setErrors(res.errors);
    else setMessage({ tone: "error", text: res?.message ?? "İşlem tamamlanamadı. Lütfen tekrar deneyin." });
  }

  async function unpublish() {
    setMessage(null);
    setPending(true);
    const res = await unpublishFromShowcase(orderId).catch(() => null);
    setPending(false);
    if (res?.status === "ok") {
      setIsPublished(false);
      setMessage({ tone: "success", text: "İlan vitrinden kaldırıldı." });
    } else setMessage({ tone: "error", text: res && "message" in res ? res.message : "İşlem tamamlanamadı." });
  }

  const err = (k: keyof PublishInput) =>
    errors[k] ? (
      <p id={`sc-${k}-err`} className="text-sm text-brick-700">
        {errors[k]}
      </p>
    ) : null;

  return (
    <section aria-labelledby="sc-title" className="flex flex-col gap-4 rounded-xl border border-mist-200 bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="sc-title" className="font-display text-lg font-normal tracking-[-0.03em]">
          Vitrine çıkar
        </h2>
        <span className="rounded-full border border-mist-200 px-3 py-1 text-sm text-slate-500">
          {isPublished ? "Vitrinde yayında" : "Yayında değil"}
        </span>
      </div>
      <p className="text-sm text-slate-500">
        Videonuz alıcı ve kiracılara açık vitrinde, aşağıdaki bilgilerle yayınlanır. Bilgileri değiştirip yeniden
        kaydedebilirsiniz.
      </p>

      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        <fieldset className="flex flex-col gap-2">
          <legend className="text-sm font-medium">İşlem türü</legend>
          <div className="flex gap-4">
            {(["satilik", "kiralik"] as const).map((d) => (
              <label key={d} className="flex min-h-11 items-center gap-2">
                <input type="radio" name="deal" checked={values.deal === d} onChange={() => set("deal", d)} />
                {d === "satilik" ? "Satılık" : "Kiralık"}
              </label>
            ))}
          </div>
          {err("deal")}
        </fieldset>

        <div className="grid gap-4 sm:grid-cols-2">
          {FIELDS.map((f) => (
            <div key={f.key} className="flex flex-col gap-1">
              <label htmlFor={`sc-${f.key}`} className="text-sm font-medium">
                {f.label}
                {!f.required && <span className="font-normal text-slate-500"> (isteğe bağlı)</span>}
              </label>
              <input
                id={`sc-${f.key}`}
                value={values[f.key]}
                onChange={(e) => set(f.key, e.target.value)}
                inputMode={["price", "areaM2", "buildingAge"].includes(f.key) ? "numeric" : undefined}
                aria-invalid={errors[f.key] ? true : undefined}
                aria-describedby={errors[f.key] ? `sc-${f.key}-err` : f.hint ? `sc-${f.key}-hint` : undefined}
                className={inputClass}
              />
              {f.hint && !errors[f.key] && (
                <p id={`sc-${f.key}-hint`} className="text-xs text-slate-500">
                  {f.hint}
                </p>
              )}
              {err(f.key)}
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="sc-description" className="text-sm font-medium">
            Açıklama <span className="font-normal text-slate-500">(isteğe bağlı)</span>
          </label>
          <textarea
            id="sc-description"
            rows={4}
            value={values.description}
            onChange={(e) => set("description", e.target.value)}
            aria-invalid={errors.description ? true : undefined}
            className={inputClass}
          />
          {err("description")}
        </div>

        <div className="flex flex-col gap-1">
          <label className="flex items-start gap-2">
            <input
              type="checkbox"
              className="mt-1"
              checked={values.phoneConsent}
              onChange={(e) => set("phoneConsent", e.target.checked)}
              aria-describedby={errors.phoneConsent ? "sc-phoneConsent-err" : undefined}
            />
            <span className="text-sm">
              Telefon numaramın{phone ? ` (${phone})` : ""} vitrinde herkese açık gösterilmesine ve ziyaretçilerin
              bana WhatsApp&apos;tan ya da telefonla ulaşmasına onay veriyorum.
            </span>
          </label>
          {err("phoneConsent")}
        </div>

        <div className="flex flex-wrap gap-3">
          <Button type="submit" isPending={pending} className="min-h-12">
            {isPublished ? "Bilgileri güncelle" : "Vitrinde yayınla"}
          </Button>
          {isPublished && (
            <Button type="button" variant="secondary" onClick={unpublish} disabled={pending} className="min-h-12">
              Vitrinden kaldır
            </Button>
          )}
        </div>
        <div aria-live="polite">{message && <Alert variant={message.tone}>{message.text}</Alert>}</div>
      </form>
    </section>
  );
}
