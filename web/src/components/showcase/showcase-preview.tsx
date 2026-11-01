import Link from "next/link";

import { getShowcaseService } from "@/lib/showcase-ui/service";

import { ShowcaseCard } from "./showcase-card";

// Ana sayfa: vitrinden en yeni 3 video. Servis yoksa veya yüklenemezse bölüm hiç görünmez.
export async function ShowcasePreview() {
  const service = getShowcaseService({ delayMs: 0 });
  if (!service) return null;
  const res = await service.list({ sort: "yeni" }).catch(() => null);
  if (!res || res.status !== "ok" || res.items.length === 0) return null;

  return (
    <section aria-labelledby="vitrin-preview" className="border-t border-mist-200">
      <div className="mx-auto max-w-6xl px-4 py-20 md:px-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 id="vitrin-preview" className="font-display text-3xl font-bold">
              Vitrinde yayında
            </h2>
            <p className="mt-2 font-body text-slate-500">
              Editörlerimizin hazırladığı videolar, alıcı ve kiracılara açık vitrinde yayınlanır.
            </p>
          </div>
          <Link
            href="/vitrin"
            className="font-body text-sm font-medium text-terracotta-700 hover:underline"
          >
            Tüm vitrin →
          </Link>
        </div>
        <ul className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
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
