import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Emlak Platformu",
  description:
    "WhatsApp'tan toplanan emlak ilanlarını videolu vitrine dönüştüren abonelik platformu.",
  manifest: "/manifest.webmanifest",
};

// Fontlar self-host edilir (public/fonts, src/app/fonts.css); next/font/google kullanılmaz,
// böylece üretim derlemesi Google Fonts erişimine bağlı değildir (bulgu 4).
export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="tr" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
