"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import type { AdminService, AgentQuery, AgentRow } from "@/lib/admin-ui/types";

import { AgentTags, badge, card, fmtDate, SUB_BADGE, WA_LABEL } from "./labels";

type ListState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; items: AgentRow[]; total: number; page: number; pageSize: number };

const control =
  "rounded-md border border-mist-200 bg-white px-3 py-2 text-sm text-ink-900 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-terracotta-600";
const smallLabel = "text-xs font-medium text-slate-500";

function clean(q: AgentQuery): AgentQuery {
  return Object.fromEntries(Object.entries(q).filter(([, v]) => v !== undefined && v !== "")) as AgentQuery;
}

// URL: ?q=&abonelik=&wa=&sayfa=
export function agentQueryToSearch(q: AgentQuery): string {
  const p = new URLSearchParams();
  if (q.q) p.set("q", q.q);
  if (q.sub) p.set("abonelik", q.sub);
  if (q.wa) p.set("wa", q.wa);
  if (q.page > 1) p.set("sayfa", String(q.page));
  return p.toString();
}

export function AgentsView({ service, initialQuery }: { service: AdminService; initialQuery: AgentQuery }) {
  const [query, setQuery] = useState<AgentQuery>(() => clean(initialQuery));
  const [search, setSearch] = useState(initialQuery.q ?? "");
  const [state, setState] = useState<ListState>({ status: "loading" });
  const requestId = useRef(0);

  const load = useCallback(
    (q: AgentQuery) => {
      const id = ++requestId.current;
      return service.listAgents(q).then(
        (res) => id === requestId.current && setState(res.status === "ok" ? { ...res, status: "ready" } : { status: "error" }),
        () => id === requestId.current && setState({ status: "error" }),
      );
    },
    [service],
  );

  useEffect(() => {
    void load(query);
  }, [load, query]);

  function apply(next: AgentQuery) {
    const q = clean(next);
    const s = agentQueryToSearch(q);
    window.history.replaceState(null, "", s ? `/admin/agents?${s}` : "/admin/agents");
    setState({ status: "loading" });
    setQuery(q);
  }

  function onSearch(e: FormEvent) {
    e.preventDefault();
    apply({ ...query, q: search.trim() || undefined, page: 1 });
  }

  const filtered = Boolean(query.q || query.sub || query.wa);
  const items = state.status === "ready" ? state.items : [];
  const range =
    state.status === "ready" && items.length
      ? `${(state.page - 1) * state.pageSize + 1}–${(state.page - 1) * state.pageSize + items.length} / ${state.total}`
      : null;

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-8 font-body text-ink-900 md:px-6 md:py-10">
      <div>
        <p className="text-xs font-medium tracking-[0.2em] text-terracotta-700 uppercase">Yönetim</p>
        <h1 className="mt-1 font-display text-[1.75rem] leading-tight font-normal tracking-[-0.03em]">Emlakçılar</h1>
      </div>

      <div className={`${card} flex flex-col gap-3 p-4 md:flex-row md:items-end`}>
        <form role="search" onSubmit={onSearch} className="flex flex-1 items-end gap-2">
          <div className="flex flex-1 flex-col gap-1">
            <label htmlFor="ag-search" className={smallLabel}>
              Ara
            </label>
            <input
              id="ag-search"
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Şirket adı veya e-posta"
              className={`${control} w-full`}
            />
          </div>
          <Button type="submit" variant="secondary">
            Bul
          </Button>
        </form>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <label htmlFor="ag-sub" className={smallLabel}>
              Durum
            </label>
            <select
              id="ag-sub"
              value={query.sub ?? ""}
              onChange={(e) => apply({ ...query, sub: (e.target.value || undefined) as AgentQuery["sub"], page: 1 })}
              className={control}
            >
              <option value="">Tümü</option>
              <option value="active">Aktif</option>
              <option value="trialing">Deneme</option>
              <option value="past_due">Ödeme gecikti</option>
              <option value="none">Abonelik yok</option>
              <option value="suspended">Askıda</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="ag-wa" className={smallLabel}>
              WhatsApp
            </label>
            <select
              id="ag-wa"
              value={query.wa ?? ""}
              onChange={(e) => apply({ ...query, wa: (e.target.value || undefined) as AgentQuery["wa"], page: 1 })}
              className={control}
            >
              <option value="">Tümü</option>
              <option value="connected">Bağlı</option>
              <option value="disconnected">Bağlı değil</option>
            </select>
          </div>
        </div>
      </div>

      {state.status === "loading" && (
        <div aria-busy="true" className={`${card} flex animate-pulse flex-col gap-3 p-5 motion-reduce:animate-none`}>
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="h-10 rounded bg-mist-200/70" />
          ))}
        </div>
      )}

      {state.status === "error" && (
        <div role="alert" className={`${card} flex flex-col items-start gap-3 p-6`}>
          <p className="font-medium">Emlakçılar yüklenemedi.</p>
          <Button
            variant="secondary"
            onClick={() => {
              setState({ status: "loading" });
              void load(query);
            }}
          >
            Tekrar dene
          </Button>
        </div>
      )}

      {state.status === "ready" && items.length === 0 && (
        <div className={`${card} flex flex-col items-start gap-3 p-6`}>
          <p className="font-medium">{filtered ? "Bu filtrelere uyan emlakçı yok" : "Henüz emlakçı yok"}</p>
          {filtered && (
            <Button
              variant="secondary"
              onClick={() => {
                setSearch("");
                apply({ page: 1 });
              }}
            >
              Filtreleri temizle
            </Button>
          )}
        </div>
      )}

      {items.length > 0 && (
        <>
          {/* ≥768: tablo · <768: kart listesi (aynı veri, iki düzen). */}
          <div className={`${card} hidden overflow-hidden md:block`}>
            <table className="w-full text-left text-sm">
              <caption className="sr-only">Emlakçılar</caption>
              <thead className="bg-cream-50 text-xs text-slate-500">
                <tr>
                  <th scope="col" className="px-4 py-2.5 font-medium">Emlakçı</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Abonelik</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">WhatsApp</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Kayıt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-mist-200">
                {items.map((a) => {
                  const sub = SUB_BADGE[a.subscription.status];
                  return (
                    <tr key={a.id} className="hover:bg-fog-50">
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <Link href={`/admin/agents/${a.id}`} className="font-medium hover:underline">
                            {a.companyName}
                          </Link>
                          <AgentTags agent={a} />
                        </div>
                        <p className="text-slate-500">{a.email}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`${badge} ${sub.className}`}>{sub.label}</span>
                        {a.subscription.planName && <span className="ml-2 text-slate-500">{a.subscription.planName}</span>}
                      </td>
                      <td className="px-4 py-3 text-slate-500">{WA_LABEL[a.whatsapp]}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-slate-500 tabular-nums">{fmtDate(a.createdAt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <ul aria-label="Emlakçılar" className="flex flex-col gap-2 md:hidden">
            {items.map((a) => {
              const sub = SUB_BADGE[a.subscription.status];
              return (
                <li key={a.id} className={`${card} relative flex flex-col gap-1.5 p-4`}>
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/admin/agents/${a.id}`}
                      className="font-medium outline-none after:absolute after:inset-0 after:rounded-2xl after:content-[''] focus-visible:after:ring-2 focus-visible:after:ring-terracotta-600"
                    >
                      {a.companyName}
                    </Link>
                    <AgentTags agent={a} />
                  </div>
                  <p className="truncate text-sm text-slate-500">{a.email}</p>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <span className={`${badge} ${sub.className}`}>{sub.label}</span>
                    <span>WhatsApp: {WA_LABEL[a.whatsapp]}</span>
                    <span className="tabular-nums">{fmtDate(a.createdAt)}</span>
                  </div>
                </li>
              );
            })}
          </ul>

          <div className="flex items-center justify-between gap-2 text-sm">
            <Button
              variant="secondary"
              aria-label="Önceki sayfa"
              disabled={query.page <= 1}
              onClick={() => apply({ ...query, page: query.page - 1 })}
            >
              ←
            </Button>
            {range && <span className="text-slate-500 tabular-nums">{range}</span>}
            <Button
              variant="secondary"
              aria-label="Sonraki sayfa"
              disabled={state.status !== "ready" || state.page * state.pageSize >= state.total}
              onClick={() => apply({ ...query, page: query.page + 1 })}
            >
              →
            </Button>
          </div>
        </>
      )}
    </main>
  );
}
