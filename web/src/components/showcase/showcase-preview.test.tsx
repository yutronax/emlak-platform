// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { showcaseList } from "@/app/(marketing)/vitrin/actions";

import { ShowcasePreview } from "./showcase-preview";

vi.mock("next/server", () => ({ connection: vi.fn(async () => {}) }));
vi.mock("@/app/(marketing)/vitrin/actions", () => ({ showcaseList: vi.fn() }));

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
});

describe("ShowcasePreview (ana sayfa)", () => {
  it("vitrin boşsa ya da yüklenemezse hiçbir şey göstermez", async () => {
    vi.stubEnv("NEXT_PUBLIC_SHOWCASE_MOCK", "");
    vi.mocked(showcaseList).mockResolvedValueOnce({ status: "ok", items: [], nextCursor: null, total: 0 });
    expect(await ShowcasePreview()).toBeNull();
    vi.mocked(showcaseList).mockRejectedValueOnce(new Error("db"));
    expect(await ShowcasePreview()).toBeNull();
  });

  it("en yeni 3 ilanı ve vitrin bağlantısını gösterir", async () => {
    vi.stubEnv("NEXT_PUBLIC_SHOWCASE_MOCK", "1");
    render((await ShowcasePreview())!);

    expect(screen.getByRole("heading", { name: "Vitrinde yayında" })).toBeInTheDocument();
    expect(screen.getAllByRole("article")).toHaveLength(3);
    expect(screen.getByRole("link", { name: "Tüm vitrin →" })).toHaveAttribute("href", "/vitrin");
  });
});
