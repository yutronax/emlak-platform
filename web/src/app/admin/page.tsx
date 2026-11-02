import type { Metadata } from "next";

import { AdminOverviewClient } from "@/components/admin/clients";

export const metadata: Metadata = { title: "Genel bakış · Yönetim · Emlak Platformu" };

// Admin kontrolü admin/layout.tsx'te; aksiyonlar ayrıca requireAdmin ile korunur.
export default function AdminOverviewPage() {
  return <AdminOverviewClient />;
}
