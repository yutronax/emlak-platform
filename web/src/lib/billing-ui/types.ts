// Abonelik ekranının servisten beklediği sözleşme (abonelik-yonetimi-tasarimi/frontend_contract.md).

export type SubscriptionStatus =
  | "active"
  | "trialing"
  | "past_due"
  | "pending"
  | "needs_review"
  | "failed"
  | "canceled"
  | "none";

export type Plan = { id: string; name: string; priceMinor: number; features: string[] };

export type Subscription = {
  status: SubscriptionStatus;
  plan: Plan | null;
  currentPeriodEnd: string | null;
  // Dönem sonunda bitecek; o tarihe kadar erişim sürer.
  cancelAtPeriodEnd: boolean;
  trialEnd: string | null;
};

export type Payment = {
  id: string;
  date: string;
  description: string;
  amountMinor: number;
  status: "paid" | "failed" | "refunded";
  receiptUrl: string | null;
};

export type BillingError = { status: "error"; code: "network" | "unknown"; message?: string };
type Redirect = { status: "redirect"; url: string };

export interface BillingService {
  kind: "mock" | "real";
  load(): Promise<
    { status: "ok"; subscription: Subscription; plans: Plan[]; payments: Payment[] } | { status: "error" }
  >;
  changePlan(
    planId: string,
  ): Promise<{ status: "ok"; subscription: Subscription; effective: "now" | "period_end" } | Redirect | BillingError>;
  cancel(): Promise<{ status: "ok"; subscription: Subscription } | BillingError>;
  resume(): Promise<{ status: "ok"; subscription: Subscription } | BillingError>;
  updatePaymentMethod(): Promise<Redirect | BillingError>;
}
