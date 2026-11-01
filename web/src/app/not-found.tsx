import type { Metadata } from "next";
import Link from "next/link";

import { primaryAction, secondaryAction, StatusScreen } from "@/components/status/status-screen";

export const metadata: Metadata = {
  title: "Sayfa bulunamadı · Emlak Platformu",
};

// Eşleşmeyen URL'ler ve notFound() çağrıları (admin dahil) buraya düşer: metin kaynağın varlığını ima etmez.
export default function NotFound() {
  return (
    <StatusScreen
      mark="404"
      eyebrow="Hata 404"
      title="Bu sayfa bulunamadı"
      actions={
        <>
          <Link href="/" className={primaryAction}>
            Ana sayfa
          </Link>
          <Link href="/agent/dashboard" className={secondaryAction}>
            Panele git
          </Link>
        </>
      }
    >
      <p>Bağlantı eskimiş ya da adres yanlış yazılmış olabilir. Ana sayfadan veya panelden devam edebilirsiniz.</p>
    </StatusScreen>
  );
}
