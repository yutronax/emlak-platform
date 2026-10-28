import type { SupabaseClient } from "@supabase/supabase-js";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Alert } from "@/components/ui/alert";
import { parseFeedFilters, type SearchParams } from "@/lib/listings-feed/filters";
import { fetchFeed, fetchFilterOptions } from "@/lib/listings-feed/query";
import { getUnreadCount } from "@/lib/listings-feed/unread";
import { createClient } from "@/lib/supabase/server";

import { FeedFilters } from "./feed-filters";
import { ListingCard } from "./listing-card";
import { NotificationBell } from "./notification-bell";

// Next.js 16 Cache Components: cookies() (Supabase session) her istekte
// değişebilir, bu route segment'i prerender edilemez — statik build'i
// engellemesin diye bloklu/dinamik render'a izin veriyoruz.
export const instant = false;

type SubscriptionRow = {
  status: string;
  current_period_end: string | null;
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

// Yalnız hasAccess sonrası çağrılır. Seçenekler, ilanlar ve sayaç sırayla
// awaited edilir (aynı Supabase builder'ı üzerinde çakışmasın diye).
async function loadListings(
  supabase: SupabaseClient,
  params: SearchParams,
  userId: string,
) {
  const rawIl = typeof params.il === "string" ? params.il : null;
  const options = await fetchFilterOptions(supabase, rawIl);
  const { filters, hadInvalid } = parseFeedFilters(params, options);
  const feed = await fetchFeed(supabase, filters);

  const { data: agent } = await supabase
    .from("agents")
    .select("listings_seen_at")
    .eq("id", userId)
    .maybeSingle();
  const seenAt =
    (agent as { listings_seen_at: string | null } | null)?.listings_seen_at ?? null;
  const unread = await getUnreadCount(supabase, userId, seenAt);

  return { options, filters, hadInvalid, feed, unread };
}

export default async function AgentDashboardPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
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

  const listings = hasAccess
    ? await loadListings(supabase, params, auth.user.id)
    : null;
  const filters = listings?.filters;
  const isFiltered =
    filters !== undefined &&
    (filters.grup !== null ||
      filters.fiyatMin !== null ||
      filters.fiyatMax !== null ||
      filters.oda !== null ||
      filters.il !== null ||
      filters.ilce !== null);
  const now = new Date();

  return (
    <main className="mx-auto max-w-4xl bg-fog-50 p-4 md:p-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-ink-900">Emlakçı Paneli</h1>
          <Link href="/agent/videos" className="mt-2 inline-block text-terracotta-700 underline">
            Video siparişlerim
          </Link>
        </div>
        {listings && <NotificationBell initialCount={listings.unread ?? 0} />}
      </div>
      <p className="mt-2 inline-block rounded border border-mist-200 px-2 py-1 text-sm text-slate-500">
        {badge}
      </p>

      {!hasAccess && (
        <div className="mt-6 text-slate-500">
          <p>İlanları görmek için aktif abonelik gerekir.</p>
          <Link href="/account/subscription" className="mt-2 inline-block text-terracotta-700 underline">
            Abone olun
          </Link>
        </div>
      )}

      {listings && (
        <>
          <FeedFilters options={listings.options} filters={listings.filters} />

          {listings.hadInvalid && (
            <p className="mt-3 text-sm text-slate-500">
              Bazı filtreler geçersizdi, uygulanmadı
            </p>
          )}

          {!listings.feed.ok && (
            <div className="mt-6">
              <Alert variant="error">İlanlar yüklenemedi.</Alert>
            </div>
          )}

          {listings.feed.ok && listings.feed.items.length === 0 && (
            <div className="mt-6 text-slate-500">
              <p>
                {isFiltered
                  ? "Filtreye uyan ilan yok."
                  : "Şu an gösterilecek ilan yok."}
              </p>
              {isFiltered && (
                <Link href="/agent/dashboard" className="mt-2 inline-block text-terracotta-700 underline">
                  Filtreleri temizle
                </Link>
              )}
            </div>
          )}

          {listings.feed.ok && listings.feed.items.length > 0 && (
            <ul className="mt-6 grid gap-3 md:grid-cols-2">
              {listings.feed.items.map((listing) => (
                <ListingCard key={listing.id} listing={listing} now={now} />
              ))}
            </ul>
          )}
        </>
      )}
    </main>
  );
}
