export const ORDER_STATUSES = [
  "draft",
  "quote_pending",
  "awaiting_payment",
  "payment_failed",
  "in_progress",
  "delivered",
  "canceled",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export type Actor = "agent" | "admin" | "system";

export const STATUS_LABELS: Record<OrderStatus, string> = {
  draft: "Dosya bekleniyor",
  quote_pending: "Fiyat teklifi bekleniyor",
  awaiting_payment: "Ödeme bekleniyor",
  payment_failed: "Ödeme alınamadı",
  in_progress: "Hazırlanıyor",
  delivered: "Teslim edildi",
  canceled: "İptal edildi",
};

type Edge = { from: OrderStatus; to: OrderStatus; actors: readonly Actor[] };

const EDGES: readonly Edge[] = [
  { from: "draft", to: "awaiting_payment", actors: ["agent"] },
  { from: "quote_pending", to: "awaiting_payment", actors: ["admin"] },
  { from: "quote_pending", to: "canceled", actors: ["admin"] },
  { from: "awaiting_payment", to: "in_progress", actors: ["system"] },
  { from: "awaiting_payment", to: "payment_failed", actors: ["system"] },
  { from: "payment_failed", to: "in_progress", actors: ["system"] },
  { from: "in_progress", to: "delivered", actors: ["admin"] },
];

export function canTransition(from: OrderStatus, to: OrderStatus, actor: Actor): boolean {
  return EDGES.some((edge) => edge.from === from && edge.to === to && edge.actors.includes(actor));
}
