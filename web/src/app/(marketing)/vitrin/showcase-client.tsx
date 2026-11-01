"use client";

import { useState } from "react";

import { getShowcaseService } from "@/lib/showcase-ui/service";
import type { ShowcaseFilters } from "@/lib/showcase-ui/types";

import { ShowcaseView } from "./showcase-view";

// Servis nesnesi sunucudan prop olarak geçemez; client'ta seçilir.
export function ShowcaseClient({ initialFilters }: { initialFilters: ShowcaseFilters }) {
  const [service] = useState(() => getShowcaseService());
  if (!service) return null;
  return <ShowcaseView service={service} initialFilters={initialFilters} />;
}
