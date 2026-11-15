// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";

import AdminLayout from "./layout";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("next/server", () => ({
  connection: vi.fn(async () => undefined),
}));

vi.mock("next/navigation", () => ({
  // Layout artık AppHeader'ı (client) render ediyor.
  usePathname: () => "/admin/listings",
  redirect: vi.fn(() => {
    throw new Error("NEXT_REDIRECT");
  }),
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));

type AgentResult = { data: { is_admin: boolean } | null; error: { message: string } | null };
type AalResult = {
  data: { currentLevel: string | null; nextLevel: string | null } | null;
  error: { message: string } | null;
};

const AAL2: AalResult = { data: { currentLevel: "aal2", nextLevel: "aal2" }, error: null };
const AAL1: AalResult = { data: { currentLevel: "aal1", nextLevel: "aal2" }, error: null };

function setupSupabase(userId: string | null, agentResult?: AgentResult, aal: AalResult = AAL2) {
  const getUser = vi.fn().mockResolvedValue({ data: { user: userId ? { id: userId } : null } });
  const getAuthenticatorAssuranceLevel = vi.fn().mockResolvedValue(aal);

  let maybeSingle: ReturnType<typeof vi.fn> | undefined;
  let agentsChain: Record<string, unknown> | undefined;
  const from = vi.fn((table: string) => {
    if (table === "agents" && agentsChain) return agentsChain;
    throw new Error(`Beklenmeyen tablo: ${table}`);
  });

  if (agentResult) {
    maybeSingle = vi.fn().mockResolvedValue(agentResult);
    agentsChain = {};
    agentsChain.select = vi.fn(() => agentsChain);
    agentsChain.eq = vi.fn(() => agentsChain);
    agentsChain.maybeSingle = maybeSingle;
  }

  const supabase = { auth: { getUser, mfa: { getAuthenticatorAssuranceLevel } }, from };
  vi.mocked(createClient).mockResolvedValue(supabase as never);
  return { getUser, from, getAuthenticatorAssuranceLevel };
}

describe("AdminLayout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("oturum yoksa redirect('/login') çağrılır ve agents sorgusu yapılmaz", async () => {
    const { from } = setupSupabase(null);

    await expect(AdminLayout({ children: <div>gizli içerik</div> })).rejects.toThrow(
      "NEXT_REDIRECT",
    );

    expect(redirect).toHaveBeenCalledWith("/login");
    expect(notFound).not.toHaveBeenCalled();
    expect(from).not.toHaveBeenCalled();
  });

  it("oturum var ama agents.is_admin=false ise notFound() çağrılır (redirect değil)", async () => {
    setupSupabase("user-1", { data: { is_admin: false }, error: null });

    await expect(AdminLayout({ children: <div>gizli içerik</div> })).rejects.toThrow(
      "NEXT_NOT_FOUND",
    );

    expect(notFound).toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalled();
  });

  it("agents satırı yoksa (data:null) notFound() çağrılır", async () => {
    setupSupabase("user-1", { data: null, error: null });

    await expect(AdminLayout({ children: <div>gizli içerik</div> })).rejects.toThrow(
      "NEXT_NOT_FOUND",
    );

    expect(notFound).toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalled();
  });

  it("agents.is_admin=true ise children render edilir, notFound/redirect çağrılmaz", async () => {
    setupSupabase("user-1", { data: { is_admin: true }, error: null });

    const jsx = await AdminLayout({ children: <div>gizli içerik</div> });
    render(jsx);

    expect(notFound).not.toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalled();
    expect(screen.getByText("gizli içerik")).toBeInTheDocument();
  });

  // AC-2: admin ama aal1 -> /mfa'ya yönlendirilir, içerik render edilmez.
  it("AC-2: admin ama aal1 ise redirect('/mfa') çağrılır ve children render edilmez", async () => {
    const { getAuthenticatorAssuranceLevel } = setupSupabase(
      "user-1",
      { data: { is_admin: true }, error: null },
      AAL1,
    );

    await expect(AdminLayout({ children: <div>gizli içerik</div> })).rejects.toThrow(
      "NEXT_REDIRECT",
    );

    expect(getAuthenticatorAssuranceLevel).toHaveBeenCalled();
    expect(redirect).toHaveBeenCalledWith("/mfa");
    expect(notFound).not.toHaveBeenCalled();
  });

  // AC-2: admin + aal2 -> sayfa açılır.
  it("AC-2: admin + aal2 ise children render edilir, redirect/notFound çağrılmaz", async () => {
    setupSupabase("user-1", { data: { is_admin: true }, error: null }, AAL2);

    const jsx = await AdminLayout({ children: <div>gizli içerik</div> });
    render(jsx);

    expect(screen.getByText("gizli içerik")).toBeInTheDocument();
    expect(redirect).not.toHaveBeenCalled();
    expect(notFound).not.toHaveBeenCalled();
  });

  // AC-2 / kapalı-varsayılan: AAL okunamazsa admin /mfa'ya gider.
  it("AC-2: admin ama AAL sorgusu hata dönerse redirect('/mfa') çağrılır", async () => {
    setupSupabase(
      "user-1",
      { data: { is_admin: true }, error: null },
      { data: null, error: { message: "mfa service unavailable" } },
    );

    await expect(AdminLayout({ children: <div>gizli içerik</div> })).rejects.toThrow(
      "NEXT_REDIRECT",
    );

    expect(redirect).toHaveBeenCalledWith("/mfa");
  });

  // AC-2: admin değilse MFA kapısı değil, mevcut notFound() davranışı geçerlidir.
  it("AC-2: admin olmayan aal1 kullanıcıda notFound() çağrılır, /mfa'ya yönlendirilmez", async () => {
    setupSupabase("user-1", { data: { is_admin: false }, error: null }, AAL1);

    await expect(AdminLayout({ children: <div>gizli içerik</div> })).rejects.toThrow(
      "NEXT_NOT_FOUND",
    );

    expect(notFound).toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalledWith("/mfa");
  });
});
