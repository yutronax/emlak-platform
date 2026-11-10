import type { ReactNode } from "react";

import { STOCK } from "@/lib/stock-images";

type AuthShellProps = {
  // Fotoğraflı panelde (mobilde üstte) duran kısa mesaj; tek vurgu kelimesi <em className="accent">.
  eyebrow: string;
  pitch: ReactNode;
  children: ReactNode;
};

// Parsel/harita dokusu: iki ince ızgara + bir köşegen, saf CSS (img/svg yok).
// 404/hata ekranı ve vitrin başlığı da kullanır.
export const brandTexture = {
  backgroundImage: [
    "linear-gradient(to right, rgb(245 246 244 / 0.05) 1px, transparent 1px)",
    "linear-gradient(to bottom, rgb(245 246 244 / 0.05) 1px, transparent 1px)",
    "linear-gradient(135deg, transparent 49.6%, rgb(193 83 43 / 0.12) 49.8%, rgb(193 83 43 / 0.12) 50.2%, transparent 50.4%)",
  ].join(", "),
  backgroundSize: "56px 56px, 56px 56px, 448px 448px",
};

const photo = STOCK.facadeBalconies;

// Stitch "Giriş Yap & Kayıt Ol" düzeni: solda üstü terakota geçişli beyaz form kartı, sağda yuvarlak
// köşeli fotoğraf kartı (mesaj altta). Mobilde form önce gelir, fotoğraf kartı kısa bir şerit olur.
// Stitch'teki uydurma istatistik ve yorum kartları alınmadı.
// Fotoğraf süs olduğundan <img> değil, aria-hidden katmanda CSS arka planı.
export function AuthShell({ eyebrow, pitch, children }: AuthShellProps) {
  return (
    <main className="flex-1 bg-cream-50 text-ink-900">
      <div className="mx-auto grid w-full max-w-6xl gap-6 px-4 py-8 md:px-6 md:py-12 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-stretch">
        <div className="auth-card-enter relative overflow-hidden rounded-xl border border-panel-line bg-panel-surface px-5 pt-8 pb-6 shadow-[0_4px_16px_rgb(38_51_45/5%)] md:px-10 md:pt-10 md:pb-8">
          <span
            aria-hidden="true"
            className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-panel-deep via-terracotta-600 to-panel-line"
          />
          <div className="mx-auto w-full max-w-md">{children}</div>
        </div>

        <section className="relative isolate order-first flex min-h-[180px] flex-col justify-end overflow-hidden rounded-xl bg-panel-deep p-5 text-cream-50 md:p-8 lg:order-none lg:min-h-[520px]">
          <div data-auth-decor aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 select-none">
            <div
              className="absolute inset-0 bg-cover bg-center"
              style={{ backgroundImage: `url("${photo.src(1400)}")` }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-panel-deep via-panel-deep/60 to-panel-deep/10" />
          </div>
          <p className="font-body text-[0.6875rem] font-semibold tracking-[0.12em] text-cream-50/75 uppercase">
            {eyebrow}
          </p>
          <div className="mt-2 max-w-md font-display text-2xl leading-tight tracking-[-0.01em] text-balance md:text-3xl">
            {pitch}
          </div>
          <p className="mt-4 font-body text-[10px] text-cream-50/50">Fotoğraf: {photo.credit}</p>
        </section>
      </div>
    </main>
  );
}
