"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import type { AdminService, AgentDetail } from "@/lib/admin-ui/types";
import { formatTryMinor } from "@/lib/format-price";

import { AgentTags, badge, card, fmtDate, SUB_BADGE, WA_LABEL } from "./labels";

type State =
  | { status: "loading" }
  | { status: "error" }
  | { status: "not_found" }
  | { status: "ok"; agent: AgentDetail; isSelf: boolean };

type Action = { kind: "suspend" | "unsuspend" | "makeAdmin" | "removeAdmin"; trigger: HTMLElement };

const PAYMENT: Record<AgentDetail["payments"][number]["status"], string> = {
  paid: "Ödendi",
  failed: "Başarısız",
  refunded: "İade edildi",
};
const LISTING: Record<AgentDetail["recentListings"][number]["status"], string> = {
  pending: "Onay bekliyor",
  approved: "Yayında",
  rejected: "Reddedildi",
};

const ACTION_TEXT: Record<Action["kind"], { title: string; confirm: string; body: string; danger: boolean }> = {
  suspend: {
    title: "Hesabı askıya al",
    confirm: "Askıya al",
    body: "Emlakçı panele giremez ve yeni ilan almaz. Yayındaki ilanları ve ödeme kayıtları silinmez; dilediğinizde yeniden etkinleştirebilirsiniz.",
    danger: true,
  },
  unsuspend: {
    title: "Hesabı yeniden etkinleştir",
    confirm: "Yeniden etkinleştir",
    body: "Emlakçı panele yeniden girebilir; aboneliği geçerliyse ilan akışı devam eder.",
    danger: false,
  },
  makeAdmin: {
    title: "Admin yap",
    confirm: "Admin yap",
    body: "Bu kullanıcı ilan onaylama, video teslim ve emlakçı yönetimi dahil tüm yönetim ekranlarına erişir.",
    danger: true,
  },
  removeAdmin: {
    title: "Admin yetkisini kaldır",
    confirm: "Yetkiyi kaldır",
    body: "Kullanıcı yönetim ekranlarına erişemez; emlakçı paneli etkilenmez.",
    danger: true,
  },
};

export function AgentDetailView({ service, id }: { service: AdminService; id: string }) {
  const [state, setState] = useState<State>({ status: "loading" });
  const [action, setAction] = useState<Action | null>(null);
  const [pending, setPending] = useState(false);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const noticeRef = useRef<HTMLParagraphElement>(null);

  const load = useCallback(
    () =>
      service.getAgent(id).then(
        (res) => setState(res),
        () => setState({ status: "error" }),
      ),
    [service, id],
  );

  useEffect(() => {
    void load();
  }, [load]);

  function close() {
    const trigger = action?.trigger;
    setAction(null);
    setDialogError(null);
    trigger?.focus();
  }

  async function confirm() {
    if (!action || state.status !== "ok") return;
    setPending(true);
    setDialogError(null);
    try {
      const a = state.agent;
      const res =
        action.kind === "suspend" || action.kind === "unsuspend"
          ? await service.setSuspended(a.id, action.kind === "suspend")
          : await service.setAdmin(a.id, action.kind === "makeAdmin");
      if (res.status === "ok") {
        setState({ ...state, agent: res.agent });
        setNotice(
          {
            suspend: "Hesap askıya alındı.",
            unsuspend: "Hesap yeniden etkinleştirildi.",
            makeAdmin: "Admin yetkisi verildi.",
            removeAdmin: "Admin yetkisi kaldırıldı.",
          }[action.kind],
        );
        setAction(null);
        noticeRef.current?.focus();
      } else {
        setDialogError(res.code === "self" ? "Kendi yetkinizi kaldıramazsınız." : (res.message ?? "İşlem tamamlanamadı, tekrar deneyin."));
      }
    } catch {
      setDialogError("İşlem tamamlanamadı, tekrar deneyin.");
    } finally {
      setPending(false);
    }
  }

  const back = (
    <Link href="/admin/agents" className="text-sm font-medium text-terracotta-700 hover:underline">
      ← Emlakçılar
    </Link>
  );

  if (state.status === "loading") {
    return (
      <Shell back={back}>
        <div aria-busy="true" className={`${card} h-48 animate-pulse motion-reduce:animate-none`} />
      </Shell>
    );
  }
  if (state.status === "not_found") {
    return (
      <Shell back={back}>
        <div className={`${card} p-6`}>
          <p className="font-medium">Emlakçı bulunamadı</p>
          <p className="mt-1 text-sm text-slate-500">Hesap silinmiş ya da bağlantı hatalı olabilir.</p>
        </div>
      </Shell>
    );
  }
  if (state.status === "error") {
    return (
      <Shell back={back}>
        <div role="alert" className={`${card} flex flex-col items-start gap-3 p-6`}>
          <p className="font-medium">Emlakçı bilgisi yüklenemedi.</p>
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
      </Shell>
    );
  }

  const { agent, isSelf } = state;
  const sub = SUB_BADGE[agent.subscription.status];
  const open = (kind: Action["kind"]) => (e: { currentTarget: HTMLElement }) => {
    setNotice(null);
    setAction({ kind, trigger: e.currentTarget });
  };

  return (
    <Shell back={back}>
      <header className="flex flex-col gap-2">
        <h1 className="flex flex-wrap items-center gap-2 font-display text-[1.75rem] leading-tight font-normal tracking-[-0.03em]">
          <span className="break-words">{agent.companyName}</span>
          <AgentTags agent={agent} />
        </h1>
        <p className="text-sm break-all text-slate-500">
          {agent.email}
          {agent.contactName && ` · ${agent.contactName}`}
          {agent.phone && ` · ${agent.phone}`}
        </p>
      </header>

      <p ref={noticeRef} tabIndex={-1} role="status" className="text-sm font-medium text-moss-700 outline-none empty:hidden">
        {notice ?? ""}
      </p>

      <dl className={`${card} grid grid-cols-2 gap-px overflow-hidden bg-mist-200 sm:grid-cols-4`}>
        {[
          ["Abonelik", <span key="s" className={`${badge} ${sub.className}`}>{sub.label}</span>],
          ["Plan", agent.subscription.planName ?? "—"],
          ["Dönem sonu", fmtDate(agent.currentPeriodEnd)],
          ["WhatsApp", WA_LABEL[agent.whatsapp]],
        ].map(([k, v]) => (
          <div key={k as string} className="flex flex-col gap-1 bg-white px-4 py-3">
            <dt className="text-xs text-slate-500">{k}</dt>
            <dd className="font-medium">{v}</dd>
          </div>
        ))}
      </dl>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="flex min-w-0 flex-col gap-6">
          <Section title="Ödemeler" empty="Henüz ödeme yok." count={agent.payments.length}>
            {agent.payments.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                <span>
                  <span className="tabular-nums text-slate-500">{fmtDate(p.date)}</span> · {p.description}
                </span>
                <span className="flex items-center gap-3">
                  <span className="tabular-nums">{formatTryMinor(p.amountMinor)}</span>
                  <span className={p.status === "failed" ? "font-medium text-brick-700" : "text-slate-500"}>{PAYMENT[p.status]}</span>
                </span>
              </li>
            ))}
          </Section>
          <Section title="WhatsApp grupları" empty="Henüz grup yok." count={agent.groups.length}>
            {agent.groups.map((g) => (
              <li key={g.name} className="flex justify-between gap-2 py-2.5 text-sm">
                <span>{g.name}</span>
                <span className="text-slate-500 tabular-nums">{g.listingCount} ilan</span>
              </li>
            ))}
          </Section>
          <Section title="Son ilanlar" empty="Henüz ilan yok." count={agent.recentListings.length}>
            {agent.recentListings.map((l) => (
              <li key={l.id} className="flex flex-wrap justify-between gap-2 py-2.5 text-sm">
                <span>{l.title}</span>
                <span className="text-slate-500">
                  {LISTING[l.status]} · <span className="tabular-nums">{fmtDate(l.createdAt)}</span>
                </span>
              </li>
            ))}
          </Section>
          <Section title="Video siparişleri" empty="Video siparişi yok." count={agent.videoOrders.length}>
            {agent.videoOrders.map((v) => (
              <li key={v.id} className="flex flex-wrap justify-between gap-2 py-2.5 text-sm">
                <span>{v.title}</span>
                <span className="text-slate-500">{v.status}</span>
              </li>
            ))}
          </Section>
        </div>

        <section aria-labelledby="actions" className={`${card} flex flex-col gap-4 self-start p-5`}>
          <h2 id="actions" className="font-display text-lg font-normal tracking-[-0.03em]">
            Hesap aksiyonları
          </h2>
          <div className="flex flex-col gap-2">
            {agent.suspended ? (
              <Button variant="secondary" onClick={open("unsuspend")}>
                Yeniden etkinleştir
              </Button>
            ) : (
              <Button variant="secondary" className="border-brick-700 text-brick-700" onClick={open("suspend")}>
                Askıya al
              </Button>
            )}
            {agent.isAdmin ? (
              <Button
                variant="secondary"
                disabled={isSelf}
                aria-describedby={isSelf ? "self-admin-note" : undefined}
                onClick={open("removeAdmin")}
              >
                Admin yetkisini kaldır
              </Button>
            ) : (
              <Button variant="secondary" onClick={open("makeAdmin")}>
                Admin yap
              </Button>
            )}
            {isSelf && agent.isAdmin && (
              <p id="self-admin-note" className="text-xs text-slate-500">
                Kendi yetkinizi kaldıramazsınız.
              </p>
            )}
          </div>
          <p className="text-xs text-slate-500">Kayıt: {fmtDate(agent.createdAt)}</p>
        </section>
      </div>

      {action && (
        <ConfirmDialog
          title={ACTION_TEXT[action.kind].title}
          confirmLabel={ACTION_TEXT[action.kind].confirm}
          tone={ACTION_TEXT[action.kind].danger ? "danger" : "default"}
          pending={pending}
          error={dialogError}
          onClose={close}
          onConfirm={() => void confirm()}
        >
          <p>
            <strong className="text-ink-900">{agent.companyName}</strong>: {ACTION_TEXT[action.kind].body}
          </p>
        </ConfirmDialog>
      )}
    </Shell>
  );
}

function Shell({ back, children }: { back: ReactNode; children: ReactNode }) {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-4 py-8 font-body text-ink-900 md:px-6 md:py-10">
      {back}
      {children}
    </main>
  );
}

function Section({ title, empty, count, children }: { title: string; empty: string; count: number; children: ReactNode }) {
  const id = `sec-${title.replace(/\s+/g, "-")}`;
  return (
    <section aria-labelledby={id} className={`${card} p-5`}>
      <h2 id={id} className="font-display text-lg font-normal tracking-[-0.03em]">
        {title}
      </h2>
      {count === 0 ? (
        <p className="mt-2 text-sm text-slate-500">{empty}</p>
      ) : (
        <ul className="mt-2 divide-y divide-mist-200">{children}</ul>
      )}
    </section>
  );
}
