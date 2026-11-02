import type { AgentRow, AgentSubStatus, WhatsAppState } from "@/lib/admin-ui/types";

// Rozet metni anlam taşır, renk yalnız destekler.
export const SUB_BADGE: Record<AgentSubStatus, { label: string; className: string }> = {
  active: { label: "Aktif", className: "bg-moss-700/10 text-moss-700" },
  trialing: { label: "Deneme", className: "bg-moss-700/10 text-moss-700" },
  past_due: { label: "Ödeme gecikti", className: "bg-brick-700/10 text-brick-700" },
  pending: { label: "Onay bekliyor", className: "bg-mist-200 text-ink-900" },
  canceled: { label: "Sona erdi", className: "bg-mist-200 text-ink-900" },
  none: { label: "Abonelik yok", className: "bg-mist-200 text-slate-500" },
};

export const WA_LABEL: Record<WhatsAppState, string> = {
  connected: "Bağlı",
  disconnected: "Bağlantı koptu",
  never: "Hiç bağlanmadı",
};

export const badge = "inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap";

export function AgentTags({ agent }: { agent: Pick<AgentRow, "suspended" | "isAdmin"> }) {
  return (
    <>
      {agent.suspended && <span className={`${badge} bg-brick-700 text-white`}>Askıda</span>}
      {agent.isAdmin && <span className={`${badge} bg-ink-900 text-fog-50`}>Admin</span>}
    </>
  );
}

const dateFmt = new Intl.DateTimeFormat("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Europe/Istanbul" });
export const fmtDate = (iso: string | null) => (iso ? dateFmt.format(new Date(iso)) : "—");

export const card = "rounded-leaf border border-mist-200 bg-white";
