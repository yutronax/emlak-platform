import type { ParsedFields } from "./types";

const norm = (v: unknown) => (typeof v === "string" ? v.trim() : v);

// Onaya yalnız değişen alanlar gönderilir; baştaki/sondaki boşluk değişiklik sayılmaz.
export function diffEdits(original: ParsedFields, edited: ParsedFields): Partial<ParsedFields> {
  const out: Partial<Record<keyof ParsedFields, unknown>> = {};
  for (const key of Object.keys(edited) as (keyof ParsedFields)[]) {
    if (norm(edited[key]) !== norm(original[key])) out[key] = norm(edited[key]);
  }
  return out as Partial<ParsedFields>;
}

export function validateEdits(f: ParsedFields) {
  const errors: Partial<Record<keyof ParsedFields, string>> = {};
  const title = f.title.trim();
  if (title.length < 3 || title.length > 140) errors.title = "Başlık 3-140 karakter olmalı.";
  if (f.price !== null && !(Number.isInteger(f.price) && f.price > 0))
    errors.price = "Fiyat pozitif bir sayı olmalı ya da boş bırakılmalı.";
  if (f.areaM2 !== null && !(Number.isInteger(f.areaM2) && f.areaM2 > 0))
    errors.areaM2 = "Alan pozitif bir sayı olmalı ya da boş bırakılmalı.";
  return errors;
}

export type ScoreBand = "none" | "low" | "mid" | "high";

export function scoreBand(score: number | null): ScoreBand {
  if (score === null) return "none";
  if (score < 0.5) return "low";
  return score < 0.7 ? "mid" : "high";
}
