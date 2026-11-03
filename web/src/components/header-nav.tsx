"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { isActivePath } from "@/lib/nav/is-active-path";
import { createClient } from "@/lib/supabase/client";

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

  // Tanıtım sayfaları statik kalır; oturum tarayıcıda yerel çerezden okunur (ağ isteği yok).
  // Girişliyken "Giriş / Kayıt Ol" yerine panele dönüş gösterilir — aksi halde logoya
  // tıklayan emlakçı oturumu kapanmış sanıyor.
  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => {
    let alive = true;
    try {
      createClient()
        .auth.getSession()
        .then(({ data }) => {
          if (alive) setSignedIn(Boolean(data.session));
        })
        .catch(() => {});
    } catch {
      // Supabase ortam değişkenleri yoksa (ör. test) misafir menüsü kalır.
    }
    return () => {
      alive = false;
    };
  }, []);

  if (signedIn) {
    return (
      <nav aria-label="Ana gezinme" className={`flex items-center gap-2 font-body md:gap-6 ${navText}`}>
        <Link
          href="/pricing"
          aria-current={pricingActive ? "page" : undefined}
          className={`hidden whitespace-nowrap hover:underline md:inline ${pricingActive ? activeClass : ""}`}
        >
          Fiyatlar
        </Link>
        <Link
          href="/agent/dashboard"
          className="inline-flex items-center whitespace-nowrap rounded-leaf bg-ink-900 px-2.5 py-1.5 font-medium text-white hover:bg-ink-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta-600 md:px-4 md:py-2"
        >
          Panelim
        </Link>
      </nav>
    );
  }

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
          className="inline-flex items-center whitespace-nowrap rounded-leaf bg-ink-900 px-2.5 py-1.5 font-medium text-white hover:bg-ink-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta-600 md:px-4 md:py-2"
        >
          Kayıt Ol
        </Link>
      )}
    </nav>
  );
}
