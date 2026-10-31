/**
 * Bildirim payload'ı. AC-S4: yalnız {title, body, url}; ilan başlığı, fiyat, konum
 * veya grup adı İÇERMEZ (kilitli ilan verisi + KVKK).
 */
export type PushPayload = {
  title: string;
  body: string;
  url: string;
};

export function buildPayload(newCount: number): PushPayload {
  const shown = newCount > 99 ? "99+" : String(newCount);
  return {
    title: "Yeni ilanlar",
    body: `${shown} yeni ilan geldi`,
    url: "/agent/dashboard",
  };
}
