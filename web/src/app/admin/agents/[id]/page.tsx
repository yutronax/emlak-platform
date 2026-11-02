import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { AgentDetailClient } from "@/components/admin/clients";
import { getAdminService } from "@/lib/admin-ui/service";

export const metadata: Metadata = { title: "Emlakçı · Yönetim · Emlak Platformu" };

export default async function AdminAgentPage({ params }: { params: Promise<{ id: string }> }) {
  if (!getAdminService()) notFound();
  const { id } = await params;
  return <AgentDetailClient id={id} />;
}
