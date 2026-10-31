// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render } from "@testing-library/react";
import { notFound, redirect } from "next/navigation";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createClient } from "@/lib/supabase/server";
import { getMyWaStatus } from "@/lib/whatsapp/status";

import Page from "./page";
import { WaPanel } from "./wa-panel";

// EML-106 / AC-11: NEXT_PUBLIC_WA_LINK_ENABLED yoksa sayfa gizli (notFound).
// Oturum yoksa /login'e yönlendirilir.

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/lib/whatsapp/status", () => ({
  getMyWaStatus: vi.fn(),
}));

// Gerçek Next.js'te notFound/redirect fırlatır; mock bunu simüle eder.
vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
  redirect: vi.fn(() => {
    throw new Error("NEXT_REDIRECT");
  }),
}));

// Panel ayrı test dosyasında ayrıntılı test edilir; burada yalnız props'a bakılır.
vi.mock("./wa-panel", () => ({
  WaPanel: vi.fn(() => null),
}));

const PHONE = "+90 5** *** **12";
const CHAIN_METHODS = ["select", "eq", "maybeSingle", "single", "order", "limit"] as const;

type QueryResult = { data: unknown; error: null };

// agents tablosu sorgusu (wa_consent_accepted_at okunur); zincirlenebilir taklit.
function makeQuery(result: QueryResult) {
  const query: Record<string, unknown> = {};
  for (const method of CHAIN_METHODS) {
    query[method] = vi.fn(() => query);
  }
  query.then = (
    resolve: (value: QueryResult) => unknown,
    reject: (reason: unknown) => unknown,
  ) => Promise.resolve(result).then(resolve, reject);
  return query;
}

function setupSession({
  user = { id: "agent-A" } as { id: string } | null,
  consentAt = "2026-10-30T10:00:00.000Z" as string | null,
} = {}) {
  const supabase = {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }),
    },
    from: vi.fn(() =>
      makeQuery({
        data: { wa_consent_accepted_at: consentAt },
        error: null,
      }),
    ),
  };
  vi.mocked(createClient).mockResolvedValue(supabase as never);
  return supabase;
}

beforeEach(() => {
  delete process.env.NEXT_PUBLIC_WA_LINK_ENABLED;
  vi.clearAllMocks();
  vi.mocked(getMyWaStatus).mockResolvedValue({
    ok: true,
    status: "connected",
    phone_masked: PHONE,
  } as never);
});

afterEach(() => {
  vi.unstubAllEnvs();
  delete process.env.NEXT_PUBLIC_WA_LINK_ENABLED;
});

describe("/agent/whatsapp sayfası — özellik bayrağı (AC-11)", () => {
  it("NEXT_PUBLIC_WA_LINK_ENABLED yoksa notFound çağrılır ve panel render edilmez", async () => {
    setupSession();

    await expect(Page()).rejects.toThrow("NEXT_NOT_FOUND");

    expect(notFound).toHaveBeenCalledTimes(1);
    expect(getMyWaStatus).not.toHaveBeenCalled();
    expect(WaPanel).not.toHaveBeenCalled();
  });
});

describe("/agent/whatsapp sayfası — oturum (AC-1, AC-9)", () => {
  it("oturum yoksa /login'e redirect edilir", async () => {
    vi.stubEnv("NEXT_PUBLIC_WA_LINK_ENABLED", "1");
    setupSession({ user: null });

    await expect(Page()).rejects.toThrow("NEXT_REDIRECT");

    expect(redirect).toHaveBeenCalledWith("/login");
    expect(getMyWaStatus).not.toHaveBeenCalled();
  });
});

describe("/agent/whatsapp sayfası — başlangıç durumu (AC-2, AC-1)", () => {
  it("bayrak açık ve oturum varsa WaPanel'e başlangıç durumu ve consentAccepted geçer", async () => {
    vi.stubEnv("NEXT_PUBLIC_WA_LINK_ENABLED", "1");
    setupSession({ consentAt: "2026-10-30T10:00:00.000Z" });

    render(await Page());

    expect(getMyWaStatus).toHaveBeenCalledTimes(1);
    expect(WaPanel).toHaveBeenCalled();
    const props = vi.mocked(WaPanel).mock.calls[0][0];
    expect(props.initialStatus).toMatchObject({
      status: "connected",
      phone_masked: PHONE,
    });
    expect(props.consentAccepted).toBe(true);
  });

  it("onay kaydı yoksa consentAccepted false geçer", async () => {
    vi.stubEnv("NEXT_PUBLIC_WA_LINK_ENABLED", "1");
    setupSession({ consentAt: null });

    render(await Page());

    const props = vi.mocked(WaPanel).mock.calls[0][0];
    expect(props.consentAccepted).toBe(false);
  });
});
