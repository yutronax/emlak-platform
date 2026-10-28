import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { Alert } from "@/components/ui/alert";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { createServiceRoleClient } from "@/lib/supabase/server";
import type { AssetKind, ServiceCode } from "@/lib/video-orders/limits";
import { type OrderStatus, STATUS_LABELS } from "@/lib/video-orders/status";

import { AssetDownloadButton } from "./asset-download-button";
import { DeliveryUpload } from "./delivery-upload";
import { QuoteForm } from "./quote-form";
import { RejectForm } from "./reject-form";

export const instant = false;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const SERVICE_NAMES: Record<ServiceCode, string> = {
  photos: "Fotoğraflardan video",
  raw_video: "Kendi videonuzdan",
  onsite: "Yerinde çekim",
};

const KIND_LABELS: Record<AssetKind, string> = {
  photo: "Fotoğraf",
  raw_video: "Ham video",
};

const STATUS_NOTES: Partial<Record<OrderStatus, string>> = {
  draft: "Emlakçı siparişi henüz göndermedi.",
  awaiting_payment: "Emlakçının ödemesi bekleniyor. Ödeme gelene kadar işlem gerekmez.",
  payment_failed: "Ödeme alınamadı. Emlakçı tekrar ödeyebilir.",
};

const ORDER_COLUMNS =
  "id, status, service_code, price_minor_unit, onsite_preferred_time, rejection_reason, created_at, paid_at, due_at, delivered_at, properties(title, address), agents(company_name, phone), video_order_assets(id, kind, storage_path, size_bytes)";

type Named<T> = T | T[] | null;

type AssetRow = {
  id: string;
  kind: AssetKind;
  storage_path: string;
  size_bytes: number;
};

type OrderDetail = {
  id: string;
  status: OrderStatus;
  service_code: ServiceCode;
  price_minor_unit: number | null;
  onsite_preferred_time: string | null;
  rejection_reason: string | null;
  created_at: string;
  paid_at: string | null;
  due_at: string | null;
  delivered_at: string | null;
  properties: Named<{ title: string | null; address: string | null }>;
  agents: Named<{ company_name: string | null; phone: string | null }>;
  video_order_assets: AssetRow[] | null;
};

const priceFormat = new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" });
const megabyteFormat = new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 1 });
const dateFormat = new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "long", year: "numeric" });

function one<T>(value: Named<T>): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

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

function badgeClass(status: OrderStatus): string {
  const tone =
    status === "delivered"
      ? "border-moss-700 text-moss-700"
      : status === "payment_failed" || status === "canceled"
        ? "border-brick-700 text-brick-700"
        : "border-mist-200 text-slate-500";
  return `inline-flex w-fit rounded-full border bg-white px-3 py-1 text-sm font-medium ${tone}`;
}

export default async function AdminVideoDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    if (auth.reason === "no-session") {
      redirect("/login");
    }
    notFound();
  }

  const { id } = await params;
  if (!UUID_RE.test(id)) {
    notFound();
  }

  const db = createServiceRoleClient();
  const [orderResult, videosResult] = await Promise.all([
    db.from("video_orders").select(ORDER_COLUMNS).eq("id", id).maybeSingle(),
    db.from("property_videos").select("id, published_at").eq("order_id", id),
  ]);

  if (orderResult.error) {
    console.error("video_order detay sorgusu başarısız", orderResult.error);
    return (
      <main className="mx-auto max-w-2xl px-4 py-8 font-body text-ink-900">
        <Alert variant="error">Sipariş yüklenemedi. Lütfen sayfayı yenileyin.</Alert>
      </main>
    );
  }

  const order = orderResult.data as OrderDetail | null;
  if (!order) {
    notFound();
  }

  const property = one(order.properties);
  const agent = one(order.agents);
  const assets = order.video_order_assets ?? [];
  const deliveredVideos = (videosResult.data as { id: string; published_at: string | null }[] | null) ?? [];
  const created = formatDate(order.created_at);
  const paidAt = formatDate(order.paid_at);
  const dueAt = formatDate(order.due_at);
  const deliveredAt = formatDate(order.delivered_at);
  const note = STATUS_NOTES[order.status];

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-8 px-4 py-8 font-body text-ink-900 md:px-8">
      <Link href="/admin/videos" className="w-fit text-sm text-slate-500 hover:text-ink-900">
        Siparişlere dön
      </Link>

      <header className="flex flex-col gap-3">
        <span className={badgeClass(order.status)}>{STATUS_LABELS[order.status]}</span>
        <h1 className="font-display text-2xl font-bold">{property?.title ?? "Adsız mülk"}</h1>
        <p className="text-slate-500">{SERVICE_NAMES[order.service_code]}</p>
      </header>

      <dl className="grid gap-4 rounded-xl border border-mist-200 bg-white p-5 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <dt className="text-sm text-slate-500">Emlakçı</dt>
          <dd className="font-medium">{agent?.company_name ?? "Adsız emlakçı"}</dd>
        </div>
        <div className="flex flex-col gap-1">
          <dt className="text-sm text-slate-500">Telefon</dt>
          <dd className="font-medium">
            {agent?.phone ? <a href={`tel:${agent.phone}`} className="underline">{agent.phone}</a> : "-"}
          </dd>
        </div>
        <div className="flex flex-col gap-1 sm:col-span-2">
          <dt className="text-sm text-slate-500">Adres</dt>
          <dd className="font-medium">{property?.address ?? "-"}</dd>
        </div>
        {order.onsite_preferred_time && (
          <div className="flex flex-col gap-1 sm:col-span-2">
            <dt className="text-sm text-slate-500">Uygun zaman</dt>
            <dd className="font-medium">{order.onsite_preferred_time}</dd>
          </div>
        )}
        <div className="flex flex-col gap-1">
          <dt className="text-sm text-slate-500">Fiyat</dt>
          <dd className="font-medium">
            {order.price_minor_unit === null
              ? "Teklif bekleniyor"
              : priceFormat.format(order.price_minor_unit / 100)}
          </dd>
        </div>
        {created && (
          <div className="flex flex-col gap-1">
            <dt className="text-sm text-slate-500">Talep tarihi</dt>
            <dd className="font-medium">
              <time dateTime={order.created_at}>{created}</time>
            </dd>
          </div>
        )}
        {paidAt && (
          <div className="flex flex-col gap-1">
            <dt className="text-sm text-slate-500">Ödeme tarihi</dt>
            <dd className="font-medium">{paidAt}</dd>
          </div>
        )}
        {dueAt && order.status !== "delivered" && (
          <div className="flex flex-col gap-1">
            <dt className="text-sm text-slate-500">Teslim tarihi</dt>
            <dd className="font-medium">{dueAt}</dd>
          </div>
        )}
        {deliveredAt && (
          <div className="flex flex-col gap-1">
            <dt className="text-sm text-slate-500">Teslim edildi</dt>
            <dd className="font-medium">{deliveredAt}</dd>
          </div>
        )}
      </dl>

      {order.status === "canceled" && order.rejection_reason && (
        <Alert variant="error">Reddetme gerekçesi: {order.rejection_reason}</Alert>
      )}

      {note && <p>{note}</p>}

      {assets.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="font-display text-lg font-bold">Emlakçının dosyaları</h2>
          <ul className="flex flex-col gap-2">
            {assets.map((asset) => (
              <li
                key={asset.id}
                className="flex flex-col gap-2 rounded-md border border-mist-200 bg-white px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex flex-col gap-0.5">
                  <span className="font-medium">{KIND_LABELS[asset.kind]}</span>
                  <span className="text-slate-500">
                    {extensionOf(asset.storage_path)} · {formatMegabytes(asset.size_bytes)}
                  </span>
                </div>
                <AssetDownloadButton orderId={order.id} assetId={asset.id} label={KIND_LABELS[asset.kind]} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {order.status === "quote_pending" && (
        <section className="flex flex-col gap-6">
          <div className="flex flex-col gap-3">
            <h2 className="font-display text-lg font-bold">Fiyat teklifi</h2>
            <QuoteForm orderId={order.id} />
          </div>
          <div className="flex flex-col gap-3">
            <h2 className="font-display text-lg font-bold">Talebi reddet</h2>
            <RejectForm orderId={order.id} />
          </div>
        </section>
      )}

      {order.status === "in_progress" && (
        <section className="flex flex-col gap-3">
          <h2 className="font-display text-lg font-bold">Bitmiş videoyu yükle</h2>
          <DeliveryUpload orderId={order.id} />
        </section>
      )}

      {order.status === "delivered" && (
        <section className="flex flex-col gap-3">
          <h2 className="font-display text-lg font-bold">Teslim</h2>
          {deliveredVideos.length === 0 && (
            <Alert variant="error">Teslim videosu kaydı bulunamadı. Kontrol edin.</Alert>
          )}
          <p>Teslim edildi{deliveredAt ? `: ${deliveredAt}` : ""}.</p>
        </section>
      )}
    </main>
  );
}
