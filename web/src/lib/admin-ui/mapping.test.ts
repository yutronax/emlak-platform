import { describe, expect, it } from "vitest";

import { filterAgents, toAgentRow, toSubStatus, toWhatsApp, type AgentRecord } from "./mapping";

const base: AgentRecord = {
  id: "a1",
  company_name: "Acme Emlak",
  created_at: "2026-11-01T09:00:00Z",
  is_admin: false,
  suspended_at: null,
  subscriptions: [],
  wa_connections: null,
};

describe("toSubStatus", () => {
  it("abonelik yoksa none; en yenisi esas alınır", () => {
    expect(toSubStatus([])).toBe("none");
    expect(
      toSubStatus([
        { status: "canceled", created_at: "2026-01-01T00:00:00Z", current_period_end: null, plans: null },
        { status: "active", created_at: "2026-10-01T00:00:00Z", current_period_end: null, plans: null },
      ]),
    ).toBe("active");
  });

  it("UI'da olmayan durumlar en yakınına eşlenir", () => {
    const sub = (status: string) => [{ status, created_at: "2026-01-01T00:00:00Z", current_period_end: null, plans: null }];
    expect(toSubStatus(sub("failed"))).toBe("past_due");
    expect(toSubStatus(sub("needs_review"))).toBe("pending");
  });
});

describe("toWhatsApp", () => {
  it("kayıt yoksa never, connected dışı her durum disconnected", () => {
    expect(toWhatsApp(null)).toBe("never");
    expect(toWhatsApp({ status: "connected" })).toBe("connected");
    expect(toWhatsApp({ status: "error" })).toBe("disconnected");
    expect(toWhatsApp([{ status: "connected" }])).toBe("connected");
  });
});

describe("toAgentRow", () => {
  it("e-posta, plan adı ve askı bilgisini taşır", () => {
    const row = toAgentRow(
      {
        ...base,
        suspended_at: "2026-11-02T00:00:00Z",
        subscriptions: [{ status: "trialing", created_at: "2026-10-01T00:00:00Z", current_period_end: null, plans: { name: "Pro" } }],
      },
      "a@acme.com",
    );
    expect(row).toEqual({
      id: "a1",
      companyName: "Acme Emlak",
      email: "a@acme.com",
      subscription: { status: "trialing", planName: "Pro" },
      whatsapp: "never",
      createdAt: "2026-11-01T09:00:00Z",
      suspended: true,
      isAdmin: false,
    });
  });
});

describe("filterAgents", () => {
  const rows = [
    toAgentRow({ ...base, id: "1", company_name: "Bodrum Mavi" }, "x@a.com"),
    toAgentRow({ ...base, id: "2", company_name: "İzmir Ev", suspended_at: "2026-11-01T00:00:00Z" }, "bodrum@b.com"),
    toAgentRow({ ...base, id: "3", company_name: "Ankara", wa_connections: { status: "connected" } }, "c@c.com"),
  ];

  it("firma adı veya e-postada Türkçe duyarlı arar", () => {
    expect(filterAgents(rows, { page: 1, q: "BODRUM" }).map((r) => r.id)).toEqual(["1", "2"]);
    expect(filterAgents(rows, { page: 1, q: "izmir" }).map((r) => r.id)).toEqual(["2"]);
  });

  it("askı ve WhatsApp filtreleri", () => {
    expect(filterAgents(rows, { page: 1, sub: "suspended" }).map((r) => r.id)).toEqual(["2"]);
    expect(filterAgents(rows, { page: 1, sub: "none" }).map((r) => r.id)).toEqual(["1", "2", "3"]);
    expect(filterAgents(rows, { page: 1, wa: "connected" }).map((r) => r.id)).toEqual(["3"]);
    expect(filterAgents(rows, { page: 1, wa: "disconnected" }).map((r) => r.id)).toEqual(["1", "2"]);
  });
});
