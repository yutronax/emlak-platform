export type CtaSubscription = {
  status: string;
  plan_id: string | null;
  current_period_end: string | null;
};

export type CtaState =
  | { kind: "guest" }
  | { kind: "none" }
  | { kind: "trialing"; daysLeft: number }
  // Deneme süresi bitti (yalnız trialing kaynaklı).
  | { kind: "expired" }
  // Ücretli abonelik sona erdi (canceled, past_due vb. aktif/trialing olmayan durumlar).
  | { kind: "lapsed" }
  | { kind: "active" };

const DAY_MS = 24 * 60 * 60 * 1000;

// Fiyat CTA durumu (AC-7). Kalan gün yukarı yuvarlanır.
// "none": giriş yapmış ama hiç abonelik satırı yok (deneme açılamamış olabilir).
export function getCtaState({
  user,
  subscription,
  now,
}: {
  user: { id: string } | null;
  subscription: CtaSubscription | null;
  now: Date;
}): CtaState {
  if (!user) return { kind: "guest" };
  if (!subscription) return { kind: "none" };

  const end = subscription.current_period_end
    ? new Date(subscription.current_period_end).getTime()
    : Number.NaN;
  const remaining = end - now.getTime();
  const ended = !(remaining > 0);

  if (subscription.status === "trialing") {
    if (ended) return { kind: "expired" };
    return { kind: "trialing", daysLeft: Math.ceil(remaining / DAY_MS) };
  }
  if (subscription.status === "active" && !ended) return { kind: "active" };

  // Bilinen olmayan ya da aktif/trialing dışı durumlar: ücretli abonelik bitmiş sayılır.
  return { kind: "lapsed" };
}
