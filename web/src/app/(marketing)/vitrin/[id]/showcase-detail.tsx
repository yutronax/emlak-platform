import Link from "next/link";

import { Poster, ShowcaseCard } from "@/components/showcase/showcase-card";
import { DEAL_LABEL, formatShowcasePrice, telHref, whatsappHref } from "@/lib/showcase-ui/format";
import type { ShowcaseItem } from "@/lib/showcase-ui/types";

type Props = { item: ShowcaseItem; similar: ShowcaseItem[]; pageUrl: string };

const actionBase =
  "inline-flex items-center justify-center rounded-leaf px-4 py-3 font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta-600";

export function ShowcaseDetail({ item, similar, pageUrl }: Props) {
  const facts = [
    { label: "Oda", value: item.rooms },
    { label: "Alan", value: `${item.areaM2} m²` },
    { label: "Kat", value: item.floor },
    { label: "Bina yaşı", value: item.buildingAge === null ? null : item.buildingAge === 0 ? "Sıfır" : `${item.buildingAge}` },
    { label: "Isıtma", value: item.heating },
  ].filter((f): f is { label: string; value: string } => Boolean(f.value));

  const initials = item.agent.name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w.charAt(0))
    .join("")
    .toLocaleUpperCase("tr-TR");

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 font-body text-charcoal md:px-6 md:py-10">
      <Link href="/vitrin" className="text-sm font-medium text-ink-900 underline-offset-4 hover:underline">
        ← Vitrine dön
      </Link>

      <div className="mt-4 grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0">
          <div className="overflow-hidden rounded-leaf bg-ink-900">
            {item.videoUrl ? (
              <video
                src={item.videoUrl}
                poster={item.posterUrl ?? undefined}
                controls
                playsInline
                preload="metadata"
                className="aspect-video w-full bg-ink-900"
              />
            ) : (
              <div className="relative">
                <Poster item={item} />
                <p className="absolute inset-x-0 bottom-0 bg-ink-900/70 px-4 py-2 text-sm text-fog-50">Video hazırlanıyor</p>
              </div>
            )}
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <span className="rounded-leaf bg-stone-200 px-3 py-1 text-xs font-medium text-charcoal/75">
              {DEAL_LABEL[item.deal]}
            </span>
            <p className="text-sm text-charcoal/60">
              {item.district}, {item.city}
            </p>
          </div>
          <h1 className="mt-3 font-display text-3xl leading-[1.05] font-light tracking-[-0.04em] text-balance md:text-5xl">{item.title}</h1>
          <p className="mt-4 font-display text-4xl font-light tracking-[-0.04em] tabular-nums md:text-5xl">
            {formatShowcasePrice(item.priceMinor, item.deal)}
          </p>

          <ul aria-label="İlan bilgileri" className="mt-8 grid grid-cols-2 gap-px overflow-hidden rounded-leaf border border-charcoal/10 bg-charcoal/10 sm:grid-cols-3">
            {facts.map((f) => (
              <li key={f.label} className="flex flex-col bg-white px-4 py-3">
                <span className="text-xs text-charcoal/60">{f.label}</span>
                <span className="font-medium">{f.value}</span>
              </li>
            ))}
          </ul>

          <h2 className="mt-8 font-display text-2xl font-normal tracking-[-0.03em]">Açıklama</h2>
          <p className="mt-2 max-w-prose leading-relaxed whitespace-pre-line text-charcoal/60">{item.description}</p>
        </div>

        <aside aria-label="Emlakçıyla iletişim" className="lg:sticky lg:top-6 lg:self-start">
          <div className="rounded-leaf border border-charcoal/10 bg-white p-5">
            <div className="flex items-center gap-3">
              <span
                aria-hidden="true"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-ink-900 font-display font-bold text-fog-50"
              >
                {initials}
              </span>
              <div className="min-w-0">
                <p className="text-xs text-charcoal/60">İlan sahibi</p>
                <p className="truncate font-medium">{item.agent.name}</p>
              </div>
            </div>
            <div className="mt-4 flex flex-col gap-2">
              <a
                href={whatsappHref(item.agent.phone, item.title, pageUrl)}
                target="_blank"
                rel="noopener noreferrer"
                className={`${actionBase} bg-moss-700 text-white hover:bg-moss-700/90`}
              >
                WhatsApp&apos;tan yaz<span className="sr-only"> (yeni sekmede açılır)</span>
              </a>
              <a href={telHref(item.agent.phone)} className={`${actionBase} border border-ink-900 text-ink-900 hover:bg-ink-900/5`}>
                Ara
              </a>
            </div>
            <p className="mt-3 text-xs text-charcoal/60">Mesajınıza ilanın bağlantısı otomatik eklenir.</p>
          </div>
        </aside>
      </div>

      {similar.length > 0 && (
        <section aria-labelledby="similar" className="mt-12">
          <h2 id="similar" className="font-display text-2xl font-normal tracking-[-0.03em]">
            Benzer ilanlar
          </h2>
          <ul className="mt-4 grid grid-cols-2 gap-3 md:gap-5 lg:grid-cols-4">
            {similar.map((s) => (
              <li key={s.id} className="flex">
                <ShowcaseCard item={s} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
