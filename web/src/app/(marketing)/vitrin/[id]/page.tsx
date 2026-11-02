import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";

import { getShowcaseService } from "@/lib/showcase-ui/service";

import { ShowcaseDetail } from "./showcase-detail";

export const instant = false;

async function load(id: string) {
  const service = getShowcaseService({ delayMs: 0 });
  const res = await service.get(id);
  if (res.status === "not_found") notFound();
  // Hata sınırı (app/error.tsx) "Tekrar dene" ile karşılar.
  if (res.status === "error") throw new Error("vitrin ilanı yüklenemedi");
  return res;
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const { item } = await load(id);
  return { title: `${item.title} · Vitrin · Emlak Platformu`, description: item.description.slice(0, 150) };
}

export default async function ShowcaseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { item, similar } = await load(id);
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost";
  const proto = h.get("x-forwarded-proto") ?? "https";
  return <ShowcaseDetail item={item} similar={similar} pageUrl={`${proto}://${host}/vitrin/${item.id}`} />;
}
