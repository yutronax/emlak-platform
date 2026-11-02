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

// Stellar tarzı bölünmüş düzen: solda tam boy fotoğraf + mesaj, sağda krem zeminde form.
// Fotoğraf süs olduğundan <img> değil, aria-hidden katmanda CSS arka planı.
export function AuthShell({ eyebrow, pitch, children }: AuthShellProps) {
  return (
    <main className="grid flex-1 bg-cream-50 text-charcoal lg:min-h-[calc(100svh-57px)] lg:grid-cols-2">
      <section className="relative isolate flex min-h-[240px] flex-col justify-end overflow-hidden bg-ink-900 px-4 pt-16 pb-6 text-cream-50 md:px-10 md:pb-10 lg:min-h-0">
        <div data-auth-decor aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 select-none">
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url("${photo.src(1400)}")` }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-ink-900 via-ink-900/70 to-ink-900/25" />
        </div>
        <p className="font-body text-xs font-medium tracking-[0.2em] text-cream-50/70 uppercase">{eyebrow}</p>
        <div className="mt-3 max-w-xl font-display text-[2rem] leading-[1.02] font-light tracking-[-0.04em] text-balance md:text-5xl lg:text-6xl">
          {pitch}
        </div>
        <p className="mt-6 font-body text-[10px] text-cream-50/50">Fotoğraf: {photo.credit}</p>
      </section>

      <div className="flex justify-center px-4 py-10 md:px-10 md:py-14 lg:items-center">
        <div className="auth-card-enter w-full max-w-md">{children}</div>
      </div>
    </main>
  );
}
