import Link from "next/link";

import { Suspense } from "react";

import { ShowcasePreview } from "@/components/showcase/showcase-preview";
import { SUPPORT_WHATSAPP_DISPLAY, SUPPORT_WHATSAPP_URL } from "@/lib/contact";
import { srcSet, STOCK } from "@/lib/stock-images";

// Tasarım dili: obss_project/artifacts/tasarim-dili-stellar-concrete/design_direction.md
const btn =
  "inline-flex items-center justify-center gap-2 rounded-leaf px-6 py-3 font-body font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2";
const onDark = {
  primary: `${btn} bg-cream-50 text-ink-900 hover:bg-white focus-visible:outline-cream-50`,
  secondary: `${btn} border border-cream-50/60 text-cream-50 hover:bg-cream-50/10 focus-visible:outline-cream-50`,
};
const onLight = {
  primary: `${btn} bg-ink-900 text-white hover:bg-ink-800 focus-visible:outline-terracotta-600`,
};

const container = "mx-auto w-full max-w-6xl px-4 md:px-6";
const sectionTitle = "font-display text-4xl leading-[1.05] font-normal tracking-[-0.04em] md:text-6xl";

// Concrete tarzı rakam satırı — uydurma istatistik değil, ürünle ilgili doğru bilgiler.
const facts = [
  { value: "0", label: "kurulacak uygulama" },
  { value: "0 ₺", label: "denemek için kredi kartı" },
  { value: "3", label: "adımda başlarsınız" },
  { value: "750 ₺", label: "ilan başına reklam videosu" },
];

const steps = [
  { title: "Kayıt olun", body: "E-postanızla hesap açın. Telefonunuza bir şey kurmanıza gerek yok." },
  { title: "Bölge ve grupları filtreleyin", body: "İl, ilçe ve gruba göre yalnız ilgilendiğiniz ilanları görün." },
  { title: "İlanları tek yerden görün", body: "İlanlar düzenli bir listede durur. Yeni ilan gelince bildirim alırsınız." },
];

const trustItems: { title: string; tag?: string; body: string }[] = [
  {
    title: "Bugün ortak hesap",
    body: "Bugün ilanlar ortak bir hesap üzerinden toplanır. Telefonunuza bağlanmıyoruz.",
  },
  {
    title: "Hesabınız bağlandığında",
    tag: "planlanan",
    body: "Kendi WhatsApp hesabınızı bağlama özelliği henüz hazır değil. Hazır olduğunda size haber vereceğiz.",
  },
  {
    title: "Ban riski",
    body: "WhatsApp hesapları, platform kurallarına aykırı kullanımda kısıtlanabilir. Bu riski bilerek karar verin.",
  },
  {
    title: "Veri ve gizlilik",
    body: "Hangi verileri neden işlediğimizi KVKK Aydınlatma Metni'nde yazıyoruz.",
  },
];

const videoOptions = [
  { title: "Fotoğraf yükleyin", body: "İlanınızın fotoğraflarını gönderin, biz videoya çeviririz.", price: "750 TL" },
  { title: "Kendi çektiğiniz videoyu gönderin", body: "Telefonla çektiğiniz ham videoyu yükleyin.", price: "750 TL" },
  { title: "Yerinde çekim", body: "Uygun bölgelerde ekibimiz mülke gelip çeker.", price: "Fiyat teklifi verilir" },
];

const faqs = [
  {
    question: "Uygulama indirmem mi gerekiyor?",
    answer:
      "Hayır. Telefonunuza bir şey kurmazsınız, WhatsApp hesabınızı da bağlamazsınız. Siteye girip ilanları görürsünüz.",
  },
  { question: "Ücretsiz deneyebilir miyim?", answer: "Evet. Ücretsiz deneyin, kredi kartı bilgisi istemiyoruz." },
  {
    question: "Hangi gruplardan ilan geleceğine kim karar veriyor?",
    answer: "Siz seçersiniz. Seçmediğiniz grupların mesajlarını saklamayız.",
  },
  {
    question: "Reklam videosu ücretli mi, nasıl hazırlanıyor?",
    answer:
      "Evet, reklam videosu ayrı ücretlendirilen bir ek hizmettir. Fotoğraflarınızı ya da kendi çektiğiniz videoyu yüklersiniz, videoyu editörlerimiz hazırlar.",
  },
  { question: "Bir sorun yaşarsam ne yapmalıyım?", answer: null },
];

export default function LandingPage() {
  return (
    <main className="bg-cream-50 text-charcoal">
      {/* 1 · İlk ekran: tam ekran fotoğraf, sol altta başlık, altta rakam satırı */}
      <section className="relative isolate flex min-h-[calc(100svh-56px)] flex-col justify-end overflow-hidden bg-ink-900 text-cream-50">
        {/* eslint-disable-next-line @next/next/no-img-element -- Unsplash CDN, srcSet ile boyutlanır */}
        <img
          src={STOCK.heroLiving.src(1600)}
          srcSet={srcSet(STOCK.heroLiving)}
          sizes="100vw"
          alt=""
          fetchPriority="high"
          className="absolute inset-0 -z-20 h-full w-full object-cover"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10 bg-gradient-to-t from-ink-900 via-ink-900/55 to-ink-900/10"
        />
        <div className={`${container} pt-32 pb-10 md:pb-14`}>
          <h1 className="max-w-4xl font-display text-[2.75rem] leading-[0.98] font-light tracking-[-0.045em] sm:text-6xl md:text-[5.5rem]">
            WhatsApp gruplarınıza düşen ilanlar, <em className="accent">tek sayfada</em> düzenli.
          </h1>
          <p className="mt-6 max-w-xl font-body text-lg text-cream-50/80">
            Emlak WhatsApp gruplarındaki ilanları biz topluyoruz. Siz tek sayfada bölgeye ve gruba göre filtreleyin.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/signup" className={onDark.primary}>
              Ücretsiz Deneyin
            </Link>
            <Link href="/pricing" className={onDark.secondary}>
              Fiyatları Gör
            </Link>
          </div>
          <dl className="mt-12 grid grid-cols-2 gap-x-6 gap-y-6 border-t border-cream-50/20 pt-6 md:mt-16 md:grid-cols-4">
            {facts.map((f) => (
              <div key={f.label} className="flex flex-col-reverse gap-1">
                <dt className="font-body text-sm text-cream-50/70">{f.label}</dt>
                <dd className="font-display text-3xl font-light tracking-[-0.03em] tabular-nums md:text-4xl">{f.value}</dd>
              </div>
            ))}
          </dl>
        </div>
        {/* Mobilde sağ alt sabit Destek düğmesinin altında kalmasın diye solda. */}
        <p className="absolute bottom-2 left-4 font-body text-[10px] text-cream-50/50 md:right-3 md:left-auto">
          Fotoğraf: {STOCK.heroLiving.credit}
        </p>
      </section>

      {/* 2 · Beyan: taş zemin, tek büyük paragraf */}
      <section className="bg-stone-200">
        <div className={`${container} py-20 md:py-32`}>
          <p className="max-w-5xl font-display text-3xl leading-[1.15] font-light tracking-[-0.03em] md:text-5xl">
            Uygulama yok. Kurulum yok. Gruplardaki dağınık mesajlar, bölgeye ve gruba göre süzülmüş{" "}
            <em className="accent">tek bir akışa</em> dönüşür. Kredi kartı istemeden ücretsiz deneyin.
          </p>
        </div>
      </section>

      {/* 3 · Nasıl çalışır: Concrete tarzı dev liste */}
      <section aria-labelledby="how" className="bg-cream-50">
        <div className={`${container} py-20 md:py-28`}>
          <h2 id="how" className="font-body text-sm font-medium tracking-[0.2em] text-ash-400 uppercase">
            Nasıl çalışır
          </h2>
          <ol className="mt-8 border-t border-charcoal/10">
            {steps.map((step, index) => (
              <li
                key={step.title}
                className="grid gap-3 border-b border-charcoal/10 py-8 md:grid-cols-[80px_minmax(0,1fr)_minmax(0,320px)] md:items-baseline md:gap-8 md:py-10"
              >
                <span className="font-body text-sm font-medium text-terracotta-700 tabular-nums">0{index + 1}</span>
                <h3 className="font-display text-3xl leading-tight font-light tracking-[-0.04em] md:text-6xl">{step.title}</h3>
                <p className="font-body text-charcoal/70">{step.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* 4 · Güven: lacivert bant, ince çizgili 2×2 ızgara (Stellar rakam ızgarası) */}
      <section className="bg-ink-900 text-cream-50">
        <div className={`${container} py-20 md:py-28`}>
          <h2 className={sectionTitle}>WhatsApp&apos;ım güvende mi?</h2>
          <p className="mt-4 max-w-2xl font-body text-cream-50/70">
            Ne yaptığımızı ve henüz yapmadıklarımızı açıkça yazıyoruz.
          </p>
          <ul className="mt-12 grid border-t border-l border-cream-50/15 md:grid-cols-2">
            {trustItems.map((item) => (
              <li key={item.title} className="flex flex-col gap-3 border-r border-b border-cream-50/15 p-6 md:p-10">
                <h3 className="flex flex-wrap items-center gap-3 font-display text-2xl font-normal tracking-[-0.03em]">
                  {item.title}
                  {item.tag && (
                    <span className="rounded-leaf bg-terracotta-600 px-2 py-0.5 font-body text-xs font-medium tracking-normal text-white">
                      {item.tag}
                    </span>
                  )}
                </h3>
                <p className="font-body text-cream-50/70">{item.body}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* 5 · Reklam videosu: açık zemin, satır listesi */}
      <section className="bg-cream-50">
        <div className={`${container} grid gap-12 py-20 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] md:py-28`}>
          <div className="flex flex-col gap-5">
            <h2 className={sectionTitle}>
              İlanınıza <em className="accent">reklam videosu</em>
            </h2>
            <p className="max-w-sm font-body text-charcoal/70">
              Reklam videosu ücretli bir ek hizmettir. Videoyu editörlerimiz hazırlar.
            </p>
            <div>
              <Link href="/agent/videos/new" className={onLight.primary}>
                Video siparişi ver
              </Link>
            </div>
          </div>
          <ul className="border-t border-charcoal/10">
            {videoOptions.map((option) => (
              <li key={option.title} className="flex flex-col gap-1 border-b border-charcoal/10 py-6">
                <div className="flex items-baseline justify-between gap-4">
                  <h3 className="font-display text-2xl font-normal tracking-[-0.03em]">{option.title}</h3>
                  <span className="font-body text-sm font-medium whitespace-nowrap text-charcoal">{option.price}</span>
                </div>
                <p className="font-body text-charcoal/70">{option.body}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Sayfanın geri kalanı statik kalır; önizleme istek anında gelir, gelmezse hiç görünmez. */}
      <Suspense fallback={null}>
        <ShowcasePreview />
      </Suspense>

      {/* 6 · SSS */}
      <section className="bg-stone-200">
        <div className={`${container} grid gap-10 py-20 md:grid-cols-[minmax(0,4fr)_minmax(0,8fr)] md:py-28`}>
          <h2 className={sectionTitle}>
            Sık sorulan <em className="accent">sorular</em>
          </h2>
          <dl className="border-t border-charcoal/15">
            {faqs.map((faq) => (
              <div key={faq.question} className="flex flex-col gap-2 border-b border-charcoal/15 py-6">
                <dt className="font-display text-xl font-normal tracking-[-0.02em]">{faq.question}</dt>
                <dd className="font-body text-charcoal/70">
                  {faq.answer ?? (
                    <>
                      Destek ekibimize WhatsApp üzerinden yazın:{" "}
                      <a
                        href={SUPPORT_WHATSAPP_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium text-ink-900 underline underline-offset-4"
                      >
                        {SUPPORT_WHATSAPP_DISPLAY}
                      </a>
                    </>
                  )}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* 7 · Kapanış: tam genişlik fotoğraf + lacivert örtü */}
      <section className="relative isolate overflow-hidden bg-ink-900 text-cream-50">
        {/* eslint-disable-next-line @next/next/no-img-element -- Unsplash CDN, srcSet ile boyutlanır */}
        <img
          src={STOCK.facadeBalconies.src(1600)}
          srcSet={srcSet(STOCK.facadeBalconies)}
          sizes="100vw"
          alt=""
          loading="lazy"
          className="absolute inset-0 -z-20 h-full w-full object-cover"
        />
        <div aria-hidden="true" className="absolute inset-0 -z-10 bg-ink-900/80" />
        <div className={`${container} flex flex-col items-start gap-8 py-24 md:py-36`}>
          <h2 className="font-display text-5xl leading-[0.98] font-light tracking-[-0.045em] md:text-[5.5rem]">
            Hadi <em className="accent">başlayalım</em>.
          </h2>
          <p className="max-w-lg font-body text-lg text-cream-50/80">
            Hesap açmak bir dakika sürer. Kredi kartı gerekmez.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href="/signup" className={onDark.primary}>
              Ücretsiz Deneyin
            </Link>
            <Link href="/pricing" className={onDark.secondary}>
              Fiyatları Gör
            </Link>
          </div>
        </div>
        <p className="absolute bottom-2 left-4 font-body text-[10px] text-cream-50/50 md:right-3 md:left-auto">
          Fotoğraf: {STOCK.facadeBalconies.credit}
        </p>
      </section>
    </main>
  );
}
