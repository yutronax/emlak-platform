import { redirect } from "next/navigation";

import { requireAdmin } from "@/lib/auth/requireAdmin";

import { ReviewClient } from "./review-client";

// İnceleme masası; veri sunucu aksiyonlarıyla (review-actions.ts), her aksiyon ayrıca admin doğrular.
export default async function AdminListingsPage() {
  const auth = await requireAdmin();
  if (!auth.ok) {
    redirect(auth.reason === "no-session" ? "/login" : "/agent/dashboard");
  }
  return <ReviewClient />;
}
