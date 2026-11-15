// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";

import AdminLayout from "./layout";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
  createServiceRoleClient: vi.fn(),
}));

type HeartbeatResult = { data: { last_beat_at: string | null } | null; error: { message: string } | null };

// sidecar_heartbeat okuması (servis rolü). Varsayılan: 1 dk önce sinyal, uyarı yok.
function setupHeartbeat(result: HeartbeatResult) {
  const chain: Record<string, unknown> = {};
  chain.select = vi.fn(() => chain);
  chain.eq = vi.fn(() => chain);
  chain.maybeSingle = vi.fn().mockResolvedValue(result);
  const from = vi.fn((table: string) => {
    if (table !== "sidecar_heartbeat") throw new Error(`Beklenmeyen tablo: ${table}`);
    return chain;
  });
  vi.mocked(createServiceRoleClient).mockReturnValue({ from } as never);
  return { from };
}

const minutesAgo = (m: number) => new Date(Date.now() - m * 60000).toISOString();

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
    setupHeartbeat({ data: { last_beat_at: minutesAgo(1) }, error: null });
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

  // Bulgu 4: köprü heartbeat'i bayatsa admin uyarılır.
  describe("scraper heartbeat uyarısı", () => {
    const renderAdmin = async () => {
      setupSupabase("user-1", { data: { is_admin: true }, error: null }, AAL2);
      render(await AdminLayout({ children: <div>gizli içerik</div> }));
    };

    it("sinyal 1 dk önceyse uyarı gösterilmez", async () => {
      await renderAdmin();
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
      expect(screen.getByText("gizli içerik")).toBeInTheDocument();
    });

    it("sinyal 12 dk önceyse dakika ile uyarı gösterilir", async () => {
      setupHeartbeat({ data: { last_beat_at: minutesAgo(12) }, error: null });
      await renderAdmin();
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Scraper 12 dakikadır sinyal göndermiyor; WhatsApp köprüsü çalışmıyor olabilir.",
      );
    });

    it("hiç sinyal yoksa (last_beat_at null) uyarı gösterilir", async () => {
      setupHeartbeat({ data: { last_beat_at: null }, error: null });
      await renderAdmin();
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Scraper hiç sinyal göndermedi; WhatsApp köprüsü çalışmıyor olabilir.",
      );
    });

    it("heartbeat satırı yoksa uyarı gösterilir", async () => {
      setupHeartbeat({ data: null, error: null });
      await renderAdmin();
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Scraper hiç sinyal göndermedi; WhatsApp köprüsü çalışmıyor olabilir.",
      );
    });

    it("okuma hata dönerse 'okunamadı' uyarısı gösterilir, sayfa yine açılır", async () => {
      setupHeartbeat({ data: null, error: { message: "boom" } });
      await renderAdmin();
      expect(screen.getByRole("alert")).toHaveTextContent("Scraper durumu okunamadı.");
      expect(screen.getByText("gizli içerik")).toBeInTheDocument();
    });

    it("istemci oluşturma fırlatırsa 'okunamadı' uyarısı gösterilir", async () => {
      vi.mocked(createServiceRoleClient).mockImplementation(() => {
        throw new Error("env yok");
      });
      await renderAdmin();
      expect(screen.getByRole("alert")).toHaveTextContent("Scraper durumu okunamadı.");
    });

    it("admin olmayan kullanıcı için heartbeat okunmaz", async () => {
      const { from } = setupHeartbeat({ data: { last_beat_at: minutesAgo(1) }, error: null });
      setupSupabase("user-1", { data: { is_admin: false }, error: null });
      await expect(AdminLayout({ children: <div /> })).rejects.toThrow("NEXT_NOT_FOUND");
      expect(from).not.toHaveBeenCalled();
    });
  });
});
