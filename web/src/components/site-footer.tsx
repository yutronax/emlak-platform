import Link from "next/link";

import { SUPPORT_WHATSAPP_DISPLAY, SUPPORT_WHATSAPP_URL } from "@/lib/contact";

const linkClass = "text-white/80 hover:text-white";

export function SiteFooter() {
  return (
    <footer className="bg-ink-900 text-white">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-6 py-6 font-body text-sm">
        <p>
          İletişim WhatsApp:{" "}
          <a
            href={SUPPORT_WHATSAPP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className={linkClass}
          >
            {SUPPORT_WHATSAPP_DISPLAY}
          </a>
        </p>
        <nav className="flex flex-wrap gap-x-6 gap-y-2">
          <Link href="/gizlilik" className={linkClass}>
            Gizlilik Politikası
          </Link>
          <Link href="/kvkk" className={linkClass}>
            KVKK Aydınlatma Metni
          </Link>
          <Link href="/kullanim-sartlari" className={linkClass}>
            Kullanım Şartları
          </Link>
        </nav>
        <p className="text-white/70">© 2026 Emlak Platformu</p>
      </div>
    </footer>
  );
}
