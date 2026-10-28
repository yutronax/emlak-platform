const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;
const BADGE_CAP = 99;

const arrivalFormat = new Intl.DateTimeFormat("tr-TR", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Istanbul",
});

export function formatPrice(price: number | null, currency: string | null): string {
  if (price === null) return "Fiyat belirtilmemiş";
  const amount = new Intl.NumberFormat("tr-TR").format(price);
  return currency ? `${amount} ${currency}` : amount;
}

export function formatLocation(city: string | null, district: string | null): string {
  const parts = [city, district].filter((part): part is string => Boolean(part));
  return parts.length > 0 ? parts.join(" / ") : "Konum belirtilmemiş";
}

export function formatGroup(name: string | null): string {
  return name || "Bilinmeyen grup";
}

export function formatArrival(createdAt: string, now: Date): string {
  const created = new Date(createdAt);
  const elapsed = now.getTime() - created.getTime();
  if (elapsed < DAY_MS) {
    if (elapsed < HOUR_MS) {
      return `${Math.max(1, Math.floor(elapsed / MINUTE_MS))} dk önce`;
    }
    return `${Math.floor(elapsed / HOUR_MS)} sa önce`;
  }
  return arrivalFormat.format(created);
}

export function formatBadge(count: number): string | null {
  if (count <= 0) return null;
  return count > BADGE_CAP ? `${BADGE_CAP}+` : String(count);
}
