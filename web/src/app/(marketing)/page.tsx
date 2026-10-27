import Link from "next/link";

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
    title: "WhatsApp'a ilan at",
    body: "Emlakçı grubuna ilanını gönder, gerisini sisteme bırak.",
  },
  {
    title: "Video ile hazırlanır",
    body: "İlan bilgileri ve fotoğraflar kısa bir tanıtım videosuna dönüşür.",
  },
  {
    title: "Vitrine çıkar",
    body: "Hazır ilan, onayın ardından müşterilerin göreceği vitrinde yayınlanır.",
  },
];

export default function LandingPage() {
  return (
    <main className="bg-fog-50 text-ink-900">
      <section className="relative mx-auto grid max-w-7xl items-center gap-12 overflow-hidden px-6 py-20 md:grid-cols-2 md:py-32">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={dotGridBackground}
        />

        <div className="relative flex flex-col gap-6">
          <h1 className="font-display text-5xl font-bold leading-tight md:text-6xl lg:text-7xl">
            WhatsApp&apos;tan ilana, dakikalar içinde.
          </h1>
          <p className="max-w-md font-body text-xl text-slate-500">
            Emlakçı ilanlarını WhatsApp grubundan alıp videolu vitrine
            dönüştürüyoruz.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href="/signup" className={primaryLink}>
              Kayıt Ol
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
          <div className="w-full max-w-sm self-end overflow-hidden rounded-xl border border-mist-200 bg-white shadow-sm">
            <div className="relative flex aspect-video items-center justify-center bg-ink-900">
              <span className="ml-1 h-0 w-0 border-y-[10px] border-l-[16px] border-y-transparent border-l-white" />
            </div>
            <div className="px-4 py-3 font-body">
              <p className="font-display font-semibold">Kadıköy 3+1 Daire</p>
              <p className="text-sm text-slate-500">2.450.000 ₺</p>
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-mist-200">
        <ol className="mx-auto grid max-w-6xl gap-12 px-6 py-20 md:grid-cols-3">
          {steps.map((step, index) => (
            <li key={step.title} className="flex flex-col gap-2">
              <span className="font-display text-5xl font-bold text-terracotta-700">
                {index + 1}
              </span>
              <h2 className="font-display text-xl font-semibold">{step.title}</h2>
              <p className="font-body text-slate-500">{step.body}</p>
            </li>
          ))}
        </ol>
      </section>
    </main>
  );
}
