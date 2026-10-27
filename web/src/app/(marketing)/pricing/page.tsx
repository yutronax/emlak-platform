import { Alert } from "@/components/ui/alert";
import { createClient } from "@/lib/supabase/server";

import { BuyButton } from "./buy-button";

// Next.js 16 Cache Components: cookies() (Supabase session) her istekte
// değişebilir, bu route segment'i prerender edilemez — statik build'i
// engellemesin diye bloklu/dinamik render'a izin veriyoruz.
export const instant = false;

type PlanRow = {
  id: string;
  name: string;
  price_minor_unit: number;
  sort_order: number;
};

type SubscriptionRow = {
  status: string;
  plan_id: string | null;
};

const priceFormatter = new Intl.NumberFormat("tr-TR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function formatPrice(minorUnit: number): string {
  return `${priceFormatter.format(minorUnit / 100)} ₺`;
}

// Vurgulanan (Pro) kartı: plan adında "Pro" geçeni bul; yoksa ortadaki kart.
function findHighlightIndex(plans: PlanRow[]): number {
  const proIndex = plans.findIndex((plan) => /pro/i.test(plan.name));
  return proIndex !== -1 ? proIndex : Math.floor(plans.length / 2);
}

export default async function PricingPage() {
  const supabase = await createClient();

  const { data: plans, error: plansError } = await supabase
    .from("plans")
    .select("id, name, price_minor_unit, sort_order")
    .order("sort_order", { ascending: true })
    .returns<PlanRow[]>();

  if (plansError) {
    console.error("plans sorgusu başarısız", plansError);
    return (
      <main className="mx-auto max-w-6xl bg-fog-50 px-6 py-16 text-ink-900">
        <Alert variant="error">
          Planlar yüklenemedi, lütfen daha sonra tekrar deneyin.
        </Alert>
      </main>
    );
  }

  const { data: auth } = await supabase.auth.getUser();
  let activePlanId: string | null = null;
  let subscriptionError = false;

  if (auth.user) {
    const { data: subscription, error: subscriptionQueryError } = await supabase
      .from("subscriptions")
      .select("status, plan_id")
      .eq("agent_id", auth.user.id)
      .eq("status", "active")
      .maybeSingle();

    if (subscriptionQueryError) {
      console.error("subscriptions sorgusu başarısız", subscriptionQueryError);
      subscriptionError = true;
    } else {
      const row = subscription as SubscriptionRow | null;
      if (row?.status === "active") {
        activePlanId = row.plan_id;
      }
    }
  }

  const planList = plans ?? [];
  const highlightIndex = findHighlightIndex(planList);

  return (
    <main className="mx-auto max-w-6xl bg-fog-50 px-6 py-16 text-ink-900">
      <h1 className="font-display text-3xl font-bold">Abonelik Planları</h1>
      <p className="mt-2 font-body text-slate-500">Fiyatlar TL cinsindendir.</p>

      {subscriptionError && (
        <div className="mt-6">
          <Alert variant="error">
            Abonelik durumunuz yüklenemedi, plan satın alma şu an kullanılamıyor.
          </Alert>
        </div>
      )}

      <ul className="mt-10 grid gap-6 md:grid-cols-3">
        {planList.map((plan, index) => {
          const isActive = activePlanId === plan.id;
          const isHighlighted = index === highlightIndex;
          const cardTone = isHighlighted
            ? "bg-ink-900 text-white md:-translate-y-2 md:shadow-lg"
            : "border border-mist-200 bg-fog-50 text-ink-900";
          const priceTone = isHighlighted ? "text-white" : "text-ink-900";
          return (
            <li
              key={plan.id}
              className={`flex flex-col gap-4 rounded-xl p-6 font-body transition-transform ${cardTone}`}
            >
              <h2 className="font-display text-xl font-semibold">{plan.name}</h2>
              <p className={`font-display text-4xl font-bold ${priceTone}`}>
                {formatPrice(plan.price_minor_unit)}
              </p>
              {isActive ? (
                <p
                  className={`text-sm font-medium ${isHighlighted ? "text-white" : "text-moss-700"}`}
                >
                  Mevcut planınız
                </p>
              ) : (
                !subscriptionError && (
                  <div className="mt-auto">
                    <BuyButton
                      planId={plan.id}
                      variant={isHighlighted ? "inverse" : "primary"}
                    />
                  </div>
                )
              )}
            </li>
          );
        })}
      </ul>
    </main>
  );
}
