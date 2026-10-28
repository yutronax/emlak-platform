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
};

type ListingRow = {
  id: string;
  title: string;
  price: number;
  currency: string;
  rooms: string | null;
  area_m2: number | null;
  city: string;
  district: string | null;
};

const BADGE_LABELS: Record<string, string> = {
  trialing: "Deneme sürümü",
  active: "Aktif",
  past_due: "Ödeme gecikmiş",
  canceled: "İptal edildi",
};

function badgeLabel(status: string | null): string {
  if (!status) return "Aboneliğiniz yok";
  return BADGE_LABELS[status] ?? `Abonelik: ${status}`;
}

export default async function AgentDashboardPage() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    redirect("/login");
  }

  // Önce açık (trialing/active/past_due) abonelik, yoksa en son satır (rozet için).
  let sub: SubscriptionRow | null = null;
  let subError = false;

  const open = await supabase
    .from("subscriptions")
    .select("status, current_period_end")
    .eq("agent_id", auth.user.id)
    .in("status", ["trialing", "active", "past_due"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (open.error) {
    subError = true;
  } else {
    sub = (open.data as SubscriptionRow | null) ?? null;
  }

  if (!subError && !sub) {
    const latest = await supabase
      .from("subscriptions")
      .select("status, current_period_end")
      .eq("agent_id", auth.user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latest.error) {
      subError = true;
    } else {
      sub = (latest.data as SubscriptionRow | null) ?? null;
    }
  }

  const badge = subError
    ? "Abonelik durumu yüklenemedi"
    : badgeLabel(sub?.status ?? null);

  // Erişim kararı (UX için; gerçek veri erişimi RLS'te kalır).
  const hasAccess =
    !subError &&
    sub !== null &&
    (sub.status === "active" || sub.status === "trialing") &&
    sub.current_period_end !== null &&
    new Date(sub.current_period_end) > new Date();

  let listings: ListingRow[] = [];
  let listingsError = false;
  if (hasAccess) {
    const { data, error } = await supabase
      .from("listings")
      .select("id,title,price,currency,rooms,area_m2,city,district")
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) {
      listingsError = true;
    } else {
      listings = (data as ListingRow[] | null) ?? [];
    }
  }

  return (
    <main className="mx-auto max-w-2xl p-8">
      <h1 className="text-xl font-semibold">Emlakçı Paneli</h1>
      <Link href="/agent/videos" className="mt-2 inline-block underline">
        Video siparişlerim
      </Link>
      <p className="mt-2 inline-block rounded border px-2 py-1 text-sm text-zinc-700 dark:text-zinc-300">
        {badge}
      </p>

      {!hasAccess && (
        <div className="mt-6 text-zinc-600 dark:text-zinc-400">
          <p>İlanları görmek için aktif abonelik gerekir.</p>
          <Link href="/account/subscription" className="mt-2 inline-block underline">
            Abone olun
          </Link>
        </div>
      )}

      {hasAccess && listingsError && (
        <p className="mt-6 text-red-600">İlanlar yüklenemedi.</p>
      )}

      {hasAccess && !listingsError && listings.length === 0 && (
        <p className="mt-6 text-zinc-600 dark:text-zinc-400">
          Şu an gösterilecek ilan yok.
        </p>
      )}

      {hasAccess && !listingsError && listings.length > 0 && (
        <ul className="mt-6">
          {listings.map((listing) => (
            <li key={listing.id} className="border-b py-3">
              <h2 className="font-medium">{listing.title}</h2>
              <p className="text-sm">
                {new Intl.NumberFormat("tr-TR").format(listing.price)}{" "}
                {listing.currency}
              </p>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                {listing.district
                  ? `${listing.city} / ${listing.district}`
                  : listing.city}
              </p>
              {(listing.rooms || listing.area_m2 !== null) && (
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  {[
                    listing.rooms,
                    listing.area_m2 !== null ? `${listing.area_m2} m²` : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
