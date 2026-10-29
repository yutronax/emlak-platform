import Link from "next/link";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { type CtaSubscription, getCtaState } from "@/lib/pricing/cta-state";
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

const AC8_TEXT =
  "14 gün ücretsiz. Kredi kartı istemiyoruz. Deneme bitince hesabınız kendiliğinden ücretlendirilmez. Devam etmek isterseniz bir plan seçip ödeme yaparsınız. Ödeme yapmazsanız erişiminiz duraklar, verileriniz silinmez.";

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

const primaryLink =
  "inline-flex w-full items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-900 bg-terracotta-600 text-white hover:bg-terracotta-700";

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
        <div className="mx-auto max-w-6xl px-4 py-16 md:px-6">
          <Alert variant="error">
            Planlar yüklenemedi, lütfen daha sonra tekrar deneyin.
          </Alert>
        </div>
      </main>
    );
  }

  const { data: auth } = await supabase.auth.getUser();
  let subscription: CtaSubscription | null = null;
  let subscriptionError = false;

  if (auth.user) {
    // En son satır: deneme bitmiş (trialing + geçmiş tarih) da görünsün diye status filtresi yok.
    const { data, error: subscriptionQueryError } = await supabase
      .from("subscriptions")
      .select("status, plan_id, current_period_end")
      .eq("agent_id", auth.user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (subscriptionQueryError) {
      console.error("subscriptions sorgusu başarısız", subscriptionQueryError);
      subscriptionError = true;
    } else {
      subscription = (data as CtaSubscription | null) ?? null;
    }
  }

  const cta = getCtaState({
    user: auth.user ? { id: auth.user.id } : null,
    subscription,
    now: new Date(),
  });

  const planList = plans ?? [];
  const highlightIndex = findHighlightIndex(planList);

  return (
    <main className="flex-1 bg-fog-50 text-ink-900">
      <div className="mx-auto max-w-6xl px-4 py-16 md:px-6">
        <div className="flex items-center justify-between gap-8">
          <div>
            <h1 className="font-display text-3xl font-bold">Abonelik Planları</h1>
            <p className="mt-2 font-body text-slate-500">{AC8_TEXT}</p>
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

        {!subscriptionError && cta.kind === "trialing" && (
          <p className="mt-6 font-body text-sm font-medium text-ink-900">
            {`Denemeniz sürüyor: ${cta.daysLeft} gün kaldı`}
          </p>
        )}
        {!subscriptionError && cta.kind === "expired" && (
          <p className="mt-6 font-body text-sm font-medium text-ink-900">Denemeniz bitti</p>
        )}
        {!subscriptionError && cta.kind === "lapsed" && (
          <p className="mt-6 font-body text-sm font-medium text-ink-900">Aboneliğiniz sona erdi</p>
        )}

        <ul className="mt-10 grid gap-6 md:grid-cols-3">
          {planList.map((plan, index) => {
            const isHighlighted = index === highlightIndex;
            const cardTone = isHighlighted
              ? "bg-ink-900 text-white md:-translate-y-2 md:shadow-lg"
              : "border border-mist-200 bg-fog-50 text-ink-900";
            const priceTone = isHighlighted ? "text-white" : "text-ink-900";
            const isCurrent =
              cta.kind === "active" && subscription?.plan_id === plan.id;
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
                {!subscriptionError && (
                  <div className="mt-auto flex flex-col gap-2">
                    {cta.kind === "guest" && (
                      <Link href="/signup" className={primaryLink}>
                        14 gün ücretsiz dene
                      </Link>
                    )}
                    {cta.kind === "trialing" && (
                      <BuyButton
                        planId={plan.id}
                        label="Şimdi abone ol"
                        variant={isHighlighted ? "inverse" : "secondary"}
                      />
                    )}
                    {(cta.kind === "expired" || cta.kind === "none") && (
                      <BuyButton
                        planId={plan.id}
                        label="Abone ol"
                        variant={isHighlighted ? "inverse" : "primary"}
                      />
                    )}
                    {cta.kind === "lapsed" && (
                      <BuyButton
                        planId={plan.id}
                        label="Yeniden abone ol"
                        variant={isHighlighted ? "inverse" : "primary"}
                      />
                    )}
                    {cta.kind === "active" &&
                      (isCurrent ? (
                        <Button variant="secondary" disabled>
                          Mevcut planınız
                        </Button>
                      ) : (
                        <BuyButton
                          planId={plan.id}
                          label="Abone ol"
                          variant={isHighlighted ? "inverse" : "primary"}
                        />
                      ))}
                    {!isCurrent && (
                      <p
                        className={`text-xs ${isHighlighted ? "text-white/70" : "text-slate-500"}`}
                      >
                        Taahhüt yok, istediğiniz an iptal edin.
                      </p>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </main>
  );
}
