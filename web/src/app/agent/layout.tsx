import type { ReactNode } from "react";

import { AppShell } from "@/components/app-shell/app-shell";

// Oturum her istekte değişebilir (admin/layout.tsx ile aynı gerekçe).
export const instant = false;

// Sıcak Editorial tema; Lora fontu kök layout'ta yüklenir.
export default function AgentLayout({ children }: { children: ReactNode }) {
  return (
    <div data-panel-theme="editorial" className="flex min-h-dvh flex-1 flex-col">
      <AppShell>{children}</AppShell>
    </div>
  );
}
