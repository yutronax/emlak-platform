import { createClient } from "@/lib/supabase/server";

// Next.js 16 Cache Components: cookies() (Supabase session) her istekte
// değişebilir, bu route segment'i prerender edilemez — statik build'i
// engellemesin diye bloklu/dinamik render'a izin veriyoruz.
export const instant = false;

type SubscriptionStatusRow = {
  status: string;
};

const BADGE_LABELS: Record<string, string> = {
  active: "Abonelik: Aktif",
  past_due: "Abonelik: Ödeme gecikmiş",
};

function badgeLabel(status: string | null): string {
  if (!status) return "Aboneliğiniz yok";
  return BADGE_LABELS[status] ?? `Abonelik: ${status}`;
}

export default async function AgentDashboardPage() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();

  let badge: string | null = null;
  if (auth.user) {
    const { data, error } = await supabase
      .from("subscriptions")
      .select("status")
      .eq("agent_id", auth.user.id)
      .in("status", ["active", "past_due"])
      .maybeSingle();

    badge = error
      ? "Abonelik durumu yüklenemedi"
      : badgeLabel((data as SubscriptionStatusRow | null)?.status ?? null);
  }

  return (
    <main className="mx-auto max-w-2xl p-8">
      <h1 className="text-xl font-semibold">Emlakçı Paneli</h1>
      {badge && (
        <p className="mt-2 inline-block rounded border px-2 py-1 text-sm text-zinc-700 dark:text-zinc-300">
          {badge}
        </p>
      )}
      <p className="mt-2 text-zinc-600 dark:text-zinc-400">
        Supabase Auth girişi ve abonelik durumuna göre onaylı ilan akışı
        Faz 4&apos;te buraya eklenecek.
      </p>
    </main>
  );
}
