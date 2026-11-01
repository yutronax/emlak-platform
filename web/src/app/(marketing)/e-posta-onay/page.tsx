import type { Metadata } from "next";

import { ConfirmClient } from "./confirm-client";

// Durum query'den okunur (istek zamanlı); account/subscription ile aynı gerekçe.
export const instant = false;

export const metadata: Metadata = {
  title: "E-posta onayı · Emlak Platformu",
};

export default async function EmailConfirmPage({
  searchParams,
}: {
  searchParams: Promise<{ durum?: string | string[] }>;
}) {
  const { durum } = await searchParams;
  return <ConfirmClient state={durum === "gecersiz" ? "gecersiz" : "onaylandi"} />;
}
