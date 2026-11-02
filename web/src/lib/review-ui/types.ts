// Admin ilan kuyruğunun servisten beklediği sözleşme (admin-ilan-kuyrugu/frontend_contract.md).

export type Currency = "TRY" | "USD" | "EUR";

export type ParsedFields = {
  title: string;
  price: number | null;
  currency: Currency;
  rooms: string;
  areaM2: number | null;
  city: string;
  district: string;
  neighborhood: string;
  description: string;
};

export type ReviewItem = {
  id: string;
  rawText: string;
  sourceGroup: string | null;
  // Doluysa kişisel ilan (emlakçının kendi grubu).
  owner: { companyName: string } | null;
  score: number | null;
  createdAt: string;
  parsed: ParsedFields;
};

export type ReviewQuery = {
  q?: string;
  city?: string;
  source?: "group" | "personal";
  score?: "low" | "mid" | "high";
  order: "oldest" | "newest";
  page: number;
};

export type RejectReason = "spam" | "duplicate" | "incomplete" | "not_listing" | "other";

type ActionResult = { status: "ok" } | { status: "gone" } | { status: "error"; message?: string };

export interface ReviewService {
  kind: "mock" | "real";
  list(q: ReviewQuery): Promise<
    { status: "ok"; items: ReviewItem[]; total: number; page: number; pageSize: number } | { status: "error" }
  >;
  cities(): Promise<string[]>;
  approve(id: string, edits: Partial<ParsedFields>): Promise<ActionResult>;
  reject(id: string, reason: RejectReason, note?: string): Promise<ActionResult>;
  getThreshold(): Promise<{ value: number; failed: boolean }>;
  saveThreshold(value: number): Promise<{ ok: true } | { ok: false; error: string }>;
}
