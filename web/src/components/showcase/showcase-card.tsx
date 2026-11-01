import Link from "next/link";

import { DEAL_LABEL, formatDuration, formatShowcasePrice } from "@/lib/showcase-ui/format";
import type { ShowcaseItem } from "@/lib/showcase-ui/types";

// Poster yokken: id'den türetilen marka tonunda zemin + ilçe baş harfleri. Gerçek poster gelince <img>.
const TONES = ["bg-ink-900", "bg-moss-700", "bg-terracotta-700", "bg-slate-500"];
const tone = (id: string) => TONES[[...id].reduce((s, c) => s + c.charCodeAt(0), 0) % TONES.length];

export function Poster({ item, className = "" }: { item: ShowcaseItem; className?: string }) {
  return (
    <div className={`relative aspect-video overflow-hidden ${tone(item.id)} ${className}`}>
      {item.posterUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- harici CDN posteri; boyut bilinmiyor
        <img src={item.posterUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <span
          aria-hidden="true"
          className="absolute inset-0 flex items-end p-4 font-display text-5xl font-bold text-white/15"
        >
          {item.district}
        </span>
      )}
      <span
        aria-hidden="true"
        className="absolute top-1/2 left-1/2 flex h-12 w-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 pl-1 text-lg text-ink-900 shadow"
      >
        ▶
      </span>
      <span className="absolute right-2 bottom-2 rounded bg-ink-900/80 px-1.5 py-0.5 font-body text-xs text-white tabular-nums">
        <span className="sr-only">Video süresi </span>
        {formatDuration(item.durationSec)}
      </span>
    </div>
  );
}

export function ShowcaseCard({ item }: { item: ShowcaseItem }) {
  return (
    <article className="group relative flex flex-col overflow-hidden rounded-2xl border border-mist-200 bg-white font-body text-ink-900 transition-shadow focus-within:ring-2 focus-within:ring-terracotta-600 hover:shadow-[0_12px_32px_-16px_rgb(16_37_63/0.35)]">
      <Poster item={item} />
      <div className="flex flex-1 flex-col gap-1.5 p-4">
        <div className="flex items-center justify-between gap-2">
          <p className="font-display text-xl font-bold tabular-nums">{formatShowcasePrice(item.priceMinor, item.deal)}</p>
          <span className="rounded-full bg-fog-50 px-2.5 py-0.5 text-xs font-semibold text-slate-500">
            {DEAL_LABEL[item.deal]}
          </span>
        </div>
        <h3 className="line-clamp-2 text-sm font-medium">
          {/* Kartın tamamı tıklanabilir: bağlantı kartı kaplayan sözde öğeyle genişler. */}
          <Link href={`/vitrin/${item.id}`} className="outline-none after:absolute after:inset-0 after:content-['']">
            {item.title}
          </Link>
        </h3>
        <p className="text-sm text-slate-500">
          {item.district}, {item.city}
        </p>
        <p className="mt-auto pt-1 text-sm text-slate-500">
          {item.rooms} · {item.areaM2} m²
        </p>
      </div>
    </article>
  );
}
