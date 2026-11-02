import { redirect } from "next/navigation";

import { getProfileService } from "@/lib/profile-ui/service";
import { createClient } from "@/lib/supabase/server";

import { ProfileClient } from "./profile-client";
import { isTabId } from "./tabs";

// Oturum her istekte değişebilir; account/subscription ile aynı gerekçe.
export const instant = false;

export default async function AccountProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string | string[] }>;
}) {
  const service = getProfileService();

  // Mock yalnız dev'de seçilebilir (production'da selectProfileService fırlatır); tasarımı
  // oturumsuz görebilmek için orada oturum aranmaz. Gerçek serviste kontrol her zaman yapılır.
  if (service.kind !== "mock") {
    const supabase = await createClient();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) redirect("/login");
  }

  const { tab } = await searchParams;
  return <ProfileClient initialTab={isTabId(tab) ? tab : undefined} />;
}
