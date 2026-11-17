import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Neden biz? · Emlak Platformu",
  description:
    "Gerçek mekân, editör kurgusu, Türkçe seslendirme ve WhatsApp ilan akışı tek yerde. İlan videosunu neden bizden almalısınız?",
};

// Rakip sayfalarındaki uydurma istatistik/yorum kalıbı bilinçli olarak alınmadı:
// burada yalnız bugün gerçekten yaptığımız şeyler yazılır.
const btn =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-5 py-2.5 font-body text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2";
const container = "mx-auto w-full max-w-6xl px-4 md:px-6";
const eyebrow =
  "inline-flex items-center rounded-full bg-panel-accent-soft px-2.5 py-1 font-body text-[0.6875rem] font-semibold tracking-[0.08em] text-terracotta-700 uppercase";
const sectionTitle = "font-display text-[1.75rem] leading-tight tracking-[-0.02em] md:text-[2.5rem]";

const reasons: { title: string; body: string }[] = [
  {
    title: "Gerçek mekân, gerçek görüntü",
    body: "Video sizin çektiğiniz fotoğraf ya da videodan, istenirse yerinde çekimden hazırlanır. Alıcı gördüğü evi gezer; benzer bir evi ya da canlandırmayı değil.",
  },
  {
    title: "Editör eliyle kurgu",
    body: "Her videoyu bir editör hazırlar ve teslimden önce kontrol eder. Dağınık ya da yanıltıcı kareler videoya girmez.",
  },
  {
    title: "Uydurma yok",
    body: "Fiyat, metrekare, kat ya da oda bilgisi yalnız sizin verdiğiniz bilgilerden yazılır. Görüntüde olmayan bir şey eklenmez.",
  },
  {
    title: "Türkçe seslendirme ve altyazı",
    body: "Ev oda oda anlatılır; mutfaktan söz edilirken ekranda mutfak vardır. Sesi kapalı izleyen de altyazıdan anlar.",
  },
  {
    title: "Paylaşmaya hazır dikey format",
    body: "Instagram Reels, TikTok ve WhatsApp Durum için 9:16. Videoyu indirip doğrudan paylaşırsınız.",
  },
  {
    title: "İlan akışı ve video aynı yerde",
    body: "WhatsApp gruplarınızdaki ilanları süzdüğünüz panelden videonuzu da sipariş eder, teslim alırsınız.",
  },
];

const comparison: { row: string; them: string; us: string }[] = [
  { row: "Görüntü", them: "Ekip randevuyla gelir", us: "Fotoğraf ya da videonuz yeterli; isterseniz yerinde çekim" },
  { row: "Kurgu", them: "Çoğu zaman ayrıca ücretlendirilir", us: "Fiyata dahil, editör hazırlar" },
  { row: "Seslendirme ve altyazı", them: "Ayrıca yaptırılır", us: "Videoya dahil" },
  { row: "Format", them: "Genelde yatay", us: "Sosyal medya için dikey 9:16" },
  { row: "Fiyat", them: "İşe göre değişir", us: "750 TL sabit; yerinde çekimde teklif" },
  { row: "İlan takibi", them: "Yok", us: "WhatsApp ilan akışı aynı panelde" },
];

export default function WhyUsPage() {
  return (
    <main className="flex-1 bg-cream-50 text-ink-900">
      <header className="border-b border-panel-line bg-gradient-to-b from-panel-muted/60 to-cream-50">
        <div className={`${container} panel-enter pt-10 pb-8 md:pt-14 md:pb-12`}>
          <span className={eyebrow}>Neden biz?</span>
          <h1 className="mt-3 max-w-3xl font-display text-[2rem] leading-tight tracking-[-0.02em] md:text-5xl">
            İlanınız, <em className="font-display text-terracotta-600 italic">gerçek haliyle</em> anlatılsın.
          </h1>
          <p className="mt-3 max-w-xl font-body text-sm text-charcoal/75 md:text-base">
            Gerçek görüntü, editör kurgusu ve Türkçe seslendirme. İlan akışınızla aynı panelde.
          </p>
        </div>
      </header>

      <section aria-labelledby="reasons">
        <div className={`${container} py-14 md:py-20`}>
          <h2 id="reasons" className="sr-only">
            Bizi seçmeniz için nedenler
          </h2>
          <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {reasons.map((r, i) => (
              <li
                key={r.title}
                className="flex flex-col gap-3 rounded-xl border border-panel-line bg-panel-surface p-5 shadow-[0_4px_16px_rgb(38_51_45/5%)] md:p-6"
              >
                <span className="font-display text-2xl text-panel-line-strong tabular-nums">0{i + 1}</span>
                <h3 className="font-display text-xl tracking-[-0.01em]">{r.title}</h3>
                <p className="font-body text-sm text-charcoal/75">{r.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section aria-labelledby="compare" className="bg-panel-muted/60">
        <div className={`${container} py-14 md:py-20`}>
          <span className={eyebrow}>Karşılaştırma</span>
          <h2 id="compare" className={`${sectionTitle} mt-3`}>
            Çekim ekibi mi, biz mi?
          </h2>
          <p className="mt-2 max-w-xl font-body text-sm text-charcoal/75">
            Profesyonel çekim güzeldir ama her ilan için pratik değildir.
          </p>

          <div className="mt-8 overflow-hidden rounded-xl border border-panel-line bg-panel-surface">
            <table className="w-full border-collapse text-left font-body text-sm">
              <thead className="bg-panel-muted">
                <tr>
                  <th scope="col" className="w-1/4 px-4 py-3 font-semibold">
                    <span className="sr-only">Konu</span>
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold text-charcoal/70">
                    Çekim ekibi
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold text-terracotta-700">
                    Biz
                  </th>
                </tr>
              </thead>
              <tbody>
                {comparison.map((c) => (
                  <tr key={c.row} className="border-t border-panel-line align-top">
                    <th scope="row" className="px-4 py-3 font-display text-base font-normal">
                      {c.row}
                    </th>
                    <td className="px-4 py-3 text-charcoal/70">{c.them}</td>
                    <td className="px-4 py-3 font-medium">{c.us}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="bg-panel-deep text-cream-50">
        <div
          className={`${container} flex flex-col items-start justify-between gap-6 py-14 md:flex-row md:items-center md:py-16`}
        >
          <h2 className={sectionTitle}>
            İlk videonuzu <em className="font-display italic">görün</em>.
          </h2>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/agent/videos/new"
              className={`${btn} bg-cream-50 text-ink-900 hover:bg-panel-surface focus-visible:outline-cream-50`}
            >
              Video siparişi ver
            </Link>
            <Link
              href="/vitrin"
              className={`${btn} border border-cream-50/40 text-cream-50 hover:bg-cream-50/10 focus-visible:outline-cream-50`}
            >
              Vitrini gez
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
