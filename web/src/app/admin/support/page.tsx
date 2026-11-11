import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { requireAdmin } from "@/lib/auth/requireAdmin";
import { createServiceRoleClient } from "@/lib/supabase/server";

import { HandledToggle } from "./handled-toggle";

export const metadata: Metadata = { title: "Destek · Yönetim · Emlak Platformu" };
export const instant = false;

type SupportRow = {
  id: string;
  name: string;
  contact: string;
  message: string;
  agent_id: string | null;
  handled_at: string | null;
  created_at: string;
};

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));
}

export default async function AdminSupportPage() {
  // Layout da korur; sayfa kendi servis-rolü okumasından önce yeniden doğrular.
  const auth = await requireAdmin();
  if (!auth.ok) {
    if (auth.reason === "no-session") redirect("/login");
    notFound();
  }

  const admin = createServiceRoleClient();
  const { data, error } = await admin
    .from("support_messages")
    .select("id, name, contact, message, agent_id, handled_at, created_at")
    .order("created_at", { ascending: false })
    .limit(200)
    .returns<SupportRow[]>();

  const rows = data ?? [];

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-8 font-body text-ink-900 md:px-6 md:py-12">
      <h1 className="font-display text-[1.75rem] leading-tight tracking-[-0.02em] md:text-3xl">Destek mesajları</h1>
      <p className="mt-2 text-sm text-charcoal/70">
        Ziyaretçilerin “Destek” formundan bıraktığı mesajlar. İletişim bilgisiyle geri dönün.
      </p>

      {error ? (
        <p role="alert" className="mt-6 rounded-lg border border-brick-700/30 bg-brick-700/5 px-4 py-3 text-sm text-brick-700">
          Mesajlar yüklenemedi.
        </p>
      ) : rows.length === 0 ? (
        <p className="mt-8 rounded-xl border border-dashed border-panel-line px-4 py-10 text-center text-sm text-charcoal/60">
          Henüz destek mesajı yok.
        </p>
      ) : (
        <ul className="mt-6 flex flex-col gap-3">
          {rows.map((row) => (
            <li
              key={row.id}
              className={`rounded-xl border bg-panel-surface p-4 md:p-5 ${
                row.handled_at ? "border-panel-line opacity-70" : "border-panel-line-strong"
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium">{row.name}</p>
                  <p className="text-sm text-charcoal/75">
                    {row.contact}
                    {row.agent_id && <span className="ml-2 text-xs text-charcoal/50">(kayıtlı kullanıcı)</span>}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <time dateTime={row.created_at} className="text-xs whitespace-nowrap text-charcoal/60">
                    {formatDate(row.created_at)}
                  </time>
                  <HandledToggle id={row.id} initial={row.handled_at !== null} />
                </div>
              </div>
              <p className="mt-3 text-sm whitespace-pre-wrap text-ink-900">{row.message}</p>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
