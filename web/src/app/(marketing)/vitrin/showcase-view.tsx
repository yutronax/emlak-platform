"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";

import { ShowcaseCard } from "@/components/showcase/showcase-card";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { activeFilterCount, ROOMS, toQuery, validateFilters } from "@/lib/showcase-ui/filters";
import type { Deal, RoomsFilter, ShowcaseFilters, ShowcaseItem, ShowcaseService, SortKey } from "@/lib/showcase-ui/types";

type Props = { service: ShowcaseService; initialFilters: ShowcaseFilters };

type ListState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; items: ShowcaseItem[]; nextCursor: string | null; total: number };

const control =
  "rounded-md border border-charcoal/15 bg-white px-3 py-2 text-sm text-ink-900 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-terracotta-600";
const label = "text-xs font-medium text-charcoal/60";

const DEAL_OPTIONS: { value: Deal | ""; label: string }[] = [
  { value: "", label: "Tümü" },
  { value: "satilik", label: "Satılık" },
  { value: "kiralik", label: "Kiralık" },
];
const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "yeni", label: "En yeni" },
  { value: "fiyat-artan", label: "Fiyat (artan)" },
  { value: "fiyat-azalan", label: "Fiyat (azalan)" },
];

// undefined alanları atar: sorgu ve URL temiz kalsın.
function clean(f: ShowcaseFilters): ShowcaseFilters {
  return Object.fromEntries(Object.entries(f).filter(([, v]) => v !== undefined && v !== "")) as ShowcaseFilters;
}

const toTl = (minor?: number) => (minor ? String(Math.round(minor / 100)) : "");
const fromTl = (v: string) => (/^\d+$/.test(v) && Number(v) > 0 ? Number(v) * 100 : undefined);

export function ShowcaseView({ service, initialFilters }: Props) {
  const [filters, setFilters] = useState<ShowcaseFilters>(() => clean(initialFilters));
  const [state, setState] = useState<ListState>({ status: "loading" });
  const [cities, setCities] = useState<string[]>([]);
  const [minTl, setMinTl] = useState(toTl(initialFilters.minPrice));
  const [maxTl, setMaxTl] = useState(toTl(initialFilters.maxPrice));
  const [priceError, setPriceError] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [moreState, setMoreState] = useState<"idle" | "loading" | "error">("idle");
  const requestId = useRef(0);

  useEffect(() => {
    service.cities().then(setCities, () => setCities([]));
  }, [service]);

  // Yalnız en son istek ekrana yansır (hızlı filtre değişimlerinde eski yanıt yazmasın).
  const load = useCallback(
    (f: ShowcaseFilters) => {
      const id = ++requestId.current;
      return service.list(f, undefined).then(
        (res) => {
          if (id !== requestId.current) return;
          setState(res.status === "ok" ? { ...res, status: "ready" } : { status: "error" });
        },
        () => id === requestId.current && setState({ status: "error" }),
      );
    },
    [service],
  );

  useEffect(() => {
    void load(filters);
  }, [load, filters]);

  function apply(next: ShowcaseFilters) {
    const f = clean(next);
    const q = toQuery(f);
    window.history.replaceState(null, "", q ? `/vitrin?${q}` : "/vitrin");
    setMoreState("idle");
    setState({ status: "loading" });
    setFilters(f);
  }

  function onPriceSubmit(e: FormEvent) {
    e.preventDefault();
    const next = { ...filters, minPrice: fromTl(minTl), maxPrice: fromTl(maxTl) };
    const invalid = validateFilters(next);
    setPriceError(invalid ?? null);
    if (!invalid) apply(next);
  }

  function clearAll() {
    setMinTl("");
    setMaxTl("");
    setPriceError(null);
    apply({ sort: "yeni" });
  }

  async function loadMore() {
    if (state.status !== "ready" || !state.nextCursor) return;
    setMoreState("loading");
    const id = requestId.current;
    try {
      const res = await service.list(filters, state.nextCursor);
      if (id !== requestId.current) return;
      if (res.status !== "ok") return setMoreState("error");
      setState((s) => (s.status === "ready" ? { ...res, status: "ready", items: [...s.items, ...res.items] } : s));
      setMoreState("idle");
    } catch {
      setMoreState("error");
    }
  }

  const count = activeFilterCount(filters);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 font-body text-charcoal md:px-6 md:py-12">
      <div className="md:hidden">
        <Button
          variant="secondary"
          aria-expanded={panelOpen}
          aria-controls="showcase-filters"
          onClick={() => setPanelOpen((o) => !o)}
        >
          {count ? `Filtreler (${count})` : "Filtreler"}
        </Button>
      </div>

      <form
        id="showcase-filters"
        onSubmit={onPriceSubmit}
        noValidate
        className={`${panelOpen ? "flex" : "hidden"} mt-4 flex-col gap-4 rounded-leaf border border-charcoal/10 bg-white p-4 md:mt-0 md:flex md:flex-row md:flex-wrap md:items-end`}
      >
        <fieldset className="flex flex-col gap-1">
          <legend className={label}>İşlem</legend>
          <div className="mt-1 inline-flex rounded-md border border-charcoal/15 p-0.5">
            {DEAL_OPTIONS.map((o) => (
              <label
                key={o.label}
                className="cursor-pointer rounded px-3 py-1.5 text-sm has-checked:bg-ink-900 has-checked:text-cream-50 has-focus-visible:outline-2 has-focus-visible:outline-terracotta-600"
              >
                <input
                  type="radio"
                  name="deal"
                  value={o.value}
                  checked={(filters.deal ?? "") === o.value}
                  onChange={() => apply({ ...filters, deal: (o.value || undefined) as Deal | undefined })}
                  className="sr-only"
                />
                {o.label}
              </label>
            ))}
          </div>
        </fieldset>

        <div className="flex flex-col gap-1">
          <label htmlFor="f-city" className={label}>
            Şehir
          </label>
          <select
            id="f-city"
            value={filters.city ?? ""}
            onChange={(e) => apply({ ...filters, city: e.target.value || undefined })}
            className={control}
          >
            <option value="">Tümü</option>
            {cities.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="f-rooms" className={label}>
            Oda
          </label>
          <select
            id="f-rooms"
            value={filters.rooms ?? ""}
            onChange={(e) => apply({ ...filters, rooms: (e.target.value || undefined) as RoomsFilter | undefined })}
            className={control}
          >
            <option value="">Tümü</option>
            {ROOMS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-wrap items-end gap-2">
          <div className="flex flex-col gap-1">
            <label htmlFor="f-min" className={label}>
              En az fiyat (₺)
            </label>
            <input
              id="f-min"
              inputMode="numeric"
              value={minTl}
              onChange={(e) => setMinTl(e.target.value.replace(/\D/g, ""))}
              aria-invalid={priceError ? "true" : undefined}
              aria-describedby={priceError ? "f-price-error" : undefined}
              className={`${control} w-32`}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="f-max" className={label}>
              En çok fiyat (₺)
            </label>
            <input
              id="f-max"
              inputMode="numeric"
              value={maxTl}
              onChange={(e) => setMaxTl(e.target.value.replace(/\D/g, ""))}
              aria-invalid={priceError ? "true" : undefined}
              aria-describedby={priceError ? "f-price-error" : undefined}
              className={`${control} w-32`}
            />
          </div>
          <Button type="submit" variant="secondary">
            Uygula
          </Button>
        </div>

        <div className="flex flex-col gap-1 md:ml-auto">
          <label htmlFor="f-sort" className={label}>
            Sırala
          </label>
          <select
            id="f-sort"
            value={filters.sort}
            onChange={(e) => apply({ ...filters, sort: e.target.value as SortKey })}
            className={control}
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        {priceError && (
          <p id="f-price-error" className="basis-full text-sm text-brick-700">
            {priceError}
          </p>
        )}
      </form>

      <section aria-label="İlanlar" aria-busy={state.status === "loading" ? "true" : undefined} className="mt-6">
        {state.status === "ready" && (
          <p className="mb-4 text-sm text-charcoal/60">{state.total} ilan</p>
        )}

        {state.status === "loading" && (
          <ul aria-hidden="true" className="grid animate-pulse gap-5 motion-reduce:animate-none sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }, (_, i) => (
              <li key={i} className="overflow-hidden rounded-leaf border border-charcoal/10 bg-white">
                <div className="aspect-video bg-mist-200" />
                <div className="flex flex-col gap-2 p-4">
                  <div className="h-5 w-28 rounded bg-mist-200" />
                  <div className="h-4 w-full rounded bg-mist-200/70" />
                  <div className="h-4 w-1/2 rounded bg-mist-200/70" />
                </div>
              </li>
            ))}
          </ul>
        )}

        {state.status === "error" && (
          <div role="alert" className="flex flex-col items-start gap-3 rounded-leaf border border-charcoal/10 bg-white p-6">
            <p className="font-medium">İlanlar yüklenemedi.</p>
            <Button
              variant="secondary"
              onClick={() => {
                setState({ status: "loading" });
                void load(filters);
              }}
            >
              Tekrar dene
            </Button>
          </div>
        )}

        {state.status === "ready" && state.items.length === 0 && (
          <div className="flex flex-col items-start gap-3 rounded-leaf border border-charcoal/10 bg-white p-6">
            <p className="font-medium">Bu filtrelere uyan ilan yok</p>
            <p className="text-sm text-charcoal/60">Fiyat aralığını genişletmeyi ya da başka bir şehir seçmeyi deneyin.</p>
            <Button variant="secondary" onClick={clearAll}>
              Filtreleri temizle
            </Button>
          </div>
        )}

        {state.status === "ready" && state.items.length > 0 && (
          <>
            <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {state.items.map((item) => (
                <li key={item.id} className="flex">
                  <ShowcaseCard item={item} />
                </li>
              ))}
            </ul>
            {moreState === "error" && (
              <div className="mt-6">
                <Alert variant="error">Daha fazla ilan yüklenemedi. Tekrar deneyin.</Alert>
              </div>
            )}
            {state.nextCursor && (
              <div className="mt-8 flex justify-center">
                <Button variant="secondary" isPending={moreState === "loading"} onClick={loadMore}>
                  Daha fazla göster
                </Button>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}
