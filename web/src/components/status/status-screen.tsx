import type { ReactNode, Ref } from "react";

import { brandTexture } from "@/components/auth/auth-shell";

type StatusScreenProps = {
  // Arka planda soluk büyük metin ("404", "!"): yalnız dekor.
  mark: string;
  eyebrow: string;
  title: string;
  children: ReactNode;
  actions: ReactNode;
  headingRef?: Ref<HTMLHeadingElement>;
};

export const primaryAction =
  "inline-flex items-center justify-center rounded-leaf bg-cream-50 px-5 py-3 font-medium text-ink-900 hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cream-50";
export const secondaryAction =
  "inline-flex items-center justify-center rounded-leaf border border-fog-50/40 px-5 py-2.5 font-medium text-fog-50 hover:bg-fog-50/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fog-50";

// 404 ve hata ekranları için marka sahnesi (giriş/kayıt ile aynı dil). Hook yok: sunucu ve client'ta kullanılır.
export function StatusScreen({ mark, eyebrow, title, children, actions, headingRef }: StatusScreenProps) {
  return (
    <main className="relative isolate flex flex-1 overflow-hidden bg-ink-900 text-fog-50">
      <div data-status-decor aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 select-none">
        <div className="absolute inset-0" style={brandTexture} />
        <span className="absolute -right-6 -bottom-[0.2em] font-display font-light leading-none tracking-[-0.06em] text-fog-50/[0.06] text-[clamp(10rem,34vw,26rem)]">
          {mark}
        </span>
      </div>
      <div className="mx-auto flex w-full max-w-6xl flex-col justify-center px-4 py-16 md:px-6 md:py-24">
        <p className="font-body text-xs font-medium tracking-[0.2em] text-terracotta-600 uppercase">{eyebrow}</p>
        <h1
          ref={headingRef}
          tabIndex={headingRef ? -1 : undefined}
          className="mt-3 max-w-xl font-display text-[2rem] leading-tight font-normal tracking-[-0.03em] text-balance outline-none md:text-[2.75rem]"
        >
          {title}
        </h1>
        <div className="mt-4 max-w-lg font-body text-base text-fog-50/75">{children}</div>
        <div className="mt-8 flex flex-wrap gap-3 font-body">{actions}</div>
      </div>
    </main>
  );
}
