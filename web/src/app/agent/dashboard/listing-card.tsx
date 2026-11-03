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

const metaRow =
  "mt-auto flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-t border-stone-200 pt-3 text-sm text-charcoal/70";

// Hiyerarşi: fiyat (karar verdiren) > başlık > oda/m² etiketleri > konum ve zaman > kaynak grup.
// Görsel yokken mimari işaret küçük kalır; bilgi, dekorasyondan önce gelir.
// Fiyat yoksa eksiklik cümlesi en büyük metin olmaz; sakin ikincil metne iner.
// Kartta tıklanabilir bağlantı olmadığı için hover'da yükselme yok (tıklanabilirlik vaadi vermez);
// yalnız sınır rengi değişir.
function OpenListingCard({ listing, now, enter }: { listing: OpenFeedRow; now: Date; enter: Enter }) {
  return (
    <li
      style={enter?.style}
      className={`${cardBase} ${enter?.className ?? ""} transition-colors duration-(--motion-ui) ease-(--ease-ui) hover:border-panel-line-strong focus-within:border-terracotta-600`}
    >
      <div className="grid h-full grid-cols-[64px_minmax(0,1fr)] gap-3 p-4 @md:grid-cols-[96px_minmax(0,1fr)] @md:gap-4 @md:p-5">
        <div aria-hidden="true" className="panel-placeholder h-16 w-16 rounded-lg @md:h-24 @md:w-24" />
        <div className="flex min-w-0 flex-col">
          <div className="flex min-w-0 flex-col items-start gap-1.5 @md:flex-row @md:items-start @md:justify-between @md:gap-3">
            {listing.price === null ? (
              <p className="text-sm text-charcoal/70">{formatPrice(listing.price, listing.currency)}</p>
            ) : (
              <p className="text-[clamp(1.25rem,6.25vw,1.5rem)] leading-[1.15] font-semibold text-ink-900 tabular-nums">
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
            <h2 className="mt-1.5 line-clamp-2 font-medium text-ink-900">{listing.title}</h2>
          ) : (
            <h2 className="mt-1.5 font-medium text-charcoal/60">Başlıksız ilan</h2>
          )}
          {(listing.rooms || listing.area_m2 !== null) && (
            <div className="mt-3 flex flex-wrap gap-1.5 text-xs font-medium text-ink-900">
              {listing.rooms ? <span className="rounded-full bg-panel-muted px-2.5 py-1">{listing.rooms}</span> : null}
              {listing.area_m2 !== null ? (
                <span className="rounded-full bg-panel-muted px-2.5 py-1">{`${listing.area_m2} m²`}</span>
              ) : null}
            </div>
          )}
          <div className={`${metaRow} mt-4`}>
            <span>{formatLocation(listing.city, listing.district)}</span>
            <span>{formatArrival(listing.created_at, now)}</span>
          </div>
          <p className="mt-1 truncate text-xs text-charcoal/65">{formatGroup(listing.source_group_name)}</p>
        </div>
      </div>
    </li>
  );
}

// Kilitli kart (EML-98 AC-4): sunucu yalnız il/ilçe + geliş zamanı verir.
// Başlık, fiyat ve diğer alanlar hiç render edilmez; bulanık sahte içerik yerine bilinçli bir kilit durumu.
function LockedListingCard({ listing, now, enter }: { listing: LockedFeedRow; now: Date; enter: Enter }) {
  return (
    <li style={enter?.style} className={`${cardBase} ${enter?.className ?? ""} bg-[#F6F3EC] p-4 shadow-none @md:p-5`}>
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-panel-muted text-ink-900">
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
        </span>
        <div className="min-w-0">
          <p className="font-medium text-ink-900">Kilitli ilan</p>
          <p className="mt-0.5 text-sm text-charcoal/70">Başlık ve fiyat planınızın sınırı dışında kalıyor.</p>
        </div>
      </div>
      <div className={`${metaRow} mt-4`}>
        <span>{formatLocation(listing.city, listing.district)}</span>
        <span>{formatArrival(listing.created_at, now)}</span>
      </div>
      <Link
        href="/pricing"
        className="mt-2 inline-flex min-h-11 items-center text-sm font-medium text-terracotta-700 underline-offset-4 hover:underline"
      >
        Planı yükselt
      </Link>
    </li>
  );
}
