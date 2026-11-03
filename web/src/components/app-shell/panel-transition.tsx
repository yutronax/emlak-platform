import { ViewTransition, type ReactNode } from "react";

// Panel bölümleri arası geçiş (awwwards-karsilastirma.md §4): header yerinde kalır, yalnız içerik
// değişir. Yalnız header sekmelerinin "panel-section" tipli gezinmesinde oynar; router.refresh
// (WhatsApp poll'u), geri/ileri ve Suspense açılışları animasyonsuz kalır (default: none).
// Sayfa bileşenine konur, layout'a değil: layout gezinmelerde kalıcıdır, enter/exit tetiklenmez.
export function PanelTransition({ children }: { children: ReactNode }) {
  return (
    <ViewTransition
      enter={{ "panel-section": "panel-in", default: "none" }}
      exit={{ "panel-section": "panel-out", default: "none" }}
      default="none"
    >
      {children}
    </ViewTransition>
  );
}
