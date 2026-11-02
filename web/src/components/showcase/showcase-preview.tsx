import Link from "next/link";

import { getShowcaseService } from "@/lib/showcase-ui/service";

import { ShowcaseCard } from "./showcase-card";

// Ana sayfa: vitrinden en yeni 3 video. Servis yoksa veya yüklenemezse bölüm hiç görünmez.
// Stellar "Featured properties" uyarlaması: ince dev başlık + serif vurgu, sağda bağlantı.
export async function ShowcasePreview() {
  const service = getShowcaseService({ delayMs: 0 });
  if (!service) return null;
  const res = await service.list({ sort: "yeni" }).catch(() => null);
  if (!res || res.status !== "ok" || res.items.length === 0) return null;

  return (
    <section aria-labelledby="vitrin-preview" className="bg-cream-50 text-charcoal">
      <div className="mx-auto w-full max-w-6xl px-4 py-20 md:px-6 md:py-28">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <h2
              id="vitrin-preview"
              className="font-display text-4xl leading-[1.05] font-normal tracking-[-0.04em] md:text-6xl"
            >
              Vitrinde <em className="accent">yayında</em>
            </h2>
            <p className="mt-3 max-w-md font-body text-charcoal/70">
              Editörlerimizin hazırladığı videolar, alıcı ve kiracılara açık vitrinde yayınlanır.
            </p>
          </div>
          <Link
            href="/vitrin"
            className="font-body text-sm font-medium text-ink-900 underline-offset-4 hover:underline"
          >
            Tüm vitrin →
          </Link>
        </div>
        <ul className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {res.items.slice(0, 3).map((item) => (
            <li key={item.id} className="flex">
              <ShowcaseCard item={item} />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
