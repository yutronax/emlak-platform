// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ShowcasePreview } from "./showcase-preview";

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
});

describe("ShowcasePreview (ana sayfa)", () => {
  it("servis yoksa hiçbir şey göstermez", async () => {
    vi.stubEnv("NEXT_PUBLIC_SHOWCASE_MOCK", "");
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
