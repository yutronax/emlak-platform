import type { Deal, RoomsFilter, ShowcaseFilters, SortKey } from "./types";

// URL'de Türkçe anahtarlar ve TL; modelde kuruş.
type Query = Record<string, string | string[] | undefined>;

const DEALS: Deal[] = ["satilik", "kiralik"];
export const ROOMS: RoomsFilter[] = ["1+1", "2+1", "3+1", "4+"];
const SORTS: SortKey[] = ["yeni", "fiyat-artan", "fiyat-azalan"];

const one = (v: string | string[] | undefined) => (typeof v === "string" && v.trim() ? v.trim() : undefined);
const pick = <T extends string>(v: string | undefined, allowed: T[]) => allowed.find((a) => a === v);

function tl(v: string | undefined): number | undefined {
  if (!v || !/^\d+$/.test(v)) return undefined;
  const n = Number(v);
  return n > 0 ? n * 100 : undefined;
}

export function parseFilters(q: Query): ShowcaseFilters {
  const f: ShowcaseFilters = { sort: pick(one(q.sirala), SORTS) ?? "yeni" };
  const deal = pick(one(q.islem), DEALS);
  const rooms = pick(one(q.oda), ROOMS);
  const city = one(q.sehir);
  const minPrice = tl(one(q.min));
  const maxPrice = tl(one(q.max));
  if (deal) f.deal = deal;
  if (city) f.city = city;
  if (rooms) f.rooms = rooms;
  if (minPrice) f.minPrice = minPrice;
  if (maxPrice) f.maxPrice = maxPrice;
  return f;
}

export function toQuery(f: ShowcaseFilters): string {
  const p = new URLSearchParams();
  if (f.deal) p.set("islem", f.deal);
  if (f.city) p.set("sehir", f.city);
  if (f.rooms) p.set("oda", f.rooms);
  if (f.minPrice) p.set("min", String(Math.round(f.minPrice / 100)));
  if (f.maxPrice) p.set("max", String(Math.round(f.maxPrice / 100)));
  if (f.sort !== "yeni") p.set("sirala", f.sort);
  return p.toString();
}

export function validateFilters(f: ShowcaseFilters): string | undefined {
  if (f.minPrice && f.maxPrice && f.minPrice > f.maxPrice) return "En az fiyat en çoktan büyük olamaz.";
}

export function activeFilterCount(f: ShowcaseFilters): number {
  return [f.deal, f.city, f.rooms, f.minPrice, f.maxPrice].filter((v) => v !== undefined).length;
}
