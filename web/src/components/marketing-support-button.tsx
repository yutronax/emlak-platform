"use client";

import { usePathname } from "next/navigation";

import { SupportDialog } from "@/components/support-dialog";

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

  return <SupportDialog hideOnMobile={isForm} />;
}
