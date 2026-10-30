import Link from "next/link";

import {
  formatArrival,
  formatGroup,
  formatLocation,
  formatPrice,
} from "@/lib/listings-feed/format";
import type { FeedItem, LockedFeedRow, OpenFeedRow } from "@/lib/listings-feed/query";

export function ListingCard({ listing, now }: { listing: FeedItem; now: Date }) {
  if (listing.locked) {
    return <LockedListingCard listing={listing} now={now} />;
  }
  return <OpenListingCard listing={listing} now={now} />;
}

function OpenListingCard({ listing, now }: { listing: OpenFeedRow; now: Date }) {
  return (
    <li className="rounded-md border border-mist-200 bg-white p-4">
      <p className="text-sm text-slate-500">{formatGroup(listing.source_group_name)}</p>
      <h2 className="mt-1 font-medium text-ink-900">{listing.title}</h2>
      <p className="mt-2 font-semibold text-ink-900">
        {formatPrice(listing.price, listing.currency)}
      </p>
      <div className="mt-1 flex flex-wrap gap-x-3 text-sm text-slate-500">
        {listing.rooms ? <span>{listing.rooms}</span> : null}
        {listing.area_m2 !== null ? <span>{`${listing.area_m2} m²`}</span> : null}
        <span>{formatLocation(listing.city, listing.district)}</span>
        <span>{formatArrival(listing.created_at, now)}</span>
      </div>
    </li>
  );
}

// Kilitli kart (EML-98 AC-4): sunucu yalnız il/ilçe + geliş zamanı verir.
// Başlık, fiyat ve diğer alanlar hiç render edilmez; yer tutucu çizgiler dekoratif.
function LockedListingCard({ listing, now }: { listing: LockedFeedRow; now: Date }) {
  return (
    <li className="rounded-md border border-dashed border-mist-200 bg-white p-4">
      <div className="flex flex-wrap gap-x-3 text-sm text-slate-500">
        <span>{formatLocation(listing.city, listing.district)}</span>
        <span>{formatArrival(listing.created_at, now)}</span>
      </div>
      <div aria-hidden="true" className="mt-3 flex flex-col gap-2 blur-sm">
        <div className="h-4 w-3/4 rounded bg-mist-200" />
        <div className="h-4 w-1/2 rounded bg-mist-200" />
      </div>
      <Link href="/pricing" className="mt-3 inline-block text-sm text-terracotta-700 underline">
        Planı yükselt
      </Link>
    </li>
  );
}
