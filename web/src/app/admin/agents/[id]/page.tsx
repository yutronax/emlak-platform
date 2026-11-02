import type { Metadata } from "next";

import { AgentDetailClient } from "@/components/admin/clients";

export const metadata: Metadata = { title: "Emlakçı · Yönetim · Emlak Platformu" };

export default async function AdminAgentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AgentDetailClient id={id} />;
}
