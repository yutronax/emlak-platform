import { connection } from "next/server";
import { notFound, redirect } from "next/navigation";
import type { ReactNode } from "react";

import { createClient } from "@/lib/supabase/server";

// Next.js 16 Cache Components: cookies() (Supabase session) her istekte
// değişebilir, bu route segment'i prerender edilemez — statik build'i
// engellemesin diye bloklu/dinamik render'a izin veriyoruz.
export const instant = false;

export default async function AdminLayout({ children }: { children: ReactNode }) {
  // Date.now (Supabase getUser içinde) prerender sırasında çağrılmasın diye
  // ilk await'ten önce istek-zamanlı (dinamik) işaretleme yapılır.
  await connection();
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();

  if (!userData.user) {
    redirect("/login");
  }

  const { data: agent } = await supabase
    .from("agents")
    .select("is_admin")
    .eq("id", userData.user.id)
    .maybeSingle();

  // Admin olmayan birine "yetkin yok" demek yerine sayfa yokmuş gibi davran —
  // kaynağın varlığını sızdırmamak için (yetkin360'ta da izlenen yaklaşım).
  if (!agent?.is_admin) {
    notFound();
  }

  return <>{children}</>;
}
