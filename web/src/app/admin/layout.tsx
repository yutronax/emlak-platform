import { connection } from "next/server";
import { notFound, redirect } from "next/navigation";
import type { ReactNode } from "react";

import { AppHeader, type HeaderSection } from "@/components/app-shell/app-header";
import { getProfileService } from "@/lib/profile-ui/service";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";

// Next.js 16 Cache Components: cookies() (Supabase session) her istekte
// değişebilir, bu route segment'i prerender edilemez — statik build'i
// engellemesin diye bloklu/dinamik render'a izin veriyoruz.
export const instant = false;

// Güvenlik değerlendirmesi bulgu 4: WhatsApp köprüsü 5 dk'dan uzun sessizse admin uyarılır.
// sidecar_heartbeat RLS ile kapalı; yalnız servis rolü okur. Okunamazsa uyarı gösterilir (kapalı-varsayılan).
const HEARTBEAT_STALE_MS = 5 * 60 * 1000;

async function getScraperWarning(): Promise<string | null> {
  try {
    const { data, error } = await createServiceRoleClient()
      .from("sidecar_heartbeat")
      .select("last_beat_at")
      .eq("id", 1)
      .maybeSingle<{ last_beat_at: string | null }>();
    if (error) return "Scraper durumu okunamadı.";
    const last = data?.last_beat_at ? Date.parse(data.last_beat_at) : NaN;
    if (Number.isNaN(last)) return "Scraper hiç sinyal göndermedi; WhatsApp köprüsü çalışmıyor olabilir.";
    const minutes = Math.floor((Date.now() - last) / 60000);
    if (Date.now() - last > HEARTBEAT_STALE_MS) {
      return `Scraper ${minutes} dakikadır sinyal göndermiyor; WhatsApp köprüsü çalışmıyor olabilir.`;
    }
    return null;
  } catch {
    return "Scraper durumu okunamadı.";
  }
}

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

  // AC-2: admin MFA (aal2) doğrulamadan admin sayfalarına giremez; okunamazsa kapalı-varsayılan.
  let isAal2 = false;
  try {
    const { data: aal, error: aalError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    isAal2 = !aalError && aal?.currentLevel === "aal2";
  } catch {
    isAal2 = false;
  }
  if (!isAal2) {
    redirect("/mfa");
  }

  const scraperWarning = await getScraperWarning();

  const sections: HeaderSection[] = [
    { href: "/admin", label: "Genel bakış", exact: true },
    { href: "/admin/listings", label: "İlanlar" },
    { href: "/admin/videos", label: "Videolar" },
    { href: "/admin/agents", label: "Emlakçılar" },
    { href: "/admin/support", label: "Destek" },
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
      {scraperWarning && (
        <div role="alert" className="bg-red-50 px-4 py-2 text-center text-sm text-red-800">
          {scraperWarning}
        </div>
      )}
      {children}
    </div>
  );
}
