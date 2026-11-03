"use client";

import Link from "next/link";
import type { FormEvent, ReactNode } from "react";

import { Button } from "@/components/ui/button";
import {
  ROOM_OPTIONS,
  type FeedFilterOptions,
  type ParsedFilters,
} from "@/lib/listings-feed/filters";

// Boş alanlar GET query'sine "" olarak girer ve geçersiz sayılıp not üretir.
// Gönderilmeden önce devre dışı bırakılır: URL'de yalnız dolu filtreler kalır.
function dropEmptyFields(event: FormEvent<HTMLFormElement>) {
  for (const element of Array.from(event.currentTarget.elements)) {
    if (
      (element instanceof HTMLInputElement || element instanceof HTMLSelectElement) &&
      element.name &&
      element.value === ""
    ) {
      element.disabled = true;
    }
  }
}

const fieldClass =
  "mt-1.5 h-11 w-full min-w-0 rounded-lg border border-charcoal/35 bg-white px-3 text-base text-ink-900 focus-visible:border-ink-900 focus-visible:outline-2 focus-visible:outline-terracotta-600";

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block min-w-0 text-[0.8125rem] font-medium text-charcoal/80">
      {label}
      {children}
    </label>
  );
}

// Açılır filtre panelinin içeriği: mobilde tek, masaüstünde üç sütun.
export function FeedFilters({
  options,
  filters,
  active = false,
}: {
  options: FeedFilterOptions;
  filters: ParsedFilters;
  active?: boolean;
}) {
  return (
    <form
      method="get"
      action="/agent/dashboard"
      onSubmit={dropEmptyFields}
      aria-label="İlan filtreleri"
      className="grid grid-cols-1 gap-4 md:grid-cols-3"
    >
      <Field label="İl">
        <select name="il" defaultValue={filters.il ?? ""} className={fieldClass}>
          <option value="">Tümü</option>
          {options.cities.map((city) => (
            <option key={city} value={city}>
              {city}
            </option>
          ))}
        </select>
      </Field>
      <Field label="İlçe">
        <select name="ilce" defaultValue={filters.ilce ?? ""} className={fieldClass}>
          <option value="">Tümü</option>
          {options.districts.map((district) => (
            <option key={district} value={district}>
              {district}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Oda sayısı">
        <select name="oda" defaultValue={filters.oda ?? ""} className={fieldClass}>
          <option value="">Tümü</option>
          {ROOM_OPTIONS.map((room) => (
            <option key={room} value={room}>
              {`${room} oda`}
            </option>
          ))}
        </select>
      </Field>
      <div className="grid grid-cols-1 gap-3 min-[360px]:grid-cols-2 md:col-span-1">
        <Field label="En düşük fiyat (TRY)">
          <input
            type="number"
            name="fiyat_min"
            min={0}
            inputMode="numeric"
            placeholder="0"
            defaultValue={filters.fiyatMin ?? ""}
            className={fieldClass}
          />
        </Field>
        <Field label="En yüksek fiyat (TRY)">
          <input
            type="number"
            name="fiyat_max"
            min={0}
            inputMode="numeric"
            placeholder="Sınırsız"
            defaultValue={filters.fiyatMax ?? ""}
            className={fieldClass}
          />
        </Field>
      </div>
      <Field label="Kaynak grup">
        <select name="grup" defaultValue={filters.grup ?? ""} className={fieldClass}>
          <option value="">Tümü</option>
          {options.groups.map((group) => (
            <option key={group} value={group}>
              {group}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Kapsam">
        <select name="kapsam" defaultValue={filters.kapsam ?? ""} className={fieldClass}>
          <option value="">Tümü</option>
          <option value="mine">Kendi gruplarım</option>
        </select>
      </Field>
      <div className="flex items-center gap-3 pt-1 md:col-span-3">
        <Button type="submit" variant="primary" className="h-11 flex-1 md:flex-none md:px-8">
          Uygula
        </Button>
        {active && (
          <Link
            href="/agent/dashboard"
            className="text-sm font-medium text-charcoal/70 underline-offset-4 hover:text-ink-900 hover:underline"
          >
            Sıfırla
          </Link>
        )}
      </div>
    </form>
  );
}
