import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { parseFilters } from "@/lib/showcase-ui/filters";
import { getShowcaseService } from "@/lib/showcase-ui/service";
import { STOCK } from "@/lib/stock-images";

import { ShowcaseClient } from "./showcase-client";

// Filtreler query'den okunur (istek zamanlı).
export const instant = false;

export const metadata: Metadata = {
  title: "Videolu vitrin · Emlak Platformu",
  description: "Satılık ve kiralık evleri gezmeden önce videosunu izleyin.",
};

export default async function ShowcasePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // Gerçek vitrin servisi yokken sayfa yayında değil (sahte ilan gösterilmez).
  if (!getShowcaseService()) notFound();
  const filters = parseFilters(await searchParams);

  return (
    <main className="flex-1 bg-cream-50 text-charcoal">
      {/* Ana sayfa ilk ekranının kısa hali: fotoğraf (süs, CSS arka plan) + ince dev başlık. */}
      <header className="relative isolate flex min-h-[46svh] flex-col justify-end overflow-hidden bg-ink-900 text-cream-50">
        <div aria-hidden="true" className="absolute inset-0 -z-10">
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url("${STOCK.heroLiving.src(1800)}")` }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-ink-900 via-ink-900/60 to-ink-900/20" />
        </div>
        <div className="mx-auto w-full max-w-6xl px-4 pt-24 pb-10 md:px-6 md:pb-14">
          <p className="font-body text-xs font-medium tracking-[0.2em] text-cream-50/70 uppercase">Videolu vitrin</p>
          <h1 className="mt-3 max-w-4xl font-display text-[2.5rem] leading-[1] font-light tracking-[-0.045em] text-balance md:text-7xl">
            Evi gezmeden önce <em className="accent">videosunu</em> izleyin.
          </h1>
          <p className="mt-4 max-w-xl font-body text-cream-50/80">
            Emlakçıların editörlerimizle hazırladığı videolu ilanlar. Beğendiğinizde doğrudan WhatsApp&apos;tan yazın.
          </p>
        </div>
        <p className="absolute bottom-2 left-4 font-body text-[10px] text-cream-50/50 md:right-3 md:left-auto">
          Fotoğraf: {STOCK.heroLiving.credit}
        </p>
      </header>
      <ShowcaseClient initialFilters={filters} />
    </main>
  );
}
