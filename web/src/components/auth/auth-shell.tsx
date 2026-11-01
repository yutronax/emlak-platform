import type { ReactNode } from "react";

type AuthShellProps = {
  // Koyu zeminde, kartın yanında (mobilde üstünde) duran kısa mesaj.
  eyebrow: string;
  pitch: ReactNode;
  children: ReactNode;
};

// Parsel/harita dokusu: iki ince ızgara + bir köşegen, saf CSS (img/svg yok).
const texture = {
  backgroundImage: [
    "linear-gradient(to right, rgb(245 246 244 / 0.05) 1px, transparent 1px)",
    "linear-gradient(to bottom, rgb(245 246 244 / 0.05) 1px, transparent 1px)",
    "linear-gradient(135deg, transparent 49.6%, rgb(193 83 43 / 0.12) 49.8%, rgb(193 83 43 / 0.12) 50.2%, transparent 50.4%)",
  ].join(", "),
  backgroundSize: "56px 56px, 56px 56px, 448px 448px",
};

export function AuthShell({ eyebrow, pitch, children }: AuthShellProps) {
  return (
    <main className="relative isolate overflow-hidden bg-ink-900 text-fog-50">
      <div data-auth-decor aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 select-none">
        <div className="absolute inset-0" style={texture} />
        <div className="absolute -right-8 bottom-[-0.18em] flex flex-col items-end font-display font-bold leading-[0.82] tracking-tight text-fog-50/[0.06] text-[clamp(5rem,16vw,15rem)]">
          <span>ilan.</span>
          <span>müşteri.</span>
          <span className="text-terracotta-600/20">satış.</span>
        </div>
      </div>

      <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 pt-10 pb-16 md:px-6 md:pt-16 lg:grid-cols-12 lg:gap-12 lg:pb-24">
        <div className="lg:col-span-6 lg:pt-6">
          <p className="font-body text-xs font-medium tracking-[0.2em] text-terracotta-600 uppercase">{eyebrow}</p>
          <div className="mt-3 max-w-md font-display text-[1.75rem] leading-tight font-bold text-balance lg:text-[2.5rem]">
            {pitch}
          </div>
        </div>
        <div className="auth-card-enter w-full rounded-2xl bg-fog-50 p-6 text-ink-900 shadow-[0_24px_60px_-20px_rgb(0_0_0/0.5)] sm:p-8 lg:col-span-5 lg:col-start-8">
          {children}
        </div>
      </div>
    </main>
  );
}
