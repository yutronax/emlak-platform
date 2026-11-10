import Link from "next/link";
import type { CSSProperties } from "react";

import {
  formatArrival,
  formatGroup,
  formatLocation,
  formatPrice,
} from "@/lib/listings-feed/format";
import type { FeedItem, LockedFeedRow, OpenFeedRow } from "@/lib/listings-feed/query";

// index: listedeki sıra; yalnız ilk altı kart sırayla (stagger) girer, gerisi gecikmesiz görünür.
export function ListingCard({ listing, now, index }: { listing: FeedItem; now: Date; index?: number }) {
  const enter =
    index === undefined
      ? undefined
      : {
          className: index < 6 ? "panel-enter panel-stagger" : "panel-enter",
          style: { "--enter-index": index } as CSSProperties,
        };
  if (listing.locked) {
    return <LockedListingCard listing={listing} now={now} enter={enter} />;
  }
  return <OpenListingCard listing={listing} now={now} enter={enter} />;
}

type Enter = { className: string; style: CSSProperties } | undefined;

// Ana içerik yüzeyi: sıcak beyaz, taş çizgi, hafif gölge (kapsül ve rozetlerden ayrışır).
// Terakota her kartın süsü değil; yalnız gerçek vurgu anlarına (kendi grubun rozeti, odak) ayrılır.
const cardBase =
  "@container flex h-full flex-col rounded-xl border border-stone-200 bg-panel-surface shadow-[0_4px_16px_rgb(38_51_45/5%)]";


const lockIcon = (
  <svg
    aria-hidden="true"
    viewBox="0 0 20 20"
    className="h-5 w-5"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.75}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="4" y="9" width="12" height="8" rx="2" />
    <path d="M7 9V6.5a3 3 0 0 1 6 0V9" />
  </svg>
);

// Stitch "İlan Havuzu" kartı: üstte görsel bandı, altta fiyat > başlık > haplar > konum/zaman > kaynak,
// en altta tek gerçek eylem: bu ilan için dikey video siparişi. Görsel olmadığından bant dürüst bir
// mimari yer tutucu; Stitch'teki "Detay", favori ve "doğrulandı" rozetleri karşılığı olmadığı için yok.
// Fiyat yoksa eksiklik cümlesi en büyük metin olmaz; sakin ikincil metne iner.
function OpenListingCard({ listing, now, enter }: { listing: OpenFeedRow; now: Date; enter: Enter }) {
  return (
    <li
      style={enter?.style}
      className={`${cardBase} ${enter?.className ?? ""} overflow-hidden transition-colors duration-(--motion-ui) ease-(--ease-ui) hover:border-panel-line-strong focus-within:border-terracotta-600`}
    >
      <div aria-hidden="true" className="panel-placeholder h-28 border-b border-panel-line" />
      <div className="flex flex-1 flex-col p-4 @md:p-5">
        <div className="flex min-w-0 flex-wrap items-start justify-between gap-2">
          {listing.price === null ? (
            <p className="text-sm text-charcoal/70">{formatPrice(listing.price, listing.currency)}</p>
          ) : (
            <p className="font-display text-[1.625rem] leading-[1.15] tabular-nums">
              {formatPrice(listing.price, listing.currency)}
            </p>
          )}
          {listing.owner_agent_id ? (
            <span className="shrink-0 rounded-full bg-terracotta-600/10 px-2 py-1 text-[0.6875rem] leading-none font-medium text-terracotta-700">
              Kendi grubun
            </span>
          ) : null}
        </div>
        {listing.title ? (
          <h2 className="mt-1.5 line-clamp-2 font-display text-lg leading-snug text-ink-900">{listing.title}</h2>
        ) : (
          <h2 className="mt-1.5 font-display text-lg text-charcoal/60">Başlıksız ilan</h2>
        )}
        {(listing.rooms || listing.area_m2 !== null) && (
          <div className="mt-3 flex flex-wrap gap-1.5 text-xs font-medium text-ink-900">
            {listing.rooms ? <span className="rounded-md bg-panel-muted px-2.5 py-1">{listing.rooms}</span> : null}
            {listing.area_m2 !== null ? (
              <span className="rounded-md bg-panel-muted px-2.5 py-1">{`${listing.area_m2} m²`}</span>
            ) : null}
          </div>
        )}
        <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-charcoal/75">
          <span>{formatLocation(listing.city, listing.district)}</span>
          <span aria-hidden="true">·</span>
          <span>{formatArrival(listing.created_at, now)}</span>
        </div>
        <p className="mt-1 truncate text-xs text-charcoal/65">{formatGroup(listing.source_group_name)}</p>
        <div className="mt-auto pt-4">
          <Link
            href="/agent/videos/new"
            className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-terracotta-600 px-4 text-sm font-semibold text-white hover:bg-terracotta-700"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 20 20"
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.75}
              strokeLinejoin="round"
            >
              <rect x="3" y="5" width="10" height="10" rx="1.5" />
              <path d="m13 9 4-2v6l-4-2" />
            </svg>
            9:16 video sipariş et
          </Link>
        </div>
      </div>
    </li>
  );
}

// Kilitli kart (EML-98 AC-4): sunucu yalnız il/ilçe + geliş zamanı verir.
// Başlık, fiyat ve diğer alanlar hiç render edilmez. Stitch'teki gibi koyu, ortalanmış kilit durumu.
function LockedListingCard({ listing, now, enter }: { listing: LockedFeedRow; now: Date; enter: Enter }) {
  return (
    <li
      style={enter?.style}
      className={`${cardBase} ${enter?.className ?? ""} items-center justify-center gap-3 border-panel-deep bg-panel-deep p-6 text-center text-cream-50`}
    >
      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-terracotta-600/20 text-terracotta-600">
        {lockIcon}
      </span>
      <p className="font-display text-lg">Kilitli ilan</p>
      <p className="max-w-xs text-sm text-cream-50/75">Başlık ve fiyat planınızın sınırı dışında kalıyor.</p>
      <p className="flex flex-wrap justify-center gap-x-2 text-sm text-cream-50/75">
        <span>{formatLocation(listing.city, listing.district)}</span>
        <span aria-hidden="true">·</span>
        <span>{formatArrival(listing.created_at, now)}</span>
      </p>
      <Link
        href="/pricing"
        className="mt-1 inline-flex min-h-11 items-center rounded-full bg-terracotta-600 px-5 text-sm font-semibold text-white hover:bg-terracotta-700"
      >
        Planı yükselt
      </Link>
    </li>
  );
}
