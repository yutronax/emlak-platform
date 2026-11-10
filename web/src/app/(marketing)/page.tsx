import Link from "next/link";

import { Suspense, type ReactNode } from "react";

import { ShowcasePreview } from "@/components/showcase/showcase-preview";
import { SUPPORT_WHATSAPP_DISPLAY, SUPPORT_WHATSAPP_URL } from "@/lib/contact";
import { srcSet, STOCK } from "@/lib/stock-images";

// Tasarım: Stitch "Warm Editorial Estate" (obss_project/artifacts/stitch/, 2026-11-11), Sıcak Editorial tema.
// Az yazı, görsel ağırlık. Stitch'in uydurduğu iddialar (yapay zekâ, süreler, izlenme sayıları) alınmadı.
const btn =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-5 py-2.5 font-body text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2";
const cta = {
  primary: `${btn} bg-terracotta-600 text-white hover:bg-terracotta-700 focus-visible:outline-ink-900`,
  ghost: `${btn} border border-panel-line-strong bg-panel-surface text-ink-900 hover:bg-panel-muted focus-visible:outline-ink-900`,
  onDark: `${btn} bg-cream-50 text-ink-900 hover:bg-panel-surface focus-visible:outline-cream-50`,
};

const container = "mx-auto w-full max-w-6xl px-4 md:px-6";
const eyebrow =
  "inline-flex items-center rounded-full bg-panel-accent-soft px-2.5 py-1 font-body text-[0.6875rem] font-semibold tracking-[0.08em] text-terracotta-700 uppercase";
const sectionTitle = "font-display text-[1.75rem] leading-tight tracking-[-0.02em] md:text-[2.5rem]";

const heroChecks = ["Kurulum gerekmez", "Kredi kartı gerekmez", "14 gün ücretsiz"];

const steps: { title: string; body: string; icon: ReactNode }[] = [
  {
    title: "Kayıt olun",
    body: "E-postanızla hesap açın, telefona bir şey kurmayın.",
    icon: <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8a7 7 0 0 1 14 0" />,
  },
  {
    title: "Bölge ve grupları filtreleyin",
    body: "İl, ilçe ve gruba göre yalnız ilginizi çekeni görün.",
    icon: <path d="M4 6h16M7 12h10M10 18h4" />,
  },
  {
    title: "İlanları tek yerden görün",
    body: "Düzenli liste; yeni ilan gelince bildirim.",
    icon: <path d="M4 5h16v14H4zM4 10h16M9 10v9" />,
  },
];

const trustItems: { title: string; tag?: string; body: string }[] = [
  { title: "Bugün ortak hesap", body: "İlanlar ortak bir hesapla toplanır; telefonunuza bağlanmayız." },
  { title: "Hesabınız bağlandığında", tag: "planlanan", body: "Kendi hesabınızı bağlama özelliği hazır olunca haber veririz." },
  { title: "Ban riski", body: "Kurallara aykırı kullanımda WhatsApp hesapları kısıtlanabilir." },
  { title: "Veri ve gizlilik", body: "Hangi veriyi neden işlediğimiz KVKK Aydınlatma Metni'nde." },
];

// Reklam videosu örnekleri (dikey 9:16). Süreler dosyalardan ölçüldü (ffprobe).
const SAMPLE_VIDEOS = [
  {
    src: "/videos/ornek-ilan.mp4",
    poster: "/videos/ornek-ilan-kapak.jpg",
    badge: "Örnek",
    label: "Örnek ilan videosu: dikey, 27 saniye, müzikli, stok görüntülerle",
  },
  {
    src: "/videos/ornek-galeri.mp4",
    poster: "/videos/ornek-galeri-kapak.jpg",
    badge: "Galeri",
    label: "İMZA Gayrimenkul için galeri tarzı ilan videosu: dikey, 25 saniye, müzikli",
  },
  {
    src: "/videos/ornek-daire.mp4",
    poster: "/videos/ornek-daire-kapak.jpg",
    badge: "Ev turu",
    label: "İMZA Gayrimenkul için ev turu ilan videosu: dikey, 18 saniye, müzikli",
  },
];

const videoOptions = [
  { title: "Fotoğraf yükleyin", price: "750 TL" },
  { title: "Kendi videonuzu gönderin", price: "750 TL" },
  { title: "Yerinde çekim", price: "Teklif" },
];

const faqs = [
  { question: "Uygulama indirmem mi gerekiyor?", answer: "Hayır. Siteye girip ilanları görürsünüz; WhatsApp hesabınızı bağlamazsınız." },
  { question: "Ücretsiz deneyebilir miyim?", answer: "Evet, 14 gün. Kredi kartı istemiyoruz." },
  { question: "Hangi gruplardan ilan gelir?", answer: "Siz seçersiniz. Seçmediğiniz grupların mesajlarını saklamayız." },
  {
    question: "Reklam videosu nasıl hazırlanıyor?",
    answer: "Ücretli ek hizmettir. Fotoğraf ya da videonuzu yüklersiniz, editörlerimiz hazırlar.",
  },
  { question: "Bir sorun yaşarsam?", answer: null },
];

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  );
}

export default function LandingPage() {
  return (
    <main className="bg-cream-50 text-ink-900">
      {/* 1 · Giriş: açık, fotoğraf sağa doğru eriyen arka plan; kısa başlık + iki eylem */}
      <section className="relative isolate overflow-hidden">
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
          className="absolute inset-0 -z-10 bg-gradient-to-r from-cream-50 via-cream-50/90 to-cream-50/40 md:via-cream-50/75 md:to-cream-50/10"
        />
        <div className={`${container} panel-enter flex min-h-[78svh] flex-col justify-center py-16 md:py-24`}>
          <span className={eyebrow}>Emlak WhatsApp grupları için</span>
          <h1 className="mt-5 max-w-2xl font-display text-[2.25rem] leading-[1.1] tracking-[-0.02em] md:text-[3.5rem]">
            WhatsApp gruplarınızdaki ilanlar{" "}
            <em className="font-display text-terracotta-600 italic">tek panelde</em>.
          </h1>
          <p className="mt-4 max-w-md font-body text-base text-charcoal/75 md:text-lg">
            Bölgeye ve gruba göre süzün, ilanınıza dikey video yaptırın.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link href="/signup" className={cta.primary}>
              14 gün ücretsiz dene
            </Link>
            <Link href="/vitrin" className={cta.ghost}>
              Vitrini gez <span aria-hidden="true">→</span>
            </Link>
          </div>
          <ul className="mt-8 flex flex-wrap gap-x-5 gap-y-2 font-body text-xs text-charcoal/75">
            {heroChecks.map((c) => (
              <li key={c} className="flex items-center gap-1.5">
                <span aria-hidden="true" className="text-moss-700">
                  ✓
                </span>
                {c}
              </li>
            ))}
          </ul>
        </div>
        <p className="absolute right-3 bottom-2 font-body text-[10px] text-charcoal/50">
          Fotoğraf: {STOCK.heroLiving.credit}
        </p>
      </section>

      {/* 2 · Nasıl çalışır: üç kart, her biri tek satır */}
      <section aria-labelledby="how">
        <div className={`${container} py-16 md:py-24`}>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <span className={eyebrow}>İş akışı</span>
              <h2 id="how" className={`${sectionTitle} mt-3`}>
                3 adımda başlayın
              </h2>
            </div>
          </div>
          <ol className="mt-8 grid gap-4 md:grid-cols-3">
            {steps.map((step, index) => (
              <li
                key={step.title}
                className="flex flex-col gap-4 rounded-xl border border-panel-line bg-panel-surface p-5 shadow-[0_4px_16px_rgb(38_51_45/5%)] md:p-6"
              >
                <div className="flex items-start justify-between">
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-panel-muted text-ink-900">
                    <Icon>{step.icon}</Icon>
                  </span>
                  <span className="font-display text-2xl text-panel-line-strong tabular-nums">0{index + 1}</span>
                </div>
                <h3 className="font-display text-xl tracking-[-0.01em]">{step.title}</h3>
                <p className="font-body text-sm text-charcoal/75">{step.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* 3 · Güven: koyu bant, 2×2 kısa maddeler */}
      <section className="bg-panel-deep text-cream-50">
        <div className={`${container} grid gap-8 py-16 md:grid-cols-[minmax(0,4fr)_minmax(0,8fr)] md:py-20`}>
          <div>
            <h2 className={sectionTitle}>WhatsApp&apos;ım güvende mi?</h2>
            <p className="mt-3 max-w-xs font-body text-sm text-cream-50/70">
              Ne yaptığımızı ve henüz yapmadıklarımızı açıkça yazıyoruz.
            </p>
          </div>
          <ul className="grid gap-3 sm:grid-cols-2">
            {trustItems.map((item) => (
              <li key={item.title} className="rounded-xl border border-cream-50/12 bg-cream-50/5 p-5">
                <h3 className="flex flex-wrap items-center gap-2 font-display text-lg">
                  {item.title}
                  {item.tag && (
                    <span className="rounded-full bg-terracotta-600 px-2 py-0.5 font-body text-[0.6875rem] font-semibold text-white">
                      {item.tag}
                    </span>
                  )}
                </h3>
                <p className="mt-1.5 font-body text-sm text-cream-50/70">{item.body}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* 4 · Video stüdyosu: üç dikey telefon kartı + kısa fiyat satırı */}
      <section aria-labelledby="video">
        <div className={`${container} py-16 md:py-24`}>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <span className={eyebrow}>Video stüdyosu</span>
              <h2 id="video" className={`${sectionTitle} mt-3`}>
                İlanınıza <em className="font-display italic">dikey video</em>
              </h2>
              <p className="mt-2 font-body text-sm text-charcoal/75">Reels, TikTok ve WhatsApp Durum için 9:16.</p>
            </div>
            <Link href="/agent/videos/new" className={cta.primary}>
              Video siparişi ver
            </Link>
          </div>

          {/* Örnekler: ilki stok görüntülerle (kaynaklar public/images/CREDITS.md); diğer ikisi
              İMZA Gayrimenkul'ün gerçek bir ilanı için hazırlandı, izinle gösteriliyor (fiyat/telefon gizli). */}
          <figure className="mt-8">
            <ul className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 md:mx-0 md:grid md:grid-cols-3 md:overflow-visible md:px-0">
              {SAMPLE_VIDEOS.map((v) => (
                <li
                  key={v.src}
                  className="relative w-[62vw] max-w-[300px] shrink-0 snap-center overflow-hidden rounded-[1.75rem] border-[6px] border-panel-deep bg-panel-deep shadow-[0_12px_32px_rgb(38_51_45/18%)] md:w-auto md:max-w-none"
                >
                  <span className="absolute top-3 left-3 z-10 rounded-full bg-cream-50/90 px-2 py-0.5 font-body text-[0.6875rem] font-semibold text-ink-900">
                    {v.badge}
                  </span>
                  <video
                    controls
                    playsInline
                    preload="none"
                    poster={v.poster}
                    width={720}
                    height={1280}
                    className="aspect-[9/16] h-auto w-full rounded-[1.25rem]"
                    aria-label={v.label}
                  >
                    <source src={v.src} type="video/mp4" />
                  </video>
                </li>
              ))}
            </ul>
            <figcaption className="mt-3 font-body text-xs text-charcoal/60">
              İlk video stok görüntülerle hazırlanmıştır. Diğer ikisi İMZA Gayrimenkul &amp; Yatırım&apos;ın gerçek bir
              ilanı için hazırlandı ve izinle gösteriliyor; fiyat ve telefon gizlidir.
            </figcaption>
          </figure>

          <ul className="mt-8 grid gap-3 sm:grid-cols-3">
            {videoOptions.map((o) => (
              <li
                key={o.title}
                className="flex items-center justify-between gap-3 rounded-xl border border-panel-line bg-panel-surface px-4 py-3"
              >
                <span className="font-body text-sm font-medium">{o.title}</span>
                <span className="font-body text-sm font-semibold whitespace-nowrap text-terracotta-700 tabular-nums">
                  {o.price}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Önizleme istek anında gelir, gelmezse hiç görünmez. */}
      <Suspense fallback={null}>
        <ShowcasePreview />
      </Suspense>

      {/* 5 · SSS: açılır kapanır, kısa cevaplar */}
      <section className="bg-panel-muted/60">
        <div className={`${container} py-16 md:py-24`}>
          <div className="text-center">
            <span className={eyebrow}>Merak edilenler</span>
            <h2 className={`${sectionTitle} mt-3`}>Sık sorulan sorular</h2>
          </div>
          <div className="mx-auto mt-8 flex max-w-3xl flex-col gap-3">
            {faqs.map((faq, i) => (
              <details
                key={faq.question}
                open={i === 0}
                className="panel-details group rounded-xl border border-panel-line bg-panel-surface"
              >
                <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-4 px-5 py-3 font-display text-lg [&::-webkit-details-marker]:hidden">
                  {faq.question}
                  <span
                    aria-hidden="true"
                    className="text-xl text-charcoal/60 transition-transform group-open:rotate-45"
                  >
                    +
                  </span>
                </summary>
                <p className="px-5 pb-4 font-body text-sm text-charcoal/75">
                  {faq.answer ?? (
                    <>
                      WhatsApp&apos;tan yazın:{" "}
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
                </p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* 6 · Kapanış: kısa, koyu */}
      <section className="bg-panel-deep text-cream-50">
        <div className={`${container} flex flex-col items-start justify-between gap-6 py-14 md:flex-row md:items-center md:py-16`}>
          <h2 className={sectionTitle}>
            Hadi <em className="font-display italic">başlayalım</em>.
          </h2>
          <div className="flex flex-wrap gap-3">
            <Link href="/signup" className={cta.onDark}>
              14 gün ücretsiz dene
            </Link>
            <Link
              href="/pricing"
              className={`${btn} border border-cream-50/40 text-cream-50 hover:bg-cream-50/10 focus-visible:outline-cream-50`}
            >
              Fiyatlar
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
