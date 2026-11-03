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
    <main className="mx-auto w-full max-w-6xl px-4 py-6 md:px-6 md:py-12">
      <h1 className="font-display text-[1.75rem] leading-tight tracking-[-0.025em] text-ink-900 md:text-4xl">WhatsApp</h1>
      <p className="mt-2 max-w-xl text-charcoal/75">
        Gruplarınızı bağlayın; ilan okunacak grupları bağlantı kurduktan sonra seçersiniz.
      </p>
      <Link href="/agent/dashboard" className="mt-3 inline-flex min-h-11 items-center text-sm font-medium text-terracotta-700 underline-offset-4 hover:underline">
        Panele dön
      </Link>
      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
        <WaPanel
          initialStatus={initialStatus}
          consentAccepted={consentAccepted}
          groups={await getMyWaGroups(supabase)}
        />
        {/* Masaüstünde sağ sütun: sürecin tamamı tek bakışta; mobilde panelin altına iner. */}
        <aside aria-label="Bağlantı adımları" className="rounded-xl border border-stone-200 p-5 text-sm">
          <h2 className="font-display text-lg tracking-[-0.02em] text-ink-900">Nasıl çalışır</h2>
          <ol className="mt-4 space-y-4">
            {[
              ["Riski onaylayın", "Resmi olmayan bağlantının riskini okuyup kabul edersiniz."],
              ["QR ile bağlanın", "Telefonda WhatsApp → Bağlı cihazlar → Cihaz bağla ile kodu okutursunuz."],
              ["Grupları seçin", "Yalnız seçtiğiniz gruplardaki ilanlar okunur; sistem mesaj göndermez."],
            ].map(([title, body], i) => (
              <li key={title} className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#EAE5D9] text-xs font-semibold text-ink-900">
                  {i + 1}
                </span>
                <span>
                  <span className="block font-medium text-ink-900">{title}</span>
                  <span className="mt-0.5 block text-charcoal/70">{body}</span>
                </span>
              </li>
            ))}
          </ol>
        </aside>
      </div>
    </main>
  );
}
