"use client";

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
  "mt-1 w-full rounded-md border border-mist-200 bg-white px-3 py-2 text-ink-900";

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block text-sm text-slate-500">
      {label}
      {children}
    </label>
  );
}

export function FeedFilters({
  options,
  filters,
}: {
  options: FeedFilterOptions;
  filters: ParsedFilters;
}) {
  return (
    <form
      method="get"
      action="/agent/dashboard"
      onSubmit={dropEmptyFields}
      className="mt-6 grid gap-3 md:grid-cols-3"
    >
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
      <Field label="En düşük fiyat (TRY)">
        <input
          type="number"
          name="fiyat_min"
          min={0}
          inputMode="numeric"
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
          defaultValue={filters.fiyatMax ?? ""}
          className={fieldClass}
        />
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
      <div className="flex items-end">
        <Button type="submit" variant="primary">
          Uygula
        </Button>
      </div>
    </form>
  );
}
