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

// Tasarım: Stitch "Fiyatlandırma & Paketler" (obss_project/artifacts/stitch/fiyatland_rma_paketler).
const ctaLink =
  "inline-flex min-h-11 w-full items-center justify-center rounded-full px-4 py-2.5 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-900";
const ctaTone = {
  default: "bg-panel-muted text-ink-900 hover:bg-panel-line",
  highlighted: "bg-terracotta-600 text-white hover:bg-terracotta-700",
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
      <header>
        <div className={`${container} panel-enter pt-14 pb-8 text-center md:pt-20 md:pb-12`}>
          <p className="inline-flex rounded-full bg-panel-accent-soft px-3 py-1 font-body text-[0.6875rem] font-semibold tracking-[0.08em] text-terracotta-700 uppercase">
            Şeffaf ve taahhütsüz
          </p>
          <h1 className="mt-4 font-display text-[2.25rem] leading-tight tracking-[-0.02em] md:text-5xl">
            Abonelik <em className="font-display italic">planları</em>
          </h1>
          <p className="mx-auto mt-3 max-w-md font-body text-sm text-charcoal/70">
            Reklam videosu ayrı ücretlendirilen bir hizmettir.
          </p>
        </div>
      </header>

      <div className={`${container} pb-14 md:pb-20`}>
        {subscriptionError && (
          <div className="mb-8">
            <Alert variant="error">
              Abonelik durumunuz yüklenemedi, plan satın alma şu an kullanılamıyor.
            </Alert>
          </div>
        )}

        {!subscriptionError && (cta.kind === "trialing" || cta.kind === "expired" || cta.kind === "lapsed") && (
          <p className="mb-8 inline-flex items-center gap-2 rounded-full border border-panel-line bg-panel-surface px-4 py-2 font-body text-sm font-medium text-ink-900">
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
            // Vurgulu kart koyu değil: terakota çerçeve + rozet, hafif yükseltilmiş (Stitch).
            const cardTone = isHighlighted
              ? "relative border-2 border-terracotta-600 bg-panel-surface text-ink-900 shadow-[0_12px_32px_rgb(38_51_45/10%)] md:-translate-y-2"
              : "border border-panel-line bg-panel-surface text-ink-900";
            const muted = "text-charcoal/70";
            const rule = "border-panel-line";
            const isCurrent =
              cta.kind === "active" && subscription?.plan_id === plan.id;
            return (
              <li
                key={plan.id}
                className={`flex flex-col gap-5 rounded-xl p-6 font-body md:p-7 ${cardTone}`}
              >
                {isHighlighted && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-terracotta-600 px-3 py-1 text-[0.6875rem] font-semibold tracking-[0.06em] whitespace-nowrap text-white uppercase">
                    En çok tercih edilen
                  </span>
                )}
                <h2 className="font-display text-2xl tracking-[-0.01em]">{plan.name}</h2>
                <p className="flex items-baseline gap-2 rounded-lg bg-panel-muted/70 px-4 py-4">
                  <span className="font-display text-4xl tracking-[-0.02em] tabular-nums">
                    {formatPrice(plan.price_minor_unit)}
                  </span>
                  <span className={`font-body text-sm ${muted}`}>/ ay</span>
                </p>
                {/* Ayrı satır: madde listesindeki li sayısı değişmesin (plan testleri 3-4 madde bekler). */}
                <p className={`border-y py-3 text-sm font-medium ${rule}`}>{listingLimitLabel(plan.max_listings)}</p>
                <ul className="flex flex-col gap-2.5 text-sm">
                  {featuresFor(index).map((feature) => (
                    <li key={feature} className={`flex gap-2.5 ${muted}`}>
                      <span aria-hidden="true" className={isHighlighted ? "text-terracotta-600" : "text-moss-700"}>                        ✓
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
                        variant={isHighlighted ? "primary" : "secondary"}
                      />
                    )}
                    {(cta.kind === "expired" || cta.kind === "none") && (
                      <BuyButton
                        planId={plan.id}
                        label="Abone ol"
                        variant="primary"
                      />
                    )}
                    {cta.kind === "lapsed" && (
                      <BuyButton
                        planId={plan.id}
                        label="Yeniden abone ol"
                        variant="primary"
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
                          variant="primary"
                        />
                      ))}
                    {!isCurrent && <p className={`text-xs ${muted}`}>Taahhüt yok, istediğiniz an iptal edin.</p>}
                  </div>
                )}
              </li>
            );
          })}
        </ul>

        {/* Deneme koşulları (AC-8): koyu bant, tek paragraf. */}
        <section aria-label="Ücretsiz deneme" className="mt-12 rounded-xl bg-panel-deep p-6 text-cream-50 md:p-8">
          <p className="inline-flex rounded-full bg-cream-50/10 px-2.5 py-1 text-[0.6875rem] font-semibold tracking-[0.08em] uppercase">
            Risksiz deneme
          </p>
          <p className="mt-3 max-w-3xl font-body text-sm leading-relaxed text-cream-50/80">{AC8_TEXT}</p>
        </section>
      </div>
    </main>
  );
}
