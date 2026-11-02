"use client";

import { useState } from "react";

import { getAdminService } from "@/lib/admin-ui/service";
import type { AgentQuery } from "@/lib/admin-ui/types";

import { AdminOverview } from "./admin-overview";
import { AgentDetailView } from "./agent-detail-view";
import { AgentsView } from "./agents-view";

// Servis nesnesi sunucudan prop olarak geçemez; client'ta seçilir.
function useAdminService() {
  const [service] = useState(() => getAdminService());
  return service;
}

export function AdminOverviewClient() {
  const service = useAdminService();
  return service ? <AdminOverview service={service} /> : null;
}

export function AgentsClient({ initialQuery }: { initialQuery: AgentQuery }) {
  const service = useAdminService();
  return service ? <AgentsView service={service} initialQuery={initialQuery} /> : null;
}

export function AgentDetailClient({ id }: { id: string }) {
  const service = useAdminService();
  return service ? <AgentDetailView service={service} id={id} /> : null;
}
