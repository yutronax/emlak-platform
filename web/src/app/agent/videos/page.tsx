import { PanelTransition } from "@/components/app-shell/panel-transition";
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
  return `inline-flex shrink-0 rounded-full border bg-panel-surface px-3 py-1 text-sm font-medium ${tone}`;
}

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
    <PanelTransition>
    <main className="flex flex-col font-body text-ink-900">
      {/* Giriş: arkada sessiz, döngüde örnek reklam videosu (süs; azaltılmış harekette yalnız kapak görseli). */}
      <section className="relative isolate overflow-hidden bg-panel-deep text-cream-50">
        {/* Medya sahnesi: video katmanı yukarıdan aşağı maskeyle açılır (520ms, sahne eğrisi). */}
        <div aria-hidden="true" className="panel-reveal absolute inset-0 -z-10">
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: 'url("/videos/ornek-ilan-kapak.jpg")' }}
          />
          <video
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
            poster="/videos/ornek-ilan-kapak.jpg"
            tabIndex={-1}
            className="absolute inset-0 h-full w-full object-cover motion-reduce:hidden"
          >
            <source src="/videos/ornek-ilan.mp4" type="video/mp4" />
          </video>
          <div className="absolute inset-0 bg-gradient-to-r from-ink-900 via-ink-900/80 to-ink-900/30" />
        </div>
        <div className="mx-auto flex min-h-[340px] w-full max-w-6xl flex-col justify-end gap-5 px-4 py-12 md:min-h-[420px] md:px-6 md:py-16">
          <p className="text-xs font-medium tracking-[0.2em] text-cream-50/70 uppercase">Reklam videosu</p>
          <h1 className="max-w-2xl font-display text-4xl leading-[1] font-light tracking-[-0.045em] md:text-6xl">
            Video siparişlerim
          </h1>
          <p className="max-w-lg text-cream-50/80">
            Fotoğraflarınızı ya da çekiminizi yükleyin; editörlerimiz ilanınız için müzikli, dikey bir reklam
            videosu hazırlasın. Hazır olunca vitrine tek tıkla çıkarabilirsiniz.
          </p>
          <div>
            <Link
              href="/agent/videos/new"
              className="inline-flex min-h-12 items-center justify-center rounded-leaf bg-cream-50 px-5 py-2 font-medium text-ink-900 hover:bg-panel-surface"
            >
              Yeni video siparişi
            </Link>
          </div>
        </div>
      </section>

      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-10 md:px-6">
      {error && <Alert variant="error">Siparişler yüklenemedi. Lütfen sayfayı yenileyin.</Alert>}

      {!error && orders.length === 0 && (
        <div className="flex flex-col gap-2 rounded-leaf border border-dashed border-charcoal/15 bg-panel-surface p-6">
          <p className="font-display text-xl font-normal tracking-[-0.03em]">Henüz video siparişiniz yok.</p>
          <p className="text-charcoal/70">
            İlanınızın fotoğraflarını yükleyin, reklam videosunu editörlerimiz hazırlasın.
          </p>
        </div>
      )}

      {!error && orders.length > 0 && (
        <h2 className="font-display text-2xl font-normal tracking-[-0.03em]">Siparişleriniz</h2>
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
                  className="flex flex-col gap-2 rounded-leaf border border-charcoal/10 bg-panel-surface p-5 transition-colors duration-(--motion-ui) ease-(--ease-ui) hover:border-panel-line-strong"
                >
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="font-display text-lg font-normal tracking-[-0.03em]">
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
      </div>
    </main>
    </PanelTransition>
  );
}
