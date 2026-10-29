import Link from "next/link";

// 320px'te tek satır: logo + "Giriş" metin linki + küçük "Kayıt Ol". Hamburger yok.
// "Fiyatlar" yalnız md+ ekranda görünür; mobilde sayfa içi CTA'lar yeterli.
export function SiteHeader() {
  return (
    <header className="border-b border-mist-200 bg-fog-50 text-ink-900">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-3 py-3 md:gap-4 md:px-6 md:py-3">
        <Link
          href="/"
          className="whitespace-nowrap font-display text-sm font-bold md:text-lg"
        >
          Emlak Platformu
        </Link>
        <nav className="flex items-center gap-2 font-body text-sm md:gap-6">
          <Link href="/pricing" className="hidden whitespace-nowrap hover:underline md:inline">
            Fiyatlar
          </Link>
          <Link href="/login" className="whitespace-nowrap px-1 hover:underline">
            Giriş
          </Link>
          <Link
            href="/signup"
            className="inline-flex items-center whitespace-nowrap rounded-md bg-terracotta-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-terracotta-700 md:px-4 md:py-2 md:text-sm"
          >
            Kayıt Ol
          </Link>
        </nav>
      </div>
    </header>
  );
}
