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
  redirect: vi.fn(() => {
    throw new Error("NEXT_REDIRECT");
  }),
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));

type AgentResult = { data: { is_admin: boolean } | null; error: { message: string } | null };

function setupSupabase(userId: string | null, agentResult?: AgentResult) {
  const getUser = vi.fn().mockResolvedValue({ data: { user: userId ? { id: userId } : null } });

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

  const supabase = { auth: { getUser }, from };
  vi.mocked(createClient).mockResolvedValue(supabase as never);
  return { getUser, from };
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
});
