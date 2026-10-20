import Link from "next/link";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

// Next.js 16 Cache Components: cookies() (Supabase session) her istekte
// değişebilir, bu route segment'i prerender edilemez — statik build'i
// engellemesin diye bloklu/dinamik render'a izin veriyoruz.
export const instant = false;

type SubscriptionRow = {
  status: string;
  current_period_end: string | null;
  plan: { name: string } | null;
};

const STATUS_LABELS: Record<string, string> = {
  active: "Aktif",
  past_due: "Gecikmiş",
  pending: "Ödeme bekleniyor",
  failed: "Başarısız",
  needs_review: "İnceleniyor",
  canceled: "İptal edildi",
};

const dateFormatter = new Intl.DateTimeFormat("tr-TR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: "Europe/Istanbul",
});

function formatDate(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : dateFormatter.format(date);
}

export default async function AccountSubscriptionPage() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    redirect("/login");
  }

  const { data, error } = await supabase
    .from("subscriptions")
    .select("status, current_period_end, plan:plans(name)")
    .eq("agent_id", auth.user.id)
    .maybeSingle();

  if (error) {
    console.error("subscriptions sorgusu başarısız", error);
    return (
      <main className="mx-auto max-w-2xl p-8">
        <h1 className="text-xl font-semibold">Aboneliğim</h1>
        <p className="mt-4 text-red-600">
          Abonelik bilgisi yüklenemedi, lütfen daha sonra tekrar deneyin.
        </p>
      </main>
    );
  }

  const subscription = data as SubscriptionRow | null;

  if (!subscription) {
    return (
      <main className="mx-auto max-w-2xl p-8">
        <h1 className="text-xl font-semibold">Aboneliğim</h1>
        <p className="mt-4 text-zinc-600 dark:text-zinc-400">
          Aboneliğiniz yok.{" "}
          <Link href="/pricing" className="underline">
            Planları görüntüle
          </Link>
        </p>
      </main>
    );
  }

  const isPastDue = subscription.status === "past_due";

  return (
    <main className="mx-auto max-w-2xl p-8">
      <h1 className="text-xl font-semibold">Aboneliğim</h1>

      {isPastDue && (
        <p className="mt-4 rounded border border-red-300 p-4 text-sm text-red-600">
          Ödemeniz gecikti. Aboneliğinizin devamı için lütfen ödemenizi
          tamamlayın.
        </p>
      )}

      <dl className="mt-6 grid grid-cols-2 gap-2 text-sm">
        <dt className="text-zinc-500">Plan</dt>
        <dd>{subscription.plan?.name ?? "—"}</dd>
        <dt className="text-zinc-500">Durum</dt>
        <dd>{STATUS_LABELS[subscription.status] ?? subscription.status}</dd>
        <dt className="text-zinc-500">Dönem sonu</dt>
        <dd>{formatDate(subscription.current_period_end)}</dd>
      </dl>
    </main>
  );
}
