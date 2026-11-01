import type { Deal } from "./types";

const tryWhole = new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 0 });

export function formatShowcasePrice(minor: number, deal: Deal): string {
  const base = `${tryWhole.format(Math.round(minor / 100))} ₺`;
  return deal === "kiralik" ? `${base} / ay` : base;
}

export function formatDuration(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function whatsappHref(phone: string, title: string, pageUrl: string): string {
  const text = `Merhaba, "${title}" ilanı hakkında bilgi almak istiyorum: ${pageUrl}`;
  return `https://wa.me/${phone.replace(/\D/g, "")}?text=${encodeURIComponent(text)}`;
}

export const telHref = (phone: string) => `tel:${phone.replace(/[^\d+]/g, "")}`;

export const DEAL_LABEL: Record<Deal, string> = { satilik: "Satılık", kiralik: "Kiralık" };
