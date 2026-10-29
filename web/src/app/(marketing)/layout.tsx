import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { MarketingSupportButton } from "@/components/marketing-support-button";

// Mobilde sabit destek butonu (48px + bottom-4) içerikle kesişmesin diye alt boşluk.
export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col pb-[calc(72px+env(safe-area-inset-bottom))] md:pb-0">
      <SiteHeader />
      {children}
      <SiteFooter />
      <MarketingSupportButton />
    </div>
  );
}
