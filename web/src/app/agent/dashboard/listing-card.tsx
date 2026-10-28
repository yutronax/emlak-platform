import {
  formatArrival,
  formatGroup,
  formatLocation,
  formatPrice,
} from "@/lib/listings-feed/format";
import type { FeedRow } from "@/lib/listings-feed/query";

export function ListingCard({ listing, now }: { listing: FeedRow; now: Date }) {
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
