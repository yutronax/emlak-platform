import Link from "next/link";

import { SupportDialog } from "@/components/support-dialog";
import { SUPPORT_WHATSAPP_DISPLAY } from "@/lib/contact";

const linkClass = "text-white/80 hover:text-white";

export function SiteFooter() {
  return (
    <footer className="bg-ink-900 text-white">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-6 font-body md:px-6 text-sm">
        <div>
          İletişim:{" "}
          <SupportDialog variant="inline" label="Destek formu" className={linkClass} /> ·{" "}
          {SUPPORT_WHATSAPP_DISPLAY}
        </div>
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
