// Admin genel bakış / emlakçı yönetimi sözleşmesi (admin-genel-bakis/frontend_contract.md).

export type AgentSubStatus = "active" | "trialing" | "past_due" | "pending" | "canceled" | "none";
export type WhatsAppState = "connected" | "disconnected" | "never";

export type AgentRow = {
  id: string;
  companyName: string;
  email: string;
  subscription: { status: AgentSubStatus; planName: string | null };
  whatsapp: WhatsAppState;
  createdAt: string;
  suspended: boolean;
  isAdmin: boolean;
};

export type AgentDetail = AgentRow & {
  contactName: string | null;
  phone: string | null;
  currentPeriodEnd: string | null;
  payments: { id: string; date: string; amountMinor: number; status: "paid" | "failed" | "refunded"; description: string }[];
  groups: { name: string; listingCount: number }[];
  recentListings: { id: string; title: string; status: "pending" | "approved" | "rejected"; createdAt: string }[];
  videoOrders: { id: string; title: string; status: string; createdAt: string }[];
};

export type AgentQuery = {
  q?: string;
  // "suspended" abonelik değil hesap durumu; aynı filtrede sunulur.
  sub?: AgentSubStatus | "suspended";
  wa?: "connected" | "disconnected";
  page: number;
};

export type AdminError = { status: "error"; code?: "self"; message?: string };

export interface AdminService {
  kind: "mock" | "real";
  overview(): Promise<
    | {
        status: "ok";
        counts: { pendingListings: number; pendingVideoOrders: number; activeSubscribers: number; pastDue: number };
        recentAgents: AgentRow[];
      }
    | { status: "error" }
  >;
  listAgents(q: AgentQuery): Promise<
    { status: "ok"; items: AgentRow[]; total: number; page: number; pageSize: number } | { status: "error" }
  >;
  getAgent(id: string): Promise<{ status: "ok"; agent: AgentDetail; isSelf: boolean } | { status: "not_found" } | { status: "error" }>;
  setSuspended(id: string, suspended: boolean): Promise<{ status: "ok"; agent: AgentDetail } | AdminError>;
  setAdmin(id: string, isAdmin: boolean): Promise<{ status: "ok"; agent: AgentDetail } | AdminError>;
}
