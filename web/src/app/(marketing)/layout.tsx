import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { MarketingSupportButton } from "@/components/marketing-support-button";

// Mobilde sabit destek butonu (48px + bottom-4) içerikle kesişmesin diye alt boşluk.
// Tanıtım sayfaları da panelle aynı Sıcak Editorial temayı kullanır (Stitch tasarımı, 2026-11-11).
export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      data-panel-theme="editorial"
      className="flex flex-1 flex-col pb-[calc(72px+env(safe-area-inset-bottom))] md:pb-0"
    >
      <SiteHeader />
      {children}
      <SiteFooter />
      <MarketingSupportButton />
    </div>
  );
}
