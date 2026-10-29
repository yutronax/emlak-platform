"use client";

import { usePathname } from "next/navigation";

import { WhatsAppButton } from "@/components/whatsapp-button";
import { SUPPORT_WHATSAPP_URL } from "@/lib/contact";

// Alt kısmında "Giriş yap / Kayıt ol" linki olan form sayfaları.
const FORM_PATHS = ["/login", "/signup", "/sifremi-unuttum", "/sifre-yenile"];

export function isFormPath(pathname: string): boolean {
  return FORM_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

// Marketing layout'tan render edilir. Form sayfalarında yüzen butonu mobilde gizler
// (sabit buton form butonlarını örtüyordu); mobilde destek erişimi akış içindeki
// metin linkiyle sağlanır. Masaüstünde yüzen buton her sayfada görünür kalır.
export function MarketingSupportButton() {
  const pathname = usePathname();
  const isForm = isFormPath(pathname);

  return (
    <>
      {isForm ? (
        <a
          href={SUPPORT_WHATSAPP_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="mx-auto block px-4 py-6 text-center text-sm text-ink-700 underline underline-offset-2 hover:text-terracotta-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-900 md:hidden"
        >
          Yardım mı lazım? WhatsApp destek
        </a>
      ) : null}
      <WhatsAppButton hideOnMobile={isForm} />
    </>
  );
}
