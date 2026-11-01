// Vitrin ekranlarının servisten beklediği sözleşme (video-vitrin/frontend_contract.md).

export type Deal = "satilik" | "kiralik";
export type RoomsFilter = "1+1" | "2+1" | "3+1" | "4+";
export type SortKey = "yeni" | "fiyat-artan" | "fiyat-azalan";

export type ShowcaseItem = {
  id: string;
  title: string;
  deal: Deal;
  priceMinor: number;
  city: string;
  district: string;
  rooms: string;
  areaM2: number;
  floor: string | null;
  buildingAge: number | null;
  heating: string | null;
  description: string;
  durationSec: number;
  posterUrl: string | null;
  videoUrl: string | null;
  publishedAt: string;
  agent: { name: string; phone: string };
};

export type ShowcaseFilters = {
  deal?: Deal;
  city?: string;
  rooms?: RoomsFilter;
  // Kuruş.
  minPrice?: number;
  maxPrice?: number;
  sort: SortKey;
};

export type ListResult =
  | { status: "ok"; items: ShowcaseItem[]; nextCursor: string | null; total: number }
  | { status: "error" };

export interface ShowcaseService {
  kind: "mock" | "real";
  cities(): Promise<string[]>;
  list(filters: ShowcaseFilters, cursor?: string): Promise<ListResult>;
  get(
    id: string,
  ): Promise<{ status: "ok"; item: ShowcaseItem; similar: ShowcaseItem[] } | { status: "not_found" } | { status: "error" }>;
}
