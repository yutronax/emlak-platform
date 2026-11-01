"use client";

import { useState } from "react";

import { getBillingService } from "@/lib/billing-ui/service";

import { BillingView } from "./billing-view";

// Servis nesnesi sunucudan prop olarak geçemez; client'ta seçilir.
export function BillingClient({ scenario }: { scenario?: string }) {
  const [service] = useState(() => getBillingService(scenario));
  if (!service) return null;
  return <BillingView service={service} />;
}
