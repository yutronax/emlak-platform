import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { Alert } from "@/components/ui/alert";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { createServiceRoleClient } from "@/lib/supabase/server";
import type { ServiceCode } from "@/lib/video-orders/limits";
import { type OrderStatus, STATUS_LABELS } from "@/lib/video-orders/status";

// Emlakçılar arası okuma için service-role gerekir (agents tablosunda RLS başka
// emlakçıların satırını gizler). Bu yüzden önce requireAdmin çalışır.
export const instant = false;

type TabKey = "quote" | "todo" | "done" | "canceled";

const TABS: readonly { key: TabKey; label: string; status: OrderStatus; empty: string }[] = [
  {
    key: "quote",
    label: "Teklif bekleyen",
    status: "quote_pending",
    empty: "Fiyat bekleyen talep yok.",
  },
  {
    key: "todo",
    label: "Hazırlanacak",
    status: "in_progress",
    empty: "Hazırlanacak sipariş yok. Ödemesi alınan siparişler burada görünür.",
  },
  {
    key: "done",
    label: "Teslim edilen",
    status: "delivered",
    empty: "Henüz teslim edilen sipariş yok.",
  },
  {
    key: "canceled",
    label: "İptal",
    status: "canceled",
    empty: "İptal edilen sipariş yok.",
  },
];

const ORDER_BY: Record<TabKey, { column: string; ascending: boolean }> = {
  quote: { column: "created_at", ascending: true },
  todo: { column: "due_at", ascending: true },
  done: { column: "delivered_at", ascending: false },
  canceled: { column: "created_at", ascending: false },
};

const PENDING_PAYMENT_STATUSES: OrderStatus[] = ["draft", "awaiting_payment", "payment_failed"];

const QUEUE_COLUMNS =
  "id, status, service_code, created_at, due_at, delivered_at, properties(title, address), agents(company_name, phone)";

const SERVICE_NAMES: Record<ServiceCode, string> = {
  photos: "Fotoğraflardan video",
  raw_video: "Kendi videonuzdan",
  onsite: "Yerinde çekim",
};

type Named<T> = T | T[] | null;

type QueueRow = {
  id: string;
  status: OrderStatus;
  service_code: ServiceCode;
  created_at: string;
  due_at: string | null;
  delivered_at: string | null;
  properties: Named<{ title: string | null; address: string | null }>;
  agents: Named<{ company_name: string | null; phone: string | null }>;
};

const dateFormat = new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "long", year: "numeric" });

function one<T>(value: Named<T>): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

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

function isOverdue(dueAt: string | null): boolean {
  return dueAt !== null && new Date(dueAt).getTime() < Date.now();
}

function tabClass(active: boolean): string {
  return `-mb-px border-b-2 px-1 py-3 font-medium ${
    active ? "border-ink-900 text-ink-900" : "border-transparent text-slate-500 hover:text-ink-900"
  }`;
}

export default async function AdminVideosPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string | string[] }>;
}) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    if (auth.reason === "no-session") {
      redirect("/login");
    }
    notFound();
  }

  const params = await searchParams;
  const tab = TABS.find((entry) => entry.key === params.tab) ?? TABS[1];
  const sort = ORDER_BY[tab.key];
  const db = createServiceRoleClient();

  const [rowsResult, pendingResult, ...countResults] = await Promise.all([
    db
      .from("video_orders")
      .select(QUEUE_COLUMNS)
      .eq("status", tab.status)
      .order(sort.column, { ascending: sort.ascending }),
    db
      .from("video_orders")
      .select("id", { count: "exact", head: true })
      .in("status", PENDING_PAYMENT_STATUSES),
    ...TABS.map((entry) =>
      db.from("video_orders").select("id", { count: "exact", head: true }).eq("status", entry.status),
    ),
  ]);

  if (rowsResult.error) {
    console.error("video_orders kuyruk sorgusu başarısız", rowsResult.error);
  }

  const rows = (rowsResult.data as QueueRow[] | null) ?? [];
  const pendingCount = pendingResult.count ?? 0;
  const counts = Object.fromEntries(
    TABS.map((entry, index) => [entry.key, countResults[index]?.count ?? 0]),
  ) as Record<TabKey, number>;

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-8 font-body text-ink-900 md:px-8">
      <header className="flex flex-col gap-2">
        <h1 className="font-display text-2xl font-bold">Video siparişleri</h1>
        <p className="text-sm text-slate-500">Ödeme bekleyen: {pendingCount}</p>
      </header>

      <nav aria-label="Sipariş sekmeleri" className="flex flex-wrap gap-x-6 border-b border-mist-200">
        {TABS.map((entry) => {
          const active = entry.key === tab.key;
          return (
            <Link
              key={entry.key}
              href={`/admin/videos?tab=${entry.key}`}
              aria-current={active ? "page" : undefined}
              className={tabClass(active)}
            >
              {entry.label}{" "}
              <span className="ml-1 rounded-full bg-mist-200 px-2 py-0.5 text-xs text-ink-900">
                {counts[entry.key]}
              </span>
            </Link>
          );
        })}
      </nav>

      {rowsResult.error && (
        <Alert variant="error">Siparişler yüklenemedi. Lütfen sayfayı yenileyin.</Alert>
      )}

      {!rowsResult.error && rows.length === 0 && (
        <p className="rounded-xl border border-mist-200 bg-white p-6 text-slate-500">{tab.empty}</p>
      )}

      {!rowsResult.error && rows.length > 0 && (
        <ul className="flex flex-col gap-3">
          {rows.map((row) => {
            const property = one(row.properties);
            const agent = one(row.agents);
            const overdue = tab.key === "todo" && isOverdue(row.due_at);
            const dateLabel =
              tab.key === "todo" ? "Teslim" : tab.key === "done" ? "Teslim edildi" : "Talep";
            const dateValue =
              tab.key === "todo"
                ? row.due_at
                : tab.key === "done"
                  ? row.delivered_at
                  : row.created_at;
            const formatted = formatDate(dateValue);
            const dateText = formatted ? `${dateLabel}: ${formatted}` : null;

            return (
              <li key={row.id}>
                <Link
                  href={`/admin/videos/${row.id}`}
                  className={`flex flex-col gap-2 rounded-xl border bg-white p-5 hover:border-slate-500 ${
                    overdue ? "border-brick-700" : "border-mist-200"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="font-display text-lg font-bold">
                        {property?.title ?? "Adsız mülk"}
                      </h2>
                      <p className="text-sm text-slate-500">{property?.address ?? "-"}</p>
                    </div>
                    <span className={badgeClass(row.status)}>{STATUS_LABELS[row.status]}</span>
                  </div>
                  <p className="text-sm">
                    {agent?.company_name ?? "Adsız emlakçı"} · {agent?.phone ?? "-"} ·{" "}
                    {SERVICE_NAMES[row.service_code]}
                  </p>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                    {dateText && <span className="text-slate-500">{dateText}</span>}
                    {overdue && <span className="font-medium text-brick-700">Gecikti</span>}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
