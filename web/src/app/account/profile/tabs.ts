// Sunucu (page.tsx) ve client tarafından ortak kullanılır; "use client" modülüne konmamalı.
export const TABS = [
  { id: "sirket", label: "Şirket" },
  { id: "iletisim", label: "İletişim" },
  { id: "guvenlik", label: "Güvenlik" },
  { id: "bildirimler", label: "Bildirimler" },
] as const;

export type TabId = (typeof TABS)[number]["id"];

export const isTabId = (v: unknown): v is TabId => TABS.some((t) => t.id === v);
