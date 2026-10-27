import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="border-b border-mist-200 bg-fog-50 text-ink-900">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
        <Link href="/" className="font-display text-lg font-bold">
          Emlak Platformu
        </Link>
        <nav className="flex items-center gap-6 text-sm font-body">
          <Link href="/pricing" className="hover:underline">
            Fiyatlar
          </Link>
          <Link href="/login" className="hover:underline">
            Giriş
          </Link>
          <Link
            href="/signup"
            className="inline-flex items-center rounded-md bg-terracotta-600 px-4 py-2 font-medium text-white hover:bg-terracotta-700"
          >
            Kayıt Ol
          </Link>
        </nav>
      </div>
    </header>
  );
}
