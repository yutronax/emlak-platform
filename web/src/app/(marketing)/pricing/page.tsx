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

// Sıraya göre "neler dahil" maddeleri. Plan sayısı bu listeden fazlaysa son liste kullanılır.
const PLAN_FEATURES: string[][] = [
  [
    "3 WhatsApp grubu bağlayın",
    "İlanları filtreleyerek görün",
    "Yeni ilan gelince site bildirimi",
    "E-posta ile destek",
  ],
  [
    "10 WhatsApp grubu bağlayın",
    "İlanları filtreleyerek görün",
    "Yeni ilan gelince site bildirimi",
    "WhatsApp ile destek",
  ],
  [
    "Sınırsız WhatsApp grubu",
    "İlanları filtreleyerek görün",
    "Yeni ilan gelince site bildirimi",
    "Öncelikli destek",
  ],
];

function featuresFor(index: number): string[] {
  return PLAN_FEATURES[index] ?? PLAN_FEATURES[PLAN_FEATURES.length - 1];
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
      <main className="flex-1 bg-fog-50 text-ink-900">
      <div className="mx-auto max-w-6xl px-6 py-16">
        <Alert variant="error">
          Planlar yüklenemedi, lütfen daha sonra tekrar deneyin.
        </Alert>
      </div>
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
    <main className="flex-1 bg-fog-50 text-ink-900">
      <div className="mx-auto max-w-6xl px-6 py-16">
      <div className="flex items-center justify-between gap-8">
        <div>
          <h1 className="font-display text-3xl font-bold">Abonelik Planları</h1>
          <p className="mt-2 font-body text-slate-500">
            Kredi kartı istemeden deneyin, istediğiniz an planınızı değiştirin.
          </p>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/illustrations/pricing.svg" alt="" aria-hidden="true" className="hidden h-36 w-auto md:block" />
      </div>
      <p className="mt-4 font-body text-sm text-slate-500">
        Reklam videosu ayrı ücretlendirilen bir hizmettir.
      </p>

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
                <span className="ml-2 font-body text-base font-normal">/ ay</span>
              </p>
              <ul className="flex flex-col gap-2 text-sm">
                {featuresFor(index).map((feature) => (
                  <li
                    key={feature}
                    className={`flex gap-2 ${isHighlighted ? "text-white/80" : "text-slate-500"}`}
                  >
                    <span aria-hidden="true" className={isHighlighted ? "text-white" : "text-moss-700"}>✓</span>
                    {feature}
                  </li>
                ))}
              </ul>
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
                    <p
                      className={`mt-2 text-xs ${isHighlighted ? "text-white/70" : "text-slate-500"}`}
                    >
                      Taahhüt yok, istediğiniz an iptal edin.
                    </p>
                  </div>
                )
              )}
            </li>
          );
        })}
      </ul>
    </div>
    </main>
  );
}
