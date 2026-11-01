import type { ReactNode } from "react";

import { AppShell } from "@/components/app-shell/app-shell";

// Oturum her istekte değişebilir (admin/layout.tsx ile aynı gerekçe).
export const instant = false;

export default function AgentLayout({ children }: { children: ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
