import type { SupabaseClient } from "@supabase/supabase-js";
import Link from "next/link";
import { connection } from "next/server";
import { redirect } from "next/navigation";

import { Alert } from "@/components/ui/alert";
import { parseFeedFilters, type ParsedFilters, type SearchParams } from "@/lib/listings-feed/filters";
import { fetchFeed, fetchFilterOptions } from "@/lib/listings-feed/query";
import { getUnreadCount } from "@/lib/listings-feed/unread";
import { createClient } from "@/lib/supabase/server";

import { FeedFilters } from "./feed-filters";
import { ListingCard } from "./listing-card";
import { NotificationBell } from "./notification-bell";
import { PushToggle } from "./push-toggle";

// Next.js 16 Cache Components: cookies() (Supabase session) her istekte
// değişebilir, bu route segment'i prerender edilemez — statik build'i
// engellemesin diye bloklu/dinamik render'a izin veriyoruz.
export const instant = false;

type SubscriptionRow = {
  status: string;
  current_period_end: string | null;
};

// Hata ekranındaki "Tekrar dene" — mevcut filtre/sayfa parametreleri korunur.
function buildRetryHref(params: SearchParams): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) {
      for (const item of value) query.append(key, item);
    } else if (value !== undefined) {
      query.append(key, value);
    }
  }
  const qs = query.toString();
  return qs ? `/agent/dashboard?${qs}` : "/agent/dashboard";
}

// Uygulanan filtre kapsülleri: normalize edilmiş filtrelerden üretilir (ham query'den değil).
// Kaldırma linki diğer filtreleri korur, sayfayı 1'e döndürür; il kalkınca ilçe de kalkar.
const FILTER_PARAMS = {
  il: "il",
  ilce: "ilce",
  oda: "oda",
  fiyatMin: "fiyat_min",
  fiyatMax: "fiyat_max",
  grup: "grup",
  kapsam: "kapsam",
} as const;

type FilterKey = keyof typeof FILTER_PARAMS;

function buildActiveFilters(filters: ParsedFilters) {
  const price = (n: number) => `${n.toLocaleString("tr-TR")} TRY`;
  const entries: { key: FilterKey; label: string; value: string | null }[] = [
    { key: "il", label: "İl", value: filters.il },
    { key: "ilce", label: "İlçe", value: filters.ilce },
    { key: "oda", label: "Oda", value: filters.oda },
    { key: "fiyatMin", label: "En düşük", value: filters.fiyatMin === null ? null : price(filters.fiyatMin) },
    { key: "fiyatMax", label: "En yüksek", value: filters.fiyatMax === null ? null : price(filters.fiyatMax) },
    { key: "grup", label: "Grup", value: filters.grup },
    { key: "kapsam", label: "Kapsam", value: filters.kapsam === "mine" ? "Kendi gruplarım" : null },
  ];

  function hrefWithout(removed: FilterKey) {
    const query = new URLSearchParams();
    for (const key of Object.keys(FILTER_PARAMS) as FilterKey[]) {
      if (key === removed || (removed === "il" && key === "ilce")) continue;
      const value = filters[key];
      if (value !== null) query.set(FILTER_PARAMS[key], String(value));
    }
    const qs = query.toString();
    return qs ? `/agent/dashboard?${qs}` : "/agent/dashboard";
  }

  return entries
    .filter((e): e is { key: FilterKey; label: string; value: string } => e.value !== null)
    .map((e) => ({ ...e, removeHref: hrefWithout(e.key) }));
}

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
  // Date.now (Supabase getUser ve aşağıdaki new Date() çağrıları) prerender
  // sırasında çalışmasın diye ilk await'ten önce istek-zamanlı işaretleme yapılır.
  await connection();
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

  // AC-6: abonelik hiç yoksa ve deneme daha önce açılmadıysa start_trial() bir kez dener.
  let trialFailed = false;
  if (!subError && sub === null) {
    const { data: agent, error: agentError } = await supabase
      .from("agents")
      .select("trial_started_at")
      .eq("id", auth.user.id)
      .maybeSingle();
    const trialStartedAt =
      (agent as { trial_started_at: string | null } | null)?.trial_started_at ?? null;

    if (agentError) {
      trialFailed = true;
      console.error("trial_create_failed", { agent_id: auth.user.id, reason: "agent_read_failed" });
    } else if (trialStartedAt === null) {
      const { data: started, error: rpcError } = await supabase.rpc("start_trial");
      if (rpcError) {
        trialFailed = true;
        console.error("trial_create_failed", {
          agent_id: auth.user.id,
          error_code: rpcError.code ?? "unknown",
        });
      } else if (started === true) {
        const created = await supabase
          .from("subscriptions")
          .select("status, current_period_end")
          .eq("agent_id", auth.user.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (created.error) {
          subError = true;
        } else {
          sub = (created.data as SubscriptionRow | null) ?? null;
        }
      } else {
        trialFailed = true;
        console.error("trial_create_failed", { agent_id: auth.user.id, reason: "no_row" });
      }
    }
  }

  const badge = subError
    ? "Abonelik durumu yüklenemedi"
    : badgeLabel(sub?.status ?? null);

  // Ön kontrol (UX): satır var ve dönem süresi dolmamış. Durum kuralı (active /
  // trialing / past_due) feed_access() içinde tek yerde tutulur; sunucu
  // aboneliksiz derse feedNoSubscription ile erişim ekranına düşülür.
  const hasAccess =
    !subError &&
    sub !== null &&
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
      filters.ilce !== null ||
      filters.kapsam !== null);
  const activeFilters = filters ? buildActiveFilters(filters) : [];
  const now = new Date();
  // Sunucu aboneliksiz derse (reason) erişim ekranı gösterilir, liste gizlenir.
  const feedNoSubscription =
    listings?.feed.ok === true && listings.feed.reason === "no_subscription";
  const showNoAccess = !hasAccess || feedNoSubscription;
  // Şifre yenileme sonrası yönlendirme işareti (/sifre-yenile).
  const passwordUpdated = params.password_updated === "1";

  const card = "rounded-leaf border border-charcoal/10 bg-white";

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-6 font-body text-ink-900 md:px-6 md:py-12">
      <header className="panel-enter flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full bg-[#EAE5D9] px-2.5 py-1 text-xs font-medium text-[#665D48]">
            <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-terracotta-600" />
            {badge}
          </p>
          <h1 className="mt-3 font-display text-[1.75rem] leading-tight tracking-[-0.025em] md:text-4xl">
            İlanlar
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-[1.5] text-charcoal/75 md:text-base">
            WhatsApp gruplarınızdan ve ortak havuzdan gelen güncel ilanlar.
          </p>
        </div>
        {listings && !feedNoSubscription && (
          <div className="flex items-center gap-2">
            <PushToggle />
            <NotificationBell initialCount={listings.unread ?? 0} />
          </div>
        )}
      </header>

      {passwordUpdated && (
        <div className="mt-6">
          <Alert variant="success">Şifreniz güncellendi.</Alert>
        </div>
      )}

      {trialFailed && (
        <div className="mt-6 flex flex-col items-start gap-2">
          <Alert variant="error">Denemeniz başlatılamadı, destekle iletişime geçin</Alert>
          <Link href="/pricing" className="text-sm font-medium text-terracotta-700 underline-offset-4 hover:underline">
            Fiyatları gör
          </Link>
        </div>
      )}

      {showNoAccess && (
        <div className={`${card} mt-8 flex flex-col items-start gap-3 p-6 md:p-8`}>
          <p className="font-display text-2xl font-normal tracking-[-0.03em]">İlanları görmek için aktif abonelik gerekir.</p>
          <Link
            href="/account/subscription"
            className="inline-flex h-11 items-center rounded-leaf bg-ink-900 px-5 text-sm font-medium text-white hover:bg-ink-800"
          >
            Abone olun
          </Link>
        </div>
      )}

      {listings && !feedNoSubscription && (
        <div className="panel-enter mt-6 flex flex-col gap-4 [--enter-delay:40ms] [--motion-enter:240ms] md:mt-8">
          {/* Sonuçlar önce: filtreler kapalı bir panelde, uygulananlar kapsül olarak dışarıda. */}
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-stone-200 pb-3">
            <p className="text-sm font-semibold">
              {listings.feed.ok ? `Bu sayfada ${listings.feed.items.length} ilan` : "Sonuçlar yüklenemedi"}
            </p>
            {listings.feed.ok && listings.feed.limit !== null && (
              <p className="flex flex-wrap items-center gap-x-3 text-sm text-charcoal/75">
                <span className="tabular-nums">{`Bugün ${listings.feed.openToday}/${listings.feed.limit} ilan açık`}</span>
                {(listings.feed.lockedCount === null || listings.feed.lockedCount > 0) && (
                  <Link href="/pricing" className="font-medium text-terracotta-700 underline-offset-4 hover:underline">
                    Planı yükselt
                  </Link>
                )}
              </p>
            )}
          </div>

          <details className="panel-details group rounded-xl border border-stone-200 bg-transparent open:bg-[#FFFEFA]">
            <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-medium [&::-webkit-details-marker]:hidden">
              <span>
                Filtrele
                {activeFilters.length > 0 && (
                  <span className="ml-2 font-normal text-charcoal/70">{`(${activeFilters.length} etkin)`}</span>
                )}
              </span>
              <svg
                aria-hidden="true"
                viewBox="0 0 20 20"
                className="h-5 w-5 transition-transform duration-180 ease-(--ease-ui) group-open:rotate-180 motion-reduce:transition-none"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.75}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M5 8l5 5 5-5" />
              </svg>
            </summary>
            <div className="border-t border-stone-200 p-4 md:p-6">
              <FeedFilters options={listings.options} filters={listings.filters} active={isFiltered} />
            </div>
          </details>

          {activeFilters.length > 0 && (
            <ul aria-label="Uygulanan filtreler" className="flex flex-wrap items-center gap-2">
              {activeFilters.map((f) => (
                <li key={f.key}>
                  <Link
                    href={f.removeHref}
                    aria-label={`${f.label}: ${f.value} filtresini kaldır`}
                    className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-transparent bg-[#EAE5D9] px-3 text-xs font-medium hover:border-charcoal/40"
                  >
                    <span className="text-charcoal/70">{f.label}:</span>
                    <span className="max-w-[16rem] truncate">{f.value}</span>
                    <span aria-hidden="true" className="text-sm leading-none">×</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}

          <section aria-label="İlan listesi" className="flex min-w-0 flex-col gap-4">

            {listings.hadInvalid && (
              <p className="text-sm text-charcoal/60">Bazı filtreler geçersizdi, uygulanmadı</p>
            )}

            {!listings.feed.ok && (
              <div className="flex flex-col items-start gap-2">
                <Alert variant="error">İlanlar yüklenemedi.</Alert>
                <Link
                  href={buildRetryHref(params)}
                  className="text-sm font-medium text-terracotta-700 underline-offset-4 hover:underline"
                >
                  Tekrar dene
                </Link>
              </div>
            )}

            {listings.feed.ok && listings.feed.items.length === 0 && (
              <div className={`${card} flex flex-col items-start gap-2 border-dashed p-8`}>
                <p className="font-display text-xl font-normal tracking-[-0.03em]">
                  {isFiltered ? "Filtreye uyan ilan yok." : "Şu an gösterilecek ilan yok."}
                </p>
                <p className="text-sm text-charcoal/60">
                  {isFiltered
                    ? "Filtreleri genişletip tekrar deneyin."
                    : "Gruplarınıza yeni ilan düştüğünde burada görünür."}
                </p>
                {isFiltered && (
                  <Link href="/agent/dashboard" className="mt-1 text-sm font-medium text-terracotta-700 underline-offset-4 hover:underline">
                    Filtreleri temizle
                  </Link>
                )}
              </div>
            )}

            {listings.feed.ok && listings.feed.items.length > 0 && (
              <ul className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {listings.feed.items.map((listing, index) => (
                  <ListingCard key={listing.id} listing={listing} now={now} index={index} />
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </main>
  );
}