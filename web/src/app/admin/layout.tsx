import { connection } from "next/server";
import { notFound, redirect } from "next/navigation";
import type { ReactNode } from "react";

import { AppHeader, type HeaderSection } from "@/components/app-shell/app-header";
import { getProfileService } from "@/lib/profile-ui/service";
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

  const sections: HeaderSection[] = [
    { href: "/admin", label: "Genel bakış", exact: true },
    { href: "/admin/listings", label: "İlanlar" },
    { href: "/admin/videos", label: "Videolar" },
    { href: "/admin/agents", label: "Emlakçılar" },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-cream-50">
      <AppHeader
        email={userData.user.email ?? null}
        showProfile={getProfileService() !== null}
        sections={sections}
        navLabel="Yönetim bölümleri"
        homeHref={sections[0].href}
      />
      {children}
    </div>
  );
}
