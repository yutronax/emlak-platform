"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import type { BillingError, BillingService, Payment, Plan, Subscription, SubscriptionStatus } from "@/lib/billing-ui/types";
import { formatTryMinor } from "@/lib/format-price";

type BillingViewProps = {
  service: BillingService;
  navigate?: (url: string) => void;
};

type Loaded = { subscription: Subscription; plans: Plan[]; payments: Payment[] };

const dateFormatter = new Intl.DateTimeFormat("tr-TR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: "Europe/Istanbul",
});
const fmtDate = (v: string | null) => (v ? dateFormatter.format(new Date(v)) : "—");

const ERROR_TEXT: Record<BillingError["code"], string> = {
  network: "Bağlantı sorunu, tekrar deneyin.",
  unknown: "Bir sorun oluştu, tekrar deneyin.",
};
const errorText = (e: BillingError) => e.message ?? ERROR_TEXT[e.code];

// Rozet: metin anlamı taşır, renk yalnız destekler.
const BADGE: Record<SubscriptionStatus, { label: string; className: string }> = {
  active: { label: "Aktif", className: "bg-moss-700/10 text-moss-700" },
  trialing: { label: "Deneme", className: "bg-moss-700/10 text-moss-700" },
  past_due: { label: "Ödeme gecikti", className: "bg-brick-700/10 text-brick-700" },
  pending: { label: "Onay bekliyor", className: "bg-mist-200 text-ink-900" },
  needs_review: { label: "İnceleniyor", className: "bg-mist-200 text-ink-900" },
  failed: { label: "Başarısız", className: "bg-brick-700/10 text-brick-700" },
  canceled: { label: "Sona erdi", className: "bg-mist-200 text-ink-900" },
  none: { label: "Abonelik yok", className: "bg-mist-200 text-ink-900" },
};

const PAYMENT_LABEL: Record<Payment["status"], { label: string; className: string }> = {
  paid: { label: "Ödendi", className: "text-moss-700" },
  failed: { label: "Başarısız", className: "text-brick-700" },
  refunded: { label: "İade edildi", className: "text-slate-500" },
};

const hasPlan = (s: SubscriptionStatus) => s === "active" || s === "trialing" || s === "past_due";
const busy = (s: SubscriptionStatus) => s === "pending" || s === "needs_review";

const card = "rounded-2xl border border-mist-200 bg-white p-5 sm:p-8";
const sectionTitle = "font-display text-xl font-bold";

type Dialog = { kind: "change"; plan: Plan; trigger: HTMLElement | null } | { kind: "cancel"; trigger: HTMLElement | null };

export function BillingView({ service, navigate = (url) => window.location.assign(url) }: BillingViewProps) {
  const [state, setState] = useState<{ status: "loading" } | { status: "error" } | ({ status: "ready" } & Loaded)>({
    status: "loading",
  });
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [pending, setPending] = useState(false);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [inlineError, setInlineError] = useState<string | null>(null);
  const plansRef = useRef<HTMLElement>(null);

  const load = useCallback(
    () =>
      service.load().then(
        (res) => setState(res.status === "ok" ? { ...res, status: "ready" } : { status: "error" }),
        () => setState({ status: "error" }),
      ),
    [service],
  );

  useEffect(() => {
    void load();
  }, [load]);

  function retry() {
    setState({ status: "loading" });
    void load();
  }

  function setSubscription(subscription: Subscription) {
    setState((s) => (s.status === "ready" ? { ...s, subscription } : s));
  }

  function closeDialog() {
    const trigger = dialog?.trigger;
    setDialog(null);
    setDialogError(null);
    trigger?.focus();
  }

  async function act<T extends { status: string }>(action: () => Promise<T | BillingError>, onOk: (r: T) => void, inDialog: boolean) {
    setPending(true);
    setDialogError(null);
    setInlineError(null);
    try {
      const res = await action();
      if (res.status === "error") {
        const text = errorText(res as BillingError);
        if (inDialog) setDialogError(text);
        else setInlineError(text);
        return;
      }
      onOk(res as T);
    } catch {
      if (inDialog) setDialogError(ERROR_TEXT.network);
      else setInlineError(ERROR_TEXT.network);
    } finally {
      setPending(false);
    }
  }

  if (state.status === "loading") {
    return (
      <Shell>
        <div aria-busy="true" className={`${card} flex animate-pulse flex-col gap-4 motion-reduce:animate-none`}>
          <div className="h-6 w-40 rounded bg-mist-200" />
          <div className="h-10 w-2/3 rounded bg-mist-200/70" />
          <div className="h-4 w-1/2 rounded bg-mist-200/70" />
        </div>
      </Shell>
    );
  }

  if (state.status === "error") {
    return (
      <Shell>
        <div role="alert" className={`${card} flex flex-col items-start gap-3`}>
          <p className="font-medium">Abonelik bilgisi yüklenemedi.</p>
          <p className="text-sm text-slate-500">Bağlantınızı kontrol edip tekrar deneyin.</p>
          <Button variant="secondary" onClick={retry}>
            Tekrar dene
          </Button>
        </div>
      </Shell>
    );
  }

  const { subscription: sub, plans, payments } = state;
  const active = hasPlan(sub.status);
  const current = active ? sub.plan : null;
  const badge = BADGE[sub.status];
  const canChange = !busy(sub.status);
  const canCancel = active && !sub.cancelAtPeriodEnd;

  function choosePlan(plan: Plan, trigger: HTMLElement) {
    setNotice(null);
    if (!active) {
      // Aboneliği olmayan kullanıcı doğrudan ödeme akışına gider; onay penceresi gereksiz.
      void act(() => service.changePlan(plan.id), (r) => r.status === "redirect" && navigate(r.url), false);
      return;
    }
    setDialog({ kind: "change", plan, trigger });
  }

  function confirmChange(plan: Plan) {
    void act(
      () => service.changePlan(plan.id),
      (r) => {
        if (r.status === "redirect") return navigate(r.url);
        if (r.status !== "ok") return;
        setSubscription(r.subscription);
        setNotice(
          r.effective === "now"
            ? `Planınız ${plan.name} olarak güncellendi.`
            : `${fmtDate(sub.currentPeriodEnd)} tarihinde ${plan.name} planına geçeceksiniz.`,
        );
        setDialog(null);
      },
      true,
    );
  }

  return (
    <Shell>
      <section aria-labelledby="current-plan" className={card}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="current-plan" className={sectionTitle}>
            Mevcut plan
          </h2>
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${badge.className}`}>{badge.label}</span>
        </div>

        {sub.status === "none" || sub.status === "canceled" ? (
          <div className="mt-4">
            <p className="font-medium">Aktif aboneliğiniz yok</p>
            <p className="mt-1 text-sm text-slate-500">
              WhatsApp gruplarınızdaki ilanları panelde görmek için aşağıdan bir plan seçin.
            </p>
          </div>
        ) : (
          <>
            {sub.plan && (
              <p className="mt-4 flex flex-wrap items-baseline gap-x-3">
                <span className="font-display text-3xl font-bold">{sub.plan.name}</span>
                <span className="text-sm text-slate-500">{formatTryMinor(sub.plan.priceMinor)} / ay</span>
              </p>
            )}
            <StatusLine
              sub={sub}
              pending={pending}
              onResume={() => void act(() => service.resume(), (r) => setSubscription(r.subscription), false)}
              onUpdatePayment={() =>
                void act(() => service.updatePaymentMethod(), (r) => navigate(r.url), false)
              }
              onSeePlans={() => plansRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
            />
          </>
        )}

        {inlineError && (
          <div className="mt-4">
            <Alert variant="error">{inlineError}</Alert>
          </div>
        )}
        <p role="status" className="mt-4 text-sm font-medium text-moss-700 empty:hidden">
          {notice ?? ""}
        </p>
      </section>

      {canChange && (
        <section ref={plansRef} aria-labelledby="plans" className="scroll-mt-6">
          <h2 id="plans" className={`${sectionTitle} mb-4`}>
            {active ? "Planı değiştir" : "Plan seçin"}
          </h2>
          <ul className="grid gap-4 md:grid-cols-3">
            {plans.map((plan) => {
              const isCurrent = current?.id === plan.id;
              return (
                <li
                  key={plan.id}
                  className={`flex flex-col rounded-2xl border bg-white p-5 ${
                    isCurrent ? "border-terracotta-600 ring-1 ring-terracotta-600" : "border-mist-200"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-display text-lg font-bold">{plan.name}</h3>
                    {isCurrent && (
                      <span className="rounded-full bg-terracotta-600/10 px-2.5 py-0.5 text-xs font-semibold text-terracotta-700">
                        Mevcut plan
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-slate-500">
                    <span className="font-display text-2xl font-bold text-ink-900">{formatTryMinor(plan.priceMinor)}</span> / ay
                  </p>
                  <ul className="mt-4 flex flex-1 flex-col gap-1.5 text-sm">
                    {plan.features.map((f) => (
                      <li key={f} className="flex gap-2">
                        <span aria-hidden="true" className="text-moss-700">
                          ✓
                        </span>
                        {f}
                      </li>
                    ))}
                  </ul>
                  {!isCurrent && (
                    <Button
                      variant={active ? "secondary" : "primary"}
                      className="mt-5"
                      disabled={pending}
                      aria-label={`${active ? "Bu plana geç" : "Planı seç"}: ${plan.name}`}
                      onClick={(e) => choosePlan(plan, e.currentTarget)}
                    >
                      {active ? "Bu plana geç" : "Planı seç"}
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section aria-labelledby="payments" className={card}>
        <h2 id="payments" className={`${sectionTitle} mb-4`}>
          Ödeme geçmişi
        </h2>
        {payments.length === 0 ? (
          <p className="text-sm text-slate-500">Henüz ödeme yok.</p>
        ) : (
          <div className="-mx-5 overflow-x-auto px-5 sm:mx-0 sm:px-0">
            <table className="w-full min-w-[520px] text-left text-sm">
              <caption className="sr-only">Ödeme geçmişi</caption>
              <thead className="text-xs text-slate-500">
                <tr className="border-b border-mist-200">
                  <th scope="col" className="py-2 pr-4 font-medium">Tarih</th>
                  <th scope="col" className="py-2 pr-4 font-medium">Açıklama</th>
                  <th scope="col" className="py-2 pr-4 text-right font-medium">Tutar</th>
                  <th scope="col" className="py-2 pr-4 font-medium">Durum</th>
                  <th scope="col" className="py-2 font-medium">
                    <span className="sr-only">Makbuz</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id} className="border-b border-mist-200 last:border-0">
                    <td className="py-3 pr-4 whitespace-nowrap tabular-nums">{fmtDate(p.date)}</td>
                    <td className="py-3 pr-4">{p.description}</td>
                    <td className="py-3 pr-4 text-right whitespace-nowrap tabular-nums">{formatTryMinor(p.amountMinor)}</td>
                    <td className={`py-3 pr-4 font-medium whitespace-nowrap ${PAYMENT_LABEL[p.status].className}`}>
                      {PAYMENT_LABEL[p.status].label}
                    </td>
                    <td className="py-3 text-right whitespace-nowrap">
                      {p.receiptUrl && (
                        <a
                          href={p.receiptUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-medium text-terracotta-700 hover:underline"
                        >
                          Makbuz<span className="sr-only"> (yeni sekmede açılır)</span>
                        </a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {canCancel && (
        <div className="px-1">
          <button
            type="button"
            onClick={(e) => setDialog({ kind: "cancel", trigger: e.currentTarget })}
            className="text-sm font-medium text-slate-500 underline-offset-4 hover:text-brick-700 hover:underline focus-visible:outline-2 focus-visible:outline-terracotta-600"
          >
            Aboneliği iptal et
          </button>
        </div>
      )}

      {dialog?.kind === "change" && (
        <ConfirmDialog
          title={`${dialog.plan.name} planına geç`}
          confirmLabel="Planı değiştir"
          pending={pending}
          error={dialogError}
          onClose={closeDialog}
          onConfirm={() => confirmChange(dialog.plan)}
        >
          {dialog.plan.priceMinor > (current?.priceMinor ?? 0) ? (
            <p>
              Yeni planınız <strong className="text-ink-900">hemen geçerli olur</strong>; bu dönemin kalan günleri için
              aradaki fark tahsil edilir. Aylık ücret: {formatTryMinor(dialog.plan.priceMinor)}.
            </p>
          ) : (
            <p>
              Değişiklik <strong className="text-ink-900">{fmtDate(sub.currentPeriodEnd)} tarihinde geçerli olur</strong>;
              o güne kadar {current?.name} planının özelliklerini kullanırsınız. Yeni aylık ücret:{" "}
              {formatTryMinor(dialog.plan.priceMinor)}.
            </p>
          )}
        </ConfirmDialog>
      )}

      {dialog?.kind === "cancel" && (
        <ConfirmDialog
          title="Aboneliği iptal et"
          confirmLabel="İptal et"
          tone="danger"
          pending={pending}
          error={dialogError}
          onClose={closeDialog}
          onConfirm={() =>
            void act(
              () => service.cancel(),
              (r) => {
                setSubscription(r.subscription);
                setDialog(null);
              },
              true,
            )
          }
        >
          <p>
            {fmtDate(sub.currentPeriodEnd)} tarihine kadar tüm özellikleri kullanmaya devam edersiniz. Sonrasında
            ücret alınmaz; dilediğiniz zaman yeniden başlatabilirsiniz.
          </p>
        </ConfirmDialog>
      )}
    </Shell>
  );
}

function Shell({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8 font-body text-ink-900 md:px-6 md:py-10">
      <div>
        <p className="text-xs font-medium tracking-[0.2em] text-terracotta-700 uppercase">Hesap</p>
        <h1 className="mt-1 font-display text-[1.75rem] leading-tight font-bold">Aboneliğim</h1>
      </div>
      {children}
    </main>
  );
}

function StatusLine({
  sub,
  pending,
  onResume,
  onUpdatePayment,
  onSeePlans,
}: {
  sub: Subscription;
  pending: boolean;
  onResume: () => void;
  onUpdatePayment: () => void;
  onSeePlans: () => void;
}) {
  const text = "mt-2 text-sm text-slate-500";
  switch (sub.status) {
    case "active":
      return sub.cancelAtPeriodEnd ? (
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <p className="text-sm text-brick-700">{fmtDate(sub.currentPeriodEnd)} tarihinde sona erecek.</p>
          <Button variant="secondary" isPending={pending} onClick={onResume}>
            İptali geri al
          </Button>
        </div>
      ) : (
        <p className={text}>Yenilenme: {fmtDate(sub.currentPeriodEnd)}</p>
      );
    case "trialing":
      return <p className={text}>Deneme {fmtDate(sub.trialEnd)} tarihinde bitiyor; sonra plan ücreti alınır.</p>;
    case "past_due":
      return (
        <div role="alert" className="mt-4 flex flex-col items-start gap-3 rounded-xl border border-brick-700/30 bg-brick-700/5 p-4">
          <p className="text-sm text-brick-700">
            Son ödemeniz alınamadı. Erişiminiz kesilmeden ödeme yönteminizi güncelleyin.
          </p>
          <Button isPending={pending} onClick={onUpdatePayment}>
            Ödeme yöntemini güncelle
          </Button>
        </div>
      );
    case "pending":
      return <p className={text}>Ödemeniz onay bekliyor; birkaç dakika sürebilir.</p>;
    case "needs_review":
      return <p className={text}>Ödemeniz inceleniyor; sonuçlanınca e-posta ile haber vereceğiz.</p>;
    case "failed":
      return (
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <p className="text-sm text-brick-700">Ödeme tamamlanamadı.</p>
          <Button variant="secondary" onClick={onSeePlans}>
            Planları gör
          </Button>
        </div>
      );
    default:
      return null;
  }
}
