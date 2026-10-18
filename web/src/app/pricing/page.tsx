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
      <main className="mx-auto max-w-4xl p-8">
        <p className="text-red-600">
          Planlar yüklenemedi, lütfen daha sonra tekrar deneyin.
        </p>
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

  return (
    <main className="mx-auto max-w-4xl p-8">
      <h1 className="text-xl font-semibold">Abonelik Planları</h1>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        Fiyatlar TL cinsindendir.
      </p>

      {subscriptionError && (
        <p className="mt-4 text-sm text-red-600">
          Abonelik durumunuz yüklenemedi, plan satın alma şu an kullanılamıyor.
        </p>
      )}

      <ul className="mt-6 grid gap-4 sm:grid-cols-3">
        {(plans ?? []).map((plan) => {
          const isActive = activePlanId === plan.id;
          return (
            <li
              key={plan.id}
              className="flex flex-col gap-3 rounded border p-4"
            >
              <h2 className="text-lg font-semibold">{plan.name}</h2>
              <p className="text-2xl font-semibold">
                {formatPrice(plan.price_minor_unit)}
              </p>
              {isActive ? (
                <p className="text-sm text-green-700 dark:text-green-400">
                  Mevcut planınız
                </p>
              ) : (
                !subscriptionError && <BuyButton planId={plan.id} />
              )}
            </li>
          );
        })}
      </ul>
    </main>
  );
}
