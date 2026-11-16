import { connection } from "next/server";
import { redirect } from "next/navigation";

import { requireAdmin } from "@/lib/auth/requireAdmin";

import { ReviewClient } from "./review-client";

// Oturuma bağlı, istek anında render edilir (diğer admin sayfalarıyla aynı).
export const instant = false;

// İnceleme masası; veri sunucu aksiyonlarıyla (review-actions.ts), her aksiyon ayrıca admin doğrular.
export default async function AdminListingsPage() {
  await connection();
  const auth = await requireAdmin();
  if (!auth.ok) {
    redirect(auth.reason === "no-session" ? "/login" : "/agent/dashboard");
  }
  return <ReviewClient />;
}
