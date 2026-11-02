"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import type { AdminService, AgentRow } from "@/lib/admin-ui/types";

import { AgentTags, badge, card, fmtDate, SUB_BADGE } from "./labels";

type Data = Extract<Awaited<ReturnType<AdminService["overview"]>>, { status: "ok" }>;

export function AdminOverview({ service }: { service: AdminService }) {
  const [state, setState] = useState<{ status: "loading" } | { status: "error" } | Data>({ status: "loading" });

  const load = useCallback(
    () =>
      service.overview().then(
        (res) => setState(res),
        () => setState({ status: "error" }),
      ),
    [service],
  );

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 font-body text-ink-900 md:px-6 md:py-10">
      <div>
        <p className="text-xs font-medium tracking-[0.2em] text-terracotta-700 uppercase">Yönetim</p>
        <h1 className="mt-1 font-display text-[1.75rem] leading-tight font-normal tracking-[-0.03em]">Genel bakış</h1>
      </div>

      {state.status === "loading" && (
        <div aria-busy="true" className="grid animate-pulse gap-4 motion-reduce:animate-none sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className={`${card} h-32`} />
          ))}
        </div>
      )}

      {state.status === "error" && (
        <div role="alert" className={`${card} flex flex-col items-start gap-3 p-6`}>
          <p className="font-medium">Özet yüklenemedi.</p>
          <Button
            variant="secondary"
            onClick={() => {
              setState({ status: "loading" });
              void load();
            }}
          >
            Tekrar dene
          </Button>
        </div>
      )}

      {state.status === "ok" && (
        <>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat href="/admin/listings" value={state.counts.pendingListings} label="Bekleyen ilan" hint="Onay kuyruğunda" />
            <Stat href="/admin/videos" value={state.counts.pendingVideoOrders} label="Bekleyen video siparişi" hint="Teklif veya teslim bekliyor" />
            <Stat href="/admin/agents?abonelik=active" value={state.counts.activeSubscribers} label="Aktif abone" hint="Ödemesi güncel" />
            <Stat
              href="/admin/agents?abonelik=past_due"
              value={state.counts.pastDue}
              label="Gecikmiş ödeme"
              hint="Erişimi risk altında"
              warning={state.counts.pastDue > 0}
            />
          </ul>

          <section aria-labelledby="recent" className={card}>
            <div className="flex items-center justify-between gap-3 px-5 pt-5">
              <h2 id="recent" className="font-display text-xl font-normal tracking-[-0.03em]">
                Son katılan emlakçılar
              </h2>
              <Link href="/admin/agents" className="text-sm font-medium text-terracotta-700 hover:underline">
                Tümü →
              </Link>
            </div>
            <ul className="mt-3 divide-y divide-mist-200">
              {state.recentAgents.map((a) => (
                <RecentRow key={a.id} agent={a} />
              ))}
            </ul>
          </section>
        </>
      )}
    </main>
  );
}

function Stat({ href, value, label, hint, warning = false }: { href: string; value: number; label: string; hint: string; warning?: boolean }) {
  return (
    <li>
      <Link
        href={href}
        data-tone={warning ? "warning" : undefined}
        className={`${card} flex h-full flex-col gap-1 p-5 transition-shadow hover:shadow-[0_12px_32px_-16px_rgb(16_37_63/0.35)] focus-visible:outline-2 focus-visible:outline-terracotta-600 ${
          warning ? "border-brick-700/40 bg-brick-700/5" : ""
        }`}
      >
        <span className={`font-display text-4xl font-normal tracking-[-0.03em] tabular-nums ${warning ? "text-brick-700" : ""}`}>{value}</span>
        <span className="font-medium">{label}</span>
        <span className="text-sm text-slate-500">{hint}</span>
      </Link>
    </li>
  );
}

function RecentRow({ agent }: { agent: AgentRow }) {
  const sub = SUB_BADGE[agent.subscription.status];
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 px-5 py-3">
      <div className="min-w-0">
        <Link href={`/admin/agents/${agent.id}`} className="font-medium hover:underline">
          {agent.companyName}
        </Link>
        <p className="truncate text-sm text-slate-500">{agent.email}</p>
      </div>
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <span className={`${badge} ${sub.className}`}>{sub.label}</span>
        <AgentTags agent={agent} />
        <span className="tabular-nums">{fmtDate(agent.createdAt)}</span>
      </div>
    </li>
  );
}
