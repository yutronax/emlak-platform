import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { brandTexture } from "@/components/auth/auth-shell";
import { parseFilters } from "@/lib/showcase-ui/filters";
import { getShowcaseService } from "@/lib/showcase-ui/service";

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
    <main className="flex-1 bg-fog-50">
      <header className="relative isolate overflow-hidden bg-ink-900 text-fog-50">
        <div aria-hidden="true" className="absolute inset-0 -z-10" style={brandTexture} />
        <div className="mx-auto max-w-6xl px-4 py-10 md:px-6 md:py-14">
          <p className="font-body text-xs font-medium tracking-[0.2em] text-terracotta-600 uppercase">Videolu vitrin</p>
          <h1 className="mt-2 font-display text-[2rem] leading-tight font-bold text-balance md:text-[2.75rem]">
            Evi gezmeden önce videosunu izleyin.
          </h1>
          <p className="mt-3 max-w-xl font-body text-fog-50/75">
            Emlakçıların editörlerimizle hazırladığı videolu ilanlar. Beğendiğinizde doğrudan WhatsApp&apos;tan yazın.
          </p>
        </div>
      </header>
      <ShowcaseClient initialFilters={filters} />
    </main>
  );
}
