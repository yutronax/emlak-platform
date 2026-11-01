import type { BillingService, Payment, Plan, Subscription, SubscriptionStatus } from "./types";

// Yalnız dev: NEXT_PUBLIC_BILLING_MOCK=1. Durum `?durum=past_due` gibi seçilir (tasarım incelemesi için).
const PLANS: Plan[] = [
  { id: "temel", name: "Temel", priceMinor: 9900, features: ["1 WhatsApp grubu", "Günlük ilan özeti"] },
  {
    id: "pro",
    name: "Pro",
    priceMinor: 29900,
    features: ["5 WhatsApp grubu", "Anlık ilan bildirimi", "Ayda 1 video siparişi indirimi"],
  },
  {
    id: "kurumsal",
    name: "Kurumsal",
    priceMinor: 59900,
    features: ["Sınırsız grup", "Ekip üyeleri", "Öncelikli destek ve video teslimi"],
  },
];

const PAYMENTS: Payment[] = [
  { id: "p3", date: "2026-11-01T09:00:00Z", description: "Pro · Kasım 2026", amountMinor: 29900, status: "paid", receiptUrl: "#" },
  { id: "p2", date: "2026-10-01T09:00:00Z", description: "Pro · Ekim 2026", amountMinor: 29900, status: "failed", receiptUrl: null },
  { id: "p1", date: "2026-09-01T09:00:00Z", description: "Temel → Pro yükseltme farkı", amountMinor: 20000, status: "refunded", receiptUrl: "#" },
];

const STATUSES: SubscriptionStatus[] = ["active", "trialing", "past_due", "pending", "needs_review", "failed", "canceled", "none"];

export function createMockBillingService(scenario: string | undefined, delayMs = 600): BillingService {
  const status = STATUSES.find((s) => s === scenario) ?? "active";
  let subscription: Subscription = {
    status,
    plan: status === "none" ? null : PLANS[1],
    currentPeriodEnd: "2026-12-01T09:00:00Z",
    cancelAtPeriodEnd: false,
    trialEnd: status === "trialing" ? "2026-11-15T09:00:00Z" : null,
  };
  const wait = () => new Promise((r) => setTimeout(r, delayMs));

  return {
    kind: "mock",
    async load() {
      await wait();
      return { status: "ok", subscription, plans: PLANS, payments: status === "none" ? [] : PAYMENTS };
    },
    async changePlan(planId) {
      await wait();
      const plan = PLANS.find((p) => p.id === planId);
      if (!plan) return { status: "error", code: "unknown" };
      // Aboneliği olmayan / bitmiş kullanıcı ödeme sayfasına gider.
      if (subscription.status === "none" || subscription.status === "canceled" || subscription.status === "failed") {
        return { status: "redirect", url: `/pricing?plan=${plan.id}` };
      }
      const upgrade = plan.priceMinor > (subscription.plan?.priceMinor ?? 0);
      if (upgrade) subscription = { ...subscription, plan };
      return { status: "ok", subscription, effective: upgrade ? "now" : "period_end" };
    },
    async cancel() {
      await wait();
      subscription = { ...subscription, cancelAtPeriodEnd: true };
      return { status: "ok", subscription };
    },
    async resume() {
      await wait();
      subscription = { ...subscription, cancelAtPeriodEnd: false };
      return { status: "ok", subscription };
    },
    async updatePaymentMethod() {
      await wait();
      return { status: "redirect", url: "/pricing" };
    },
  };
}
