import { connection } from "next/server";
import type { ReactNode } from "react";

import { getProfileService } from "@/lib/profile-ui/service";
import { createClient } from "@/lib/supabase/server";

import { AppHeader } from "./app-header";

// agent/ ve account/ layout'ları için ortak kabuk. Oturum kontrolü (redirect) sayfalarda kalır;
// burada menüdeki e-posta okunur ve askıdaki hesabın paneli kapatılır (veri tarafı 0027'de).
export async function AppShell({ children }: { children: ReactNode }) {
  await connection();
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();

  let suspended = false;
  let name: string | null = null;
  if (data.user) {
    const { data: agent } = await supabase
      .from("agents")
      .select("suspended_at, contact_name, company_name")
      .eq("id", data.user.id)
      .maybeSingle();
    suspended = Boolean(agent?.suspended_at);
    // Menüde yetkili adı, yoksa firma adı; ikisi de yoksa e-posta.
    name = agent?.contact_name || agent?.company_name || null;
  }

  return (
    <div className="flex min-h-screen flex-col bg-cream-50">
      <AppHeader
        email={data.user?.email ?? null}
        name={name}
        showProfile={!suspended && getProfileService() !== null}
      />
      {suspended ? <SuspendedNotice /> : children}
    </div>
  );
}

function SuspendedNotice() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center px-4 py-16">
      <h1 className="font-display text-3xl tracking-tight text-ink-900">Hesabınız askıya alındı</h1>
      <p className="mt-4 text-slate-600">
        Bu süre içinde panel, ilan akışı ve WhatsApp ilan toplama kullanılamaz. Bunun bir hata olduğunu
        düşünüyorsanız bizimle iletişime geçin.
      </p>
    </main>
  );
}
