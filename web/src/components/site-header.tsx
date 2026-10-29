import Link from "next/link";

import { HeaderNav } from "@/components/header-nav";

// Logo ve nav aynı sarmalayıcıyı kullanır (max-w-6xl px-4 md:px-6) → sayfa içeriğiyle hizalı.
export function SiteHeader() {
  return (
    <header className="border-b border-mist-200 bg-fog-50 text-ink-900">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-4 py-2.5 md:gap-4 md:px-6">
        <Link
          href="/"
          className="whitespace-nowrap font-display text-lg font-bold md:text-xl"
        >
          Emlak Platformu
        </Link>
        <HeaderNav />
      </div>
    </header>
  );
}
