import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { getMyWaGroups } from "@/lib/whatsapp/groups";
import { getMyWaStatus, type WaStatusView } from "@/lib/whatsapp/status";

import { WaPanel } from "./wa-panel";

// Dashboard ile aynı: oturum/çerez okunduğu için her istekte render edilir.
export const instant = false;

// EML-106 / AC-11: bayrak yoksa sayfa yok gibi davranır (notFound).
// Oturum yoksa /login. Bağlantı durumu ilk render'da sunucudan gelir; sonrası panel poll eder.
export default async function WhatsAppPage() {
  if (!process.env.NEXT_PUBLIC_WA_LINK_ENABLED) {
    notFound();
  }

  // createClient() cookies() okur: istek-zamanlı (dinamik) işaretleme getUser()'dan (Date.now)
  // önce gerçekleşir. Bu yüzden ayrı connection() çağrısına gerek yoktur (admin layout'taki
  // gibi next/server mock'u olmayan test ortamında da çalışır).
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    redirect("/login");
  }

  // Ban riski onayı kaydı (AC-1). Okunamazsa güvenli varsayılan: onaysız.
  const { data: agent } = await supabase
    .from("agents")
    .select("wa_consent_accepted_at")
    .eq("id", auth.user.id)
    .maybeSingle();
  const consentAccepted = Boolean(
    (agent as { wa_consent_accepted_at: string | null } | null)?.wa_consent_accepted_at,
  );

  const result = await getMyWaStatus(supabase);
  const initialStatus: WaStatusView = result.ok
    ? result
    : { status: "error", error_code: null };

  return (
    <main className="mx-auto max-w-4xl bg-fog-50 p-4 md:p-8">
      <h1 className="text-xl font-semibold text-ink-900">WhatsApp</h1>
      <Link href="/agent/dashboard" className="mt-2 inline-block text-terracotta-700 underline">
        Panele dön
      </Link>
      <WaPanel
        initialStatus={initialStatus}
        consentAccepted={consentAccepted}
        groups={await getMyWaGroups(supabase)}
      />
    </main>
  );
}
