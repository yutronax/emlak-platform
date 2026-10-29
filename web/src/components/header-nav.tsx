"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { isActivePath } from "@/lib/nav/is-active-path";

const navText = "text-[15px] md:text-base";

// Aktif sayfa göstergesi: renk tek başına değil; kalın yazı + alt çizgi.
const activeClass = "font-semibold underline underline-offset-4 decoration-2";

// 320px'te tek satır: logo + "Giriş" metin linki + küçük "Kayıt Ol". Hamburger yok.
// "Fiyatlar" yalnız md+ ekranda görünür; mobilde sayfa içi CTA'lar yeterli.
// Client component: SSR çıktısında da render edilir, aria-current HTML'de bulunur.
export function HeaderNav() {
  const pathname = usePathname();

  const pricingActive = isActivePath(pathname, "/pricing");
  const loginActive = isActivePath(pathname, "/login");
  const signupActive = isActivePath(pathname, "/signup");

  return (
    <nav aria-label="Ana gezinme" className={`flex items-center gap-2 font-body md:gap-6 ${navText}`}>
      <Link
        href="/pricing"
        aria-current={pricingActive ? "page" : undefined}
        className={`hidden whitespace-nowrap hover:underline md:inline ${pricingActive ? activeClass : ""}`}
      >
        Fiyatlar
      </Link>

      {!loginActive && (
        <Link
          href="/login"
          className="whitespace-nowrap px-1 py-1 hover:underline"
        >
          Giriş
        </Link>
      )}

      {!signupActive && (
        <Link
          href="/signup"
          className="inline-flex items-center whitespace-nowrap rounded-md bg-terracotta-600 px-2.5 py-1.5 font-medium text-white hover:bg-terracotta-700 md:px-4 md:py-2"
        >
          Kayıt Ol
        </Link>
      )}
    </nav>
  );
}
