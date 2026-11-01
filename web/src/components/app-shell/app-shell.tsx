import { connection } from "next/server";
import type { ReactNode } from "react";

import { getProfileService } from "@/lib/profile-ui/service";
import { createClient } from "@/lib/supabase/server";

import { AppHeader } from "./app-header";

// agent/ ve account/ layout'ları için ortak kabuk. Oturum kontrolü (redirect) sayfalarda kalır;
// burada yalnız menüde gösterilecek e-posta okunur.
export async function AppShell({ children }: { children: ReactNode }) {
  await connection();
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();

  return (
    <div className="flex min-h-screen flex-col bg-fog-50">
      <AppHeader email={data.user?.email ?? null} showProfile={getProfileService() !== null} />
      {children}
    </div>
  );
}
