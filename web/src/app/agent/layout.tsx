import type { ReactNode } from "react";
import { Lora } from "next/font/google";

import { AppShell } from "@/components/app-shell/app-shell";

// Sıcak Editorial başlık fontu yalnız panelde yüklenir; Inter kök layout'ta zaten var.
const lora = Lora({
  variable: "--font-lora",
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600"],
  display: "swap",
});

// Oturum her istekte değişebilir (admin/layout.tsx ile aynı gerekçe).
export const instant = false;

export default function AgentLayout({ children }: { children: ReactNode }) {
  return (
    <div data-panel-theme="editorial" className={`${lora.variable} flex min-h-dvh flex-1 flex-col`}>
      <AppShell>{children}</AppShell>
    </div>
  );
}
