export const ROOM_OPTIONS = ["1+0", "1+1", "2+1", "3+1", "4+1", "5+"] as const;

export type FeedFilterOptions = {
  cities: string[];
  districts: string[];
  groups: string[];
};

export type ParsedFilters = {
  grup: string | null;
  fiyatMin: number | null;
  fiyatMax: number | null;
  oda: string | null;
  il: string | null;
  ilce: string | null;
  sayfa: number;
};

export type SearchParams = Record<string, string | string[] | undefined>;

const MAX_PRICE = 1_000_000_000_000;
const MAX_TEXT_LENGTH = 100;
const MAX_PAGE = 1000;

type Picked<T> = { value: T | null; invalid: boolean };

// Parametre yoksa geçersiz sayılmaz; varsa ama parse edilemiyorsa geçersizdir.
function pick<T>(
  raw: string | string[] | undefined,
  parse: (value: string) => T | null,
): Picked<T> {
  if (raw === undefined) return { value: null, invalid: false };
  const value = typeof raw === "string" ? parse(raw) : null;
  return { value, invalid: value === null };
}

function parsePrice(value: string): number | null {
  if (!/^\d+$/.test(value)) return null;
  const amount = Number(value);
  return amount <= MAX_PRICE ? amount : null;
}

function parseRoom(value: string): string | null {
  return (ROOM_OPTIONS as readonly string[]).includes(value) ? value : null;
}

function allowOnly(allowed: string[]) {
  return (value: string): string | null =>
    value.length <= MAX_TEXT_LENGTH && allowed.includes(value) ? value : null;
}

function parsePage(raw: string | string[] | undefined): number {
  if (typeof raw !== "string") return 1;
  const page = Number.parseInt(raw, 10);
  if (!Number.isFinite(page)) return 1;
  return Math.min(MAX_PAGE, Math.max(1, page));
}

export function parseFeedFilters(
  params: SearchParams,
  options: FeedFilterOptions,
): { filters: ParsedFilters; hadInvalid: boolean } {
  const min = pick(params.fiyat_min, parsePrice);
  const max = pick(params.fiyat_max, parsePrice);
  const oda = pick(params.oda, parseRoom);
  const il = pick(params.il, allowOnly(options.cities));
  const ilce = pick(params.ilce, allowOnly(options.districts));
  const grup = pick(params.grup, allowOnly(options.groups));

  let fiyatMin = min.value;
  let fiyatMax = max.value;
  if (fiyatMin !== null && fiyatMax !== null && fiyatMin > fiyatMax) {
    [fiyatMin, fiyatMax] = [fiyatMax, fiyatMin];
  }

  const hadInvalid = [min, max, oda, il, ilce, grup].some((p) => p.invalid);

  return {
    filters: {
      grup: grup.value,
      fiyatMin,
      fiyatMax,
      oda: oda.value,
      il: il.value,
      ilce: ilce.value,
      sayfa: parsePage(params.sayfa),
    },
    hadInvalid,
  };
}
