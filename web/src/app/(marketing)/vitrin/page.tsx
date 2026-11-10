import type { Metadata } from "next";

import { parseFilters } from "@/lib/showcase-ui/filters";

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
  const filters = parseFilters(await searchParams);

  return (
    <main className="flex-1 bg-cream-50 text-ink-900">
      {/* Stitch "Gayrimenkul Video Vitrini": açık başlık bandı, kısa başlık + tek satır; videolar sahnede. */}
      <header className="border-b border-panel-line bg-gradient-to-b from-panel-muted/60 to-cream-50">
        <div className="panel-enter mx-auto w-full max-w-6xl px-4 pt-10 pb-6 md:px-6 md:pt-14 md:pb-8">
          <p className="inline-flex items-center gap-1.5 rounded-full bg-panel-accent-soft px-2.5 py-1 font-body text-[0.6875rem] font-semibold tracking-[0.08em] text-terracotta-700 uppercase">
            <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-terracotta-600" />
            Videolu vitrin
          </p>
          <h1 className="mt-3 font-display text-[2rem] leading-tight tracking-[-0.02em] md:text-5xl">
            Evi gezmeden önce <em className="font-display italic">videosunu</em> izleyin.
          </h1>
          <p className="mt-2 max-w-xl font-body text-sm text-charcoal/70 md:text-base">
            Beğendiğiniz ilan için doğrudan WhatsApp&apos;tan yazın.
          </p>
        </div>
      </header>
      <ShowcaseClient initialFilters={filters} />
    </main>
  );
}
