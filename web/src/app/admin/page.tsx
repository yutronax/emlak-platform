import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { AdminOverviewClient } from "@/components/admin/clients";
import { getAdminService } from "@/lib/admin-ui/service";

export const metadata: Metadata = { title: "Genel bakış · Yönetim · Emlak Platformu" };

// Admin kontrolü admin/layout.tsx'te. Gerçek servis yokken sayfa yayında değil.
export default function AdminOverviewPage() {
  if (!getAdminService()) notFound();
  return <AdminOverviewClient />;
}
