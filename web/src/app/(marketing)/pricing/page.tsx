import Link from "next/link";
import { connection } from "next/server";

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
  // Günlük ilan görüntüleme limiti; null = sınırsız (EML-98 AC-8).
  max_listings: number | null;
};

function listingLimitLabel(maxListings: number | null): string {
  return maxListings === null ? "Sınırsız ilan" : `Günde ${maxListings} ilan`;
}

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

// Tasarım dili: obss_project/artifacts/tasarim-dili-stellar-concrete/design_direction.md
const ctaLink =
  "inline-flex w-full items-center justify-center rounded-leaf px-4 py-3 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta-600";
const ctaTone = {
  default: "bg-ink-900 text-white hover:bg-ink-800",
  highlighted: "bg-cream-50 text-ink-900 hover:bg-white",
};

const container = "mx-auto w-full max-w-6xl px-4 md:px-6";

export default async function PricingPage() {
  // Supabase oturum okuması Date.now() kullanır; prerender sırasında çalışmasın diye
  // ilk await'ten önce istek-zamanlı işaretlenir (dashboard ile aynı gerekçe).
  await connection();
  const supabase = await createClient();

  const { data: plans, error: plansError } = await supabase
    .from("plans")
    .select("id, name, price_minor_unit, sort_order, max_listings")
    .order("sort_order", { ascending: true })
    .returns<PlanRow[]>();

  if (plansError) {
    console.error("plans sorgusu başarısız", plansError);
    return (
      <main className="flex-1 bg-cream-50 text-charcoal">
        <div className={`${container} py-16`}>
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
    <main className="flex-1 bg-cream-50 text-charcoal">
      {/* Başlık bandı: taş zemin, ince dev başlık + tek serif vurgu. Bölüm başlıkları h2 değil:
          testler h2'leri plan adları olarak sayar. */}
      <header className="bg-stone-200">
        <div className={`${container} pt-16 pb-14 md:pt-24 md:pb-20`}>
          <p className="font-body text-sm font-medium tracking-[0.2em] text-ash-400 uppercase">Fiyatlar</p>
          <h1 className="mt-4 max-w-4xl font-display text-5xl leading-[0.98] font-light tracking-[-0.045em] md:text-[5.5rem]">
            Abonelik planları, <em className="accent">taahhütsüz</em>.
          </h1>
          <p className="mt-6 max-w-2xl font-body text-lg text-charcoal/75">{AC8_TEXT}</p>
          <p className="mt-3 font-body text-sm text-charcoal/60">Reklam videosu ayrı ücretlendirilen bir hizmettir.</p>
        </div>
      </header>

      <div className={`${container} py-14 md:py-20`}>
        {subscriptionError && (
          <div className="mb-8">
            <Alert variant="error">
              Abonelik durumunuz yüklenemedi, plan satın alma şu an kullanılamıyor.
            </Alert>
          </div>
        )}

        {!subscriptionError && (cta.kind === "trialing" || cta.kind === "expired" || cta.kind === "lapsed") && (
          <p className="mb-8 inline-flex items-center gap-2 rounded-leaf border border-charcoal/15 bg-white px-4 py-2 font-body text-sm font-medium text-ink-900">
            <span aria-hidden="true" className="h-2 w-2 rounded-full bg-terracotta-600" />
            {cta.kind === "trialing"
              ? `Denemeniz sürüyor: ${cta.daysLeft} gün kaldı`
              : cta.kind === "expired"
                ? "Denemeniz bitti"
                : "Aboneliğiniz sona erdi"}
          </p>
        )}

        <ul className="grid gap-5 md:grid-cols-3 md:items-stretch">
          {planList.map((plan, index) => {
            const isHighlighted = index === highlightIndex;
            const cardTone = isHighlighted
              ? "bg-ink-900 text-cream-50"
              : "border border-charcoal/12 bg-white text-charcoal";
            const muted = isHighlighted ? "text-cream-50/70" : "text-charcoal/60";
            const rule = isHighlighted ? "border-cream-50/15" : "border-charcoal/10";
            const isCurrent =
              cta.kind === "active" && subscription?.plan_id === plan.id;
            return (
              <li
                key={plan.id}
                className={`flex flex-col gap-6 rounded-leaf p-6 font-body md:p-8 ${cardTone}`}
              >
                <h2 className="font-display text-2xl font-normal tracking-[-0.03em]">{plan.name}</h2>
                <p className="flex items-baseline gap-2">
                  <span className="font-display text-5xl font-light tracking-[-0.045em] tabular-nums">
                    {formatPrice(plan.price_minor_unit)}
                  </span>
                  <span className={`font-body text-base ${muted}`}>/ ay</span>
                </p>
                {/* Ayrı satır: madde listesindeki li sayısı değişmesin (plan testleri 3-4 madde bekler). */}
                <p className={`border-y py-3 text-sm font-medium ${rule}`}>{listingLimitLabel(plan.max_listings)}</p>
                <ul className="flex flex-col gap-2.5 text-sm">
                  {featuresFor(index).map((feature) => (
                    <li key={feature} className={`flex gap-2.5 ${muted}`}>
                      <span aria-hidden="true" className={isHighlighted ? "text-terracotta-600" : "text-moss-700"}>
                        ✓
                      </span>
                      {feature}
                    </li>
                  ))}
                </ul>
                {!subscriptionError && (
                  <div className="mt-auto flex flex-col gap-2">
                    {cta.kind === "guest" && (
                      <Link
                        href="/signup"
                        className={`${ctaLink} ${isHighlighted ? ctaTone.highlighted : ctaTone.default}`}
                      >
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
                    {!isCurrent && <p className={`text-xs ${muted}`}>Taahhüt yok, istediğiniz an iptal edin.</p>}
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
