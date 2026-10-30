import Link from "next/link";

import { SUPPORT_WHATSAPP_DISPLAY, SUPPORT_WHATSAPP_URL } from "@/lib/contact";

const primaryLink =
  "inline-flex items-center justify-center gap-2 rounded-md px-6 py-3 font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-900 bg-terracotta-600 text-white hover:bg-terracotta-700";

const secondaryLink =
  "inline-flex items-center justify-center gap-2 rounded-md px-6 py-3 text-base font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-900 border border-ink-900 text-ink-900 bg-transparent hover:bg-mist-200";

// Hafif nokta-grid doku: ink-900 (#10253F) rengi, %9 opaklık, gradient yok.
const dotGridBackground = {
  backgroundImage:
    "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='28' height='28'%3E%3Ccircle cx='1.5' cy='1.5' r='1.5' fill='%2310253F' fill-opacity='0.09'/%3E%3C/svg%3E\")",
};

const steps = [
  {
    title: "Kayıt olun",
    body: "E-postanızla hesap açın. Telefonunuza bir şey kurmanıza gerek yok.",
    illustration: "/illustrations/group-chat.svg",
  },
  {
    title: "Bölge ve grupları filtreleyin",
    body: "İl, ilçe ve gruba göre yalnız ilgilendiğiniz ilanları görün.",
    illustration: "/illustrations/secure-login.svg",
  },
  {
    title: "İlanları tek yerden görün",
    body: "İlanlar düzenli bir listede durur. Yeni ilan gelince bildirim alırsınız.",
    illustration: "/illustrations/property-agreement.svg",
  },
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
  {
    title: "Fotoğraf yükleyin",
    body: "İlanınızın fotoğraflarını gönderin, biz videoya çeviririz.",
    price: "750 TL",
  },
  {
    title: "Kendi çektiğiniz videoyu gönderin",
    body: "Telefonla çektiğiniz ham videoyu yükleyin.",
    price: "750 TL",
  },
  {
    title: "Yerinde çekim",
    body: "Uygun bölgelerde ekibimiz mülke gelip çeker.",
    price: "Fiyat teklifi verilir",
  },
];

const faqs = [
  {
    question: "Uygulama indirmem mi gerekiyor?",
    answer:
      "Hayır. Telefonunuza bir şey kurmazsınız, WhatsApp hesabınızı da bağlamazsınız. Siteye girip ilanları görürsünüz.",
  },
  {
    question: "Ücretsiz deneyebilir miyim?",
    answer:
      "Evet. Ücretsiz deneyin, kredi kartı bilgisi istemiyoruz.",
  },
  {
    question: "Hangi gruplardan ilan geleceğine kim karar veriyor?",
    answer:
      "Siz seçersiniz. Seçmediğiniz grupların mesajlarını saklamayız.",
  },
  {
    question: "Reklam videosu ücretli mi, nasıl hazırlanıyor?",
    answer:
      "Evet, reklam videosu ayrı ücretlendirilen bir ek hizmettir. Fotoğraflarınızı ya da kendi çektiğiniz videoyu yüklersiniz, videoyu editörlerimiz hazırlar.",
  },
  {
    question: "Bir sorun yaşarsam ne yapmalıyım?",
    answer: null,
  },
];

export default function LandingPage() {
  return (
    <main className="bg-fog-50 text-ink-900">
      <section className="relative mx-auto grid max-w-6xl items-center gap-12 overflow-hidden px-4 py-20 md:px-6 md:grid-cols-2 md:py-32">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={dotGridBackground}
        />

        <div className="relative flex flex-col gap-6">
          <h1 className="font-display text-4xl font-bold leading-tight sm:text-5xl md:text-6xl lg:text-7xl">
            WhatsApp gruplarınıza düşen ilanlar, tek sayfada düzenli.
          </h1>
          <div className="flex flex-col gap-2">
            <p className="max-w-md font-body text-xl text-slate-500">
              Emlak WhatsApp gruplarındaki ilanları biz topluyoruz. Siz tek
              sayfada bölgeye ve gruba göre filtreleyin.
            </p>
            <p className="font-body text-sm font-medium text-ink-900">
              Uygulama yok. Kurulum yok. Kredi kartı istemeden ücretsiz deneyin.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/signup" className={primaryLink}>
              Ücretsiz Deneyin
            </Link>
            <Link href="/pricing" className={secondaryLink}>
              Fiyatları Gör
            </Link>
          </div>
        </div>

        <div
          aria-hidden="true"
          className="relative flex flex-col items-center gap-4"
        >
          <div className="max-w-sm self-start rounded-2xl rounded-bl-none bg-mist-200 px-5 py-4 font-body text-sm">
            <p className="font-medium">3+1 satılık daire, Kadıköy</p>
            <p className="text-slate-500">2.450.000 ₺ · 120 m²</p>
          </div>
          <svg
            width="32"
            height="48"
            viewBox="0 0 32 48"
            fill="none"
            className="text-terracotta-700"
          >
            <path
              d="M16 0 V40 M6 32 L16 44 L26 32"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <div className="w-full max-w-sm self-end overflow-hidden rounded-xl border border-mist-200 bg-white px-4 py-3 font-body shadow-sm">
            <p className="font-display font-semibold">Kadıköy 3+1 Daire</p>
            <p className="text-sm text-slate-500">2.450.000 ₺ · 120 m²</p>
            <p className="mt-2 text-xs text-terracotta-700">
              Kadıköy Emlakçılar grubundan
            </p>
          </div>
        </div>
      </section>

      <section className="border-t border-mist-200">
        <ol className="mx-auto grid max-w-6xl gap-12 px-4 py-20 md:grid-cols-3 md:px-6">
          {steps.map((step, index) => (
            <li key={step.title} className="flex flex-col gap-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={step.illustration}
                alt=""
                aria-hidden="true"
                className="h-40 w-full object-contain"
              />
              <span className="font-display text-5xl font-bold text-terracotta-700">
                {index + 1}
              </span>
              <h2 className="font-display text-xl font-semibold">{step.title}</h2>
              <p className="font-body text-slate-500">{step.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="border-t border-mist-200">
        <div className="mx-auto max-w-6xl px-4 py-20 md:px-6">
          <h2 className="font-display text-3xl font-bold">WhatsApp&apos;ım güvende mi?</h2>
          <p className="mt-3 max-w-2xl font-body text-slate-500">
            Ne yaptığımızı ve henüz yapmadıklarımızı açıkça yazıyoruz.
          </p>
          <ul className="mt-10 grid gap-6 md:grid-cols-2">
            {trustItems.map((item) => (
              <li
                key={item.title}
                className="flex flex-col gap-2 rounded-xl border border-mist-200 bg-white p-5 font-body"
              >
                <h3 className="font-display text-lg font-semibold">
                  {item.title}
                  {item.tag && (
                    <span className="ml-2 align-middle text-xs font-medium text-terracotta-700">
                      {item.tag}
                    </span>
                  )}
                </h3>
                <p className="text-sm text-slate-500">{item.body}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="border-t border-mist-200">
        <div className="mx-auto max-w-6xl px-4 py-20 md:px-6">
          <div className="grid gap-12 md:grid-cols-2 md:items-center">
            <div className="flex flex-col gap-4">
              <h2 className="font-display text-3xl font-bold">İlanınıza reklam videosu</h2>
              <p className="font-body text-slate-500">
                Reklam videosu ücretli bir ek hizmettir. Videoyu editörlerimiz
                hazırlar.
              </p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/illustrations/video-upload.svg"
                alt=""
                aria-hidden="true"
                className="h-40 w-full object-contain md:h-56"
              />
            </div>
            <ul className="flex flex-col gap-4">
              {videoOptions.map((option) => (
                <li
                  key={option.title}
                  className="flex flex-col gap-1 rounded-xl border border-mist-200 bg-white p-5 font-body"
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <h3 className="font-display text-lg font-semibold">{option.title}</h3>
                    <span className="whitespace-nowrap text-sm font-semibold text-ink-900">
                      {option.price}
                    </span>
                  </div>
                  <p className="text-sm text-slate-500">{option.body}</p>
                </li>
              ))}
              <li>
                <Link
                  href="/agent/videos/new"
                  className="inline-flex items-center rounded-md bg-terracotta-600 px-4 py-2 font-body text-sm font-medium text-white hover:bg-terracotta-700"
                >
                  Video siparişi ver
                </Link>
              </li>
            </ul>
          </div>
        </div>
      </section>

      <section className="border-t border-mist-200">
        <div className="mx-auto max-w-3xl px-4 py-20 md:px-6">
          <h2 className="font-display text-3xl font-bold">Sık Sorulan Sorular</h2>
          <dl className="mt-10 flex flex-col gap-6">
            {faqs.map((faq) => (
              <div
                key={faq.question}
                className="flex flex-col gap-2 border-b border-mist-200 pb-6"
              >
                <dt className="font-display text-lg font-semibold">
                  {faq.question}
                </dt>
                <dd className="font-body text-slate-500">
                  {faq.answer ?? (
                    <>
                      Destek ekibimize WhatsApp üzerinden yazın:{" "}
                      <a
                        href={SUPPORT_WHATSAPP_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium text-terracotta-700 underline"
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
    </main>
  );
}
