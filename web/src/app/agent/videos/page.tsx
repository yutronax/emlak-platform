import Link from "next/link";
import { redirect } from "next/navigation";

import { Alert } from "@/components/ui/alert";
import { createClient } from "@/lib/supabase/server";
import type { ServiceCode } from "@/lib/video-orders/limits";
import { type OrderStatus, STATUS_LABELS } from "@/lib/video-orders/status";
import { formatTryMinor } from "@/lib/format-price";

export const instant = false;

const SERVICE_NAMES: Record<ServiceCode, string> = {
  photos: "Fotoğraflardan video",
  raw_video: "Kendi videonuzdan",
  onsite: "Yerinde çekim",
};

type OrderRow = {
  id: string;
  status: OrderStatus;
  service_code: ServiceCode;
  price_minor_unit: number | null;
  created_at: string;
  due_at: string | null;
  delivered_at: string | null;
  properties: { title: string } | null;
};

const dateFormat = new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "long", year: "numeric" });

function formatDate(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : dateFormat.format(date);
}

function badgeClass(status: OrderStatus): string {
  const tone =
    status === "delivered"
      ? "border-moss-700 text-moss-700"
      : status === "payment_failed" || status === "canceled"
        ? "border-brick-700 text-brick-700"
        : "border-mist-200 text-slate-500";
  return `inline-flex shrink-0 rounded-full border bg-white px-3 py-1 text-sm font-medium ${tone}`;
}

const buttonLinkClass =
  "inline-flex min-h-12 items-center justify-center rounded-md bg-terracotta-600 px-4 py-2 font-medium text-white hover:bg-terracotta-700";

export default async function AgentVideosPage() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    redirect("/login");
  }

  const { data, error } = await supabase
    .from("video_orders")
    .select(
      "id, status, created_at, due_at, delivered_at, service_code, price_minor_unit, properties(title)",
    )
    .eq("agent_id", auth.user.id)
    .order("created_at", { ascending: false });

  const orders = (data as OrderRow[] | null) ?? [];

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-8 font-body text-ink-900">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="font-display text-2xl font-bold">Video siparişlerim</h1>
        {!error && orders.length > 0 && (
          <Link href="/agent/videos/new" className={buttonLinkClass}>
            Yeni video siparişi
          </Link>
        )}
      </div>

      {error && <Alert variant="error">Siparişler yüklenemedi. Lütfen sayfayı yenileyin.</Alert>}

      {!error && orders.length === 0 && (
        <div className="flex flex-col gap-4 rounded-xl border border-mist-200 bg-white p-6">
          <p>
            Henüz video siparişiniz yok. İlanınızın fotoğraflarını yükleyin, reklam videosunu
            editörlerimiz hazırlasın.
          </p>
          <Link href="/agent/videos/new" className={buttonLinkClass}>
            Yeni video siparişi
          </Link>
        </div>
      )}

      {!error && orders.length > 0 && (
        <ul className="flex flex-col gap-3">
          {orders.map((order) => {
            const created = formatDate(order.created_at);
            const deliveredAt = formatDate(order.delivered_at);
            const dueAt = formatDate(order.due_at);
            const deliveryText = deliveredAt
              ? `Teslim edildi: ${deliveredAt}`
              : dueAt
                ? `Teslim: ${dueAt}`
                : null;
            const serviceText =
              order.price_minor_unit === null
                ? SERVICE_NAMES[order.service_code]
                : `${SERVICE_NAMES[order.service_code]} · ${formatTryMinor(order.price_minor_unit)}`;

            return (
              <li key={order.id}>
                <Link
                  href={`/agent/videos/${order.id}`}
                  className="flex flex-col gap-2 rounded-xl border border-mist-200 bg-white p-5 hover:border-slate-500"
                >
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="font-display text-lg font-bold">
                      {order.properties?.title ?? "Adsız mülk"}
                    </h2>
                    <span className={badgeClass(order.status)}>{STATUS_LABELS[order.status]}</span>
                  </div>
                  <p className="text-sm text-slate-500">{serviceText}</p>
                  {created && (
                    <time dateTime={order.created_at} className="text-sm text-slate-500">
                      {created}
                    </time>
                  )}
                  {deliveryText && <p className="text-sm font-medium">{deliveryText}</p>}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
