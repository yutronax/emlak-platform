import Link from "next/link";

import { DEAL_LABEL, formatDuration, formatShowcasePrice } from "@/lib/showcase-ui/format";
import type { ShowcaseItem } from "@/lib/showcase-ui/types";

import { HoverVideo } from "./hover-video";

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
          className="absolute inset-0 flex items-end p-4 font-display text-5xl font-light tracking-[-0.04em] text-white/20"
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

// Stitch "Gayrimenkul Video Vitrini" kartı: dikey (9:16) koyu kart, poster tam boy, bilgiler alttaki
// gölge geçişinin üstünde. Dikey video formatını vitrinde de hissettirir. Detay sayfası Poster'ı ayrıca kullanır.
export function ShowcaseCard({ item }: { item: ShowcaseItem }) {
  return (
    <article className="group relative flex aspect-[9/16] w-full flex-col justify-end overflow-hidden rounded-xl bg-panel-deep font-body text-cream-50 shadow-[0_8px_24px_rgb(38_51_45/14%)] transition-shadow focus-within:ring-2 focus-within:ring-terracotta-600 hover:shadow-[0_16px_40px_rgb(38_51_45/24%)]">
      <div aria-hidden="true" className={`absolute inset-0 ${tone(item.id)}`}>
        {item.videoUrl ? (
          // Fare üstündeyken oynayan, ayrılınca başa saran sessiz önizleme.
          <HoverVideo src={item.videoUrl} poster={item.posterUrl} />
        ) : item.posterUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- harici CDN posteri; boyut bilinmiyor
          <img
            src={item.posterUrl}
            alt=""
            className="panel-media-zoom h-full w-full object-cover"
          />
        ) : (
          <span className="absolute inset-x-0 top-1/3 px-4 font-display text-5xl text-white/15">{item.district}</span>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-panel-deep via-panel-deep/45 to-transparent" />
        <span className="absolute top-1/2 left-1/2 flex h-12 w-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white/25 pl-0.5 text-lg text-white backdrop-blur-sm transition-opacity group-hover:opacity-0 group-focus-within:opacity-0">
          ▶
        </span>
      </div>

      <div className="absolute inset-x-3 top-3 flex items-center justify-between gap-2">
        <span
          className={`rounded-full px-2 py-0.5 text-[0.6875rem] font-semibold ${
            item.deal === "kiralik" ? "bg-cream-50 text-ink-900" : "bg-terracotta-600 text-white"
          }`}
        >
          {DEAL_LABEL[item.deal]}
        </span>
        <span className="rounded-full bg-panel-deep/70 px-2 py-0.5 text-[0.6875rem] text-white tabular-nums">
          <span className="sr-only">Video süresi </span>
          {formatDuration(item.durationSec)}
        </span>
      </div>

      <div className="relative flex flex-col gap-1 p-4">
        <h3 className="line-clamp-2 font-display text-lg leading-snug">
          {/* Kartın tamamı tıklanabilir: bağlantı kartı kaplayan sözde öğeyle genişler. */}
          <Link href={`/vitrin/${item.id}`} className="outline-none after:absolute after:inset-0 after:content-['']">
            {item.title}
          </Link>
        </h3>
        <p className="text-xs text-cream-50/75">
          {item.district}, {item.city} · {item.rooms} · {item.areaM2} m²
        </p>
        <p className="mt-1 font-display text-2xl tabular-nums">{formatShowcasePrice(item.priceMinor, item.deal)}</p>
      </div>
    </article>
  );
}
