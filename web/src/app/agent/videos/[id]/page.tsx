import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { Alert } from "@/components/ui/alert";
import { createClient } from "@/lib/supabase/server";
import type { AssetKind, ServiceCode } from "@/lib/video-orders/limits";
import { type OrderStatus, STATUS_LABELS } from "@/lib/video-orders/status";

import { getDeliveredVideoUrl } from "../actions";

import { PayButton } from "./pay-button";
import { formatTryMinor } from "@/lib/format-price";

export const instant = false;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const SERVICE_NAMES: Record<ServiceCode, string> = {
  photos: "Fotoğraflardan video",
  raw_video: "Kendi videonuzdan",
  onsite: "Yerinde çekim",
};

const KIND_LABELS: Record<AssetKind, string> = {
  photo: "Fotoğraf",
  raw_video: "Video",
};

const STATUS_NOTES: Partial<Record<OrderStatus, string>> = {
  draft: "Bu sipariş henüz gönderilmedi.",
  quote_pending:
    "Talebiniz alındı. Editörümüz inceleyip fiyat teklifi verecek, teklif bu sayfada görünecek.",
  in_progress: "Videonuz hazırlanıyor.",
};

type AssetRow = {
  id: string;
  kind: AssetKind;
  storage_path: string;
  size_bytes: number;
};

type PropertyRow = { title: string; address: string };

type OrderDetail = {
  id: string;
  status: OrderStatus;
  service_code: ServiceCode;
  price_minor_unit: number | null;
  created_at: string;
  due_at: string | null;
  delivered_at: string | null;
  rejection_reason: string | null;
  properties: PropertyRow | PropertyRow[] | null;
  video_order_assets: AssetRow[];
};

const megabyteFormat = new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 1 });
const dateFormat = new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "long", year: "numeric" });

function formatDate(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : dateFormat.format(date);
}

function formatMegabytes(bytes: number): string {
  return `${megabyteFormat.format(bytes / 1048576)} MB`;
}

function extensionOf(path: string): string {
  return path.split(".").pop()?.toUpperCase() ?? "";
}

function noteFor(order: OrderDetail): string | null {
  if (order.status === "canceled") {
    return order.rejection_reason
      ? `Talebiniz reddedildi: ${order.rejection_reason}`
      : "Bu sipariş iptal edildi.";
  }
  return STATUS_NOTES[order.status] ?? null;
}

const buttonLinkClass =
  "inline-flex min-h-12 items-center justify-center rounded-md border border-ink-900 px-4 py-2 font-medium text-ink-900 hover:bg-mist-200";

const badgeTone: Partial<Record<OrderStatus, string>> = {
  delivered: "border-moss-700 text-moss-700",
  payment_failed: "border-brick-700 text-brick-700",
  canceled: "border-brick-700 text-brick-700",
};

export default async function VideoOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    redirect("/login");
  }
  if (!UUID_RE.test(id)) {
    notFound();
  }

  const { data, error } = await supabase
    .from("video_orders")
    .select(
      "id, status, service_code, price_minor_unit, created_at, due_at, delivered_at, rejection_reason, properties(title, address), video_order_assets(id, kind, storage_path, size_bytes)",
    )
    .eq("id", id)
    .eq("agent_id", auth.user.id)
    .maybeSingle();

  if (error) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-8 font-body text-ink-900">
        <Alert variant="error">Sipariş yüklenemedi. Lütfen sayfayı yenileyin.</Alert>
      </main>
    );
  }
  if (!data) {
    notFound();
  }

  const order = data as OrderDetail;
  const property = Array.isArray(order.properties) ? order.properties[0] : order.properties;
  const assets = order.video_order_assets ?? [];
  const created = formatDate(order.created_at);
  const dueAt = formatDate(order.due_at);
  const deliveredAt = formatDate(order.delivered_at);
  const note = noteFor(order);

  const canPay =
    (order.status === "awaiting_payment" || order.status === "payment_failed") &&
    order.price_minor_unit !== null &&
    order.price_minor_unit > 0;

  let deliveredUrl: string | null = null;
  if (order.status === "delivered") {
    const delivered = await getDeliveredVideoUrl(order.id);
    if (delivered.ok) {
      deliveredUrl = delivered.url;
    }
  }

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-8 font-body text-ink-900">
      <Link href="/agent/videos" className="text-sm font-medium text-terracotta-700 hover:underline">
        Siparişlerime dön
      </Link>

      <header className="flex flex-col gap-3">
        <span
          className={`inline-flex w-fit rounded-full border bg-white px-3 py-1 text-sm font-medium ${badgeTone[order.status] ?? "border-mist-200 text-slate-500"}`}
        >
          {STATUS_LABELS[order.status]}
        </span>
        <h1 className="font-display text-2xl font-bold">
          {property?.title ?? "Adsız mülk"}
        </h1>
        <p className="text-slate-500">{SERVICE_NAMES[order.service_code]}</p>
      </header>

      <dl className="flex flex-col gap-4 rounded-xl border border-mist-200 bg-white p-5">
        <div className="flex flex-col gap-1">
          <dt className="text-sm text-slate-500">Adres</dt>
          <dd className="font-medium">{property?.address ?? "-"}</dd>
        </div>
        {order.price_minor_unit !== null && (
          <div className="flex flex-col gap-1">
            <dt className="text-sm text-slate-500">Fiyat</dt>
            <dd className="font-medium">{formatTryMinor(order.price_minor_unit)}</dd>
          </div>
        )}
        {created && (
          <div className="flex flex-col gap-1">
            <dt className="text-sm text-slate-500">Oluşturulma</dt>
            <dd className="font-medium">
              <time dateTime={order.created_at}>{created}</time>
            </dd>
          </div>
        )}
        {deliveredAt && (
          <div className="flex flex-col gap-1">
            <dt className="text-sm text-slate-500">Teslim edildi</dt>
            <dd className="font-medium">{deliveredAt}</dd>
          </div>
        )}
        {!deliveredAt && dueAt && (
          <div className="flex flex-col gap-1">
            <dt className="text-sm text-slate-500">Teslim tarihi</dt>
            <dd className="font-medium">{dueAt}</dd>
          </div>
        )}
      </dl>

      {order.status === "payment_failed" && (
        <Alert variant="error">Önceki ödeme alınamadı, tekrar deneyebilirsiniz.</Alert>
      )}

      {note && <p className="text-base">{note}</p>}

      {canPay && order.price_minor_unit !== null && (
        <PayButton orderId={order.id} amountLabel={formatTryMinor(order.price_minor_unit)} />
      )}

      {assets.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="font-display text-lg font-bold">Yüklenen dosyalar</h2>
          <ul className="flex flex-col gap-2">
            {assets.map((asset) => (
              <li
                key={asset.id}
                className="flex items-center justify-between gap-3 rounded-md border border-mist-200 bg-white px-4 py-3 text-sm"
              >
                <span className="font-medium">{KIND_LABELS[asset.kind]}</span>
                <span className="text-slate-500">
                  {extensionOf(asset.storage_path)} · {formatMegabytes(asset.size_bytes)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {order.status === "delivered" && (
        <section className="flex flex-col gap-4">
          <h2 className="font-display text-lg font-bold">Teslim videonuz</h2>
          {deliveredUrl ? (
            <>
              <video
                controls
                preload="metadata"
                src={deliveredUrl}
                aria-label="Teslim videosu"
                className="w-full rounded-xl bg-ink-900"
              />
              <a href={deliveredUrl} download className={buttonLinkClass}>
                İndir
              </a>
            </>
          ) : (
            <Alert variant="error">Video şu an açılamıyor. Lütfen sayfayı yenileyin.</Alert>
          )}
        </section>
      )}
    </main>
  );
}
