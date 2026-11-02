// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { requireAdmin } from "@/lib/auth/requireAdmin";
import { redirect } from "next/navigation";

import Page from "./page";

vi.mock("@/lib/auth/requireAdmin", () => ({ requireAdmin: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn(() => {
    throw new Error("NEXT_REDIRECT");
  }),
}));
vi.mock("./review-client", () => ({ ReviewClient: () => <p>inceleme masası</p> }));

// Kuyruk verisi, sahiplik etiketi ve eşik varsayılanı review-actions.test.ts / review-desk.test.tsx'te.
describe("AdminListingsPage", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => cleanup());

  it("AC-S2: oturum yoksa (no-session) /login'e yönlendirir", async () => {
    vi.mocked(requireAdmin).mockResolvedValue({ ok: false, reason: "no-session" });
    await expect(Page()).rejects.toThrow("NEXT_REDIRECT");
    expect(redirect).toHaveBeenCalledWith("/login");
  });

  it("AC-S2: admin değilse /agent/dashboard'a yönlendirir", async () => {
    vi.mocked(requireAdmin).mockResolvedValue({ ok: false, reason: "not-admin" });
    await expect(Page()).rejects.toThrow("NEXT_REDIRECT");
    expect(redirect).toHaveBeenCalledWith("/agent/dashboard");
  });

  it("AC-5: admin ise inceleme masası gösterilir", async () => {
    vi.mocked(requireAdmin).mockResolvedValue({ ok: true, userId: "a", supabase: {} } as never);
    render(await Page());
    expect(screen.getByText("inceleme masası")).toBeInTheDocument();
  });
});
