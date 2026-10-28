"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  DELIVERY_BUSINESS_DAYS,
  MAX_FILE_BYTES,
  MAX_PHOTO_BYTES,
  MAX_PHOTOS,
  MAX_RAW_VIDEOS,
  MIN_PHOTOS,
  SERVICE_CODES,
  type ServiceCode,
} from "@/lib/video-orders/limits";

import { createVideoOrder, submitVideoOrder } from "../actions";

import { UploadField } from "./upload-field";

export type ServiceOption = {
  code: ServiceCode;
  name: string;
  price_minor_unit: number | null;
};

type Step = "service" | "property" | "files" | "summary";

type FileRule = {
  kind: "photo" | "raw_video";
  noun: string;
  min: number;
  max: number;
  maxBytes: number;
};

const FILE_RULES: Partial<Record<ServiceCode, FileRule>> = {
  photos: {
    kind: "photo",
    noun: "fotoğraf",
    min: MIN_PHOTOS,
    max: MAX_PHOTOS,
    maxBytes: MAX_PHOTO_BYTES,
  },
  raw_video: {
    kind: "raw_video",
    noun: "video",
    min: 1,
    max: MAX_RAW_VIDEOS,
    maxBytes: MAX_FILE_BYTES,
  },
};

const SERVICE_DESCRIPTIONS: Record<ServiceCode, string> = {
  photos: "İlanınızın fotoğraflarından reklam videosu hazırlanır.",
  raw_video: "Telefonunuzla çektiğiniz videoyu editörlerimiz düzenler.",
  onsite: "Editörümüz mülke gelip çeker. Uygun gün ve saatinizi yazın, fiyat teklifi verilir.",
};

const priceFormat = new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" });

function priceText(price: number | null): string {
  return price === null ? "Fiyat teklifi verilir" : priceFormat.format(price / 100);
}

const inputClass =
  "min-h-12 rounded-md border border-mist-200 bg-white px-3 py-2 text-base focus-visible:outline-2 focus-visible:outline-ink-900";

const labelClass = "text-sm font-medium";

const buttonLinkClass =
  "inline-flex min-h-12 w-full items-center justify-center rounded-md bg-terracotta-600 px-4 py-2 font-medium text-white hover:bg-terracotta-700";

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-sm text-slate-500">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}

export function OrderWizard({ services }: { services: ServiceOption[] }) {
  const router = useRouter();
  const options = services.filter((service) => SERVICE_CODES.includes(service.code));

  const [step, setStep] = useState<Step>("service");
  const [serviceCode, setServiceCode] = useState<ServiceCode | null>(null);
  const [title, setTitle] = useState("");
  const [address, setAddress] = useState("");
  const [onsiteTime, setOnsiteTime] = useState("");
  const [orderId, setOrderId] = useState<string | null>(null);
  const [fileCount, setFileCount] = useState(0);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selected = options.find((service) => service.code === serviceCode) ?? null;
  const isOnsite = serviceCode === "onsite";
  const rules = serviceCode ? (FILE_RULES[serviceCode] ?? null) : null;

  async function handleProperty(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!serviceCode) return;

    setError(null);
    setPending(true);
    const result = await createVideoOrder({
      serviceCode,
      title: title.trim(),
      address: address.trim(),
      onsitePreferredTime: isOnsite ? onsiteTime.trim() : undefined,
    });
    setPending(false);

    if (!result.ok) {
      setError(result.message);
      return;
    }
    setOrderId(result.orderId);
    setStep(isOnsite ? "summary" : "files");
  }

  async function handleSubmit() {
    if (!orderId) return;

    setError(null);
    setPending(true);
    const result = await submitVideoOrder(orderId);

    if (!result.ok) {
      setPending(false);
      setError(result.message);
      return;
    }
    router.push(`/agent/videos/${orderId}`);
  }

  return (
    <div className="flex flex-col gap-6">
      {step === "service" && (
        <section className="flex flex-col gap-5">
          <h2 className="font-display text-xl font-bold">Hangi hizmeti istiyorsunuz?</h2>
          <div role="radiogroup" aria-label="Hizmet" className="flex flex-col gap-3">
            {options.map((service) => {
              const checked = service.code === serviceCode;
              return (
                <button
                  key={service.code}
                  type="button"
                  role="radio"
                  aria-checked={checked}
                  onClick={() => setServiceCode(service.code)}
                  className={`flex min-h-24 flex-col gap-2 rounded-xl border-2 bg-white p-5 text-left ${checked ? "border-terracotta-700" : "border-mist-200"}`}
                >
                  <span className="font-display text-lg font-bold">{service.name}</span>
                  <span className="text-sm text-slate-500">
                    {SERVICE_DESCRIPTIONS[service.code]}
                  </span>
                  <span className="font-medium text-terracotta-700">
                    {priceText(service.price_minor_unit)}
                  </span>
                </button>
              );
            })}
          </div>
          <Button
            type="button"
            className="min-h-12 w-full"
            disabled={!serviceCode}
            onClick={() => setStep("property")}
          >
            Devam
          </Button>
        </section>
      )}

      {step === "property" && selected && (
        <form onSubmit={handleProperty} className="flex flex-col gap-5">
          <h2 className="font-display text-xl font-bold">Mülk bilgileri</h2>
          <div className="flex flex-col gap-1">
            <label htmlFor="video-title" className={labelClass}>
              Mülk başlığı
            </label>
            <input
              id="video-title"
              name="title"
              required
              minLength={3}
              maxLength={120}
              placeholder="Kadıköy 3+1 daire"
              autoComplete="off"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className={inputClass}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="video-address" className={labelClass}>
              Adres
            </label>
            <input
              id="video-address"
              name="address"
              required
              minLength={5}
              maxLength={300}
              autoComplete="street-address"
              value={address}
              onChange={(event) => setAddress(event.target.value)}
              className={inputClass}
            />
          </div>
          {isOnsite && (
            <div className="flex flex-col gap-1">
              <label htmlFor="video-onsite-time" className={labelClass}>
                Size uygun gün ve saat
              </label>
              <textarea
                id="video-onsite-time"
                name="onsitePreferredTime"
                required
                rows={3}
                maxLength={500}
                placeholder="Örn: Hafta içi öğleden sonra"
                value={onsiteTime}
                onChange={(event) => setOnsiteTime(event.target.value)}
                className={inputClass}
              />
            </div>
          )}
          {error && <Alert variant="error">{error}</Alert>}
          <div className="flex flex-col gap-3">
            <Button type="submit" isPending={pending} className="min-h-12 w-full">
              Devam
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="min-h-12 w-full"
              disabled={pending}
              onClick={() => setStep("service")}
            >
              Geri
            </Button>
          </div>
        </form>
      )}

      {orderId && rules && (
        <section hidden={step !== "files"} className="flex flex-col gap-5">
          <h2 className="font-display text-xl font-bold">Dosyaları yükleyin</h2>
          <UploadField
            orderId={orderId}
            kind={rules.kind}
            maxCount={rules.max}
            maxBytes={rules.maxBytes}
            onChange={setFileCount}
            onBusyChange={setUploadBusy}
          />
          <p className="font-medium">
            {fileCount}/{rules.max} {rules.noun}
          </p>
          {fileCount < rules.min && (
            <p className="text-sm text-slate-500">
              Devam etmek için en az {rules.min} {rules.noun} yükleyin.
            </p>
          )}
          <Button
            type="button"
            className="min-h-12 w-full"
            disabled={fileCount < rules.min || uploadBusy}
            onClick={() => setStep("summary")}
          >
            Devam
          </Button>
        </section>
      )}

      {step === "summary" && selected && (
        <section className="flex flex-col gap-5">
          <h2 className="font-display text-xl font-bold">Özet</h2>
          <dl className="flex flex-col gap-4 rounded-xl border border-mist-200 bg-white p-5">
            <SummaryRow label="Hizmet" value={selected.name} />
            <SummaryRow label="Mülk" value={title} />
            <SummaryRow label="Adres" value={address} />
            {isOnsite && <SummaryRow label="Uygun zaman" value={onsiteTime} />}
            {rules && <SummaryRow label="Dosyalar" value={`${fileCount} ${rules.noun}`} />}
            <SummaryRow label="Fiyat" value={priceText(selected.price_minor_unit)} />
          </dl>

          {isOnsite ? (
            <p className="text-base">Talebiniz alındı. Fiyat teklifimizi bu sayfada göreceksiniz.</p>
          ) : (
            <p className="text-base">
              Ödemeden sonra {DELIVERY_BUSINESS_DAYS} iş günü içinde teslim edilir.
            </p>
          )}

          {error && <Alert variant="error">{error}</Alert>}

          {isOnsite && orderId ? (
            <Link href={`/agent/videos/${orderId}`} className={buttonLinkClass}>
              Sipariş detayına git
            </Link>
          ) : (
            <div className="flex flex-col gap-3">
              <Button
                type="button"
                className="min-h-12 w-full"
                isPending={pending}
                onClick={handleSubmit}
              >
                Siparişi gönder
              </Button>
              <Button
                type="button"
                variant="secondary"
                className="min-h-12 w-full"
                disabled={pending}
                onClick={() => setStep("files")}
              >
                Geri
              </Button>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
