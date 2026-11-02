import type { Metadata } from "next";

import { AgentsClient } from "@/components/admin/clients";
import type { AgentQuery } from "@/lib/admin-ui/types";

export const metadata: Metadata = { title: "Emlakçılar · Yönetim · Emlak Platformu" };

const SUBS = ["active", "trialing", "past_due", "pending", "canceled", "none", "suspended"] as const;

export default async function AdminAgentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const one = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : undefined);
  const page = Number(one("sayfa"));
  const sub = SUBS.find((s) => s === one("abonelik"));
  const wa = one("wa") === "connected" || one("wa") === "disconnected" ? (one("wa") as AgentQuery["wa"]) : undefined;
  const query: AgentQuery = { page: Number.isInteger(page) && page > 0 ? page : 1 };
  if (one("q")) query.q = one("q");
  if (sub) query.sub = sub;
  if (wa) query.wa = wa;
  return <AgentsClient initialQuery={query} />;
}
