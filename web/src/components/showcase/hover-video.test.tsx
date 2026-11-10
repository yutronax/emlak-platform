// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { HoverVideo } from "./hover-video";

function setup(reduce = false) {
  window.matchMedia = vi.fn().mockReturnValue({ matches: reduce }) as unknown as typeof window.matchMedia;
  const { container } = render(
    <article>
      <HoverVideo src="/v.mp4" poster="/p.jpg" />
    </article>,
  );
  const card = container.querySelector("article")!;
  const video = container.querySelector("video")!;
  const play = vi.spyOn(video, "play").mockResolvedValue(undefined);
  const pause = vi.spyOn(video, "pause").mockImplementation(() => {});
  const load = vi.spyOn(video, "load").mockImplementation(() => {});
  return { card, video, play, pause, load };
}

describe("HoverVideo", () => {
  beforeEach(() => vi.restoreAllMocks());
  afterEach(() => cleanup());

  it("fare karta girince baştan oynar, çıkınca durup başa sarar", () => {
    const { card, video, play, pause, load } = setup();
    video.currentTime = 5;
    fireEvent.pointerEnter(card);
    expect(video.currentTime).toBe(0);
    expect(play).toHaveBeenCalledTimes(1);

    fireEvent.pointerLeave(card);
    expect(pause).toHaveBeenCalledTimes(1);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("klavye odağında da oynar", () => {
    const { card, play } = setup();
    fireEvent.focusIn(card);
    expect(play).toHaveBeenCalledTimes(1);
  });

  it("hareket azaltma tercihinde hiç oynamaz", () => {
    const { card, play } = setup(true);
    fireEvent.pointerEnter(card);
    expect(play).not.toHaveBeenCalled();
  });

  it("sessiz, döngülü, satır içi ve poster'lı render edilir", () => {
    const { video } = setup();
    expect(video.muted).toBe(true);
    expect(video).toHaveAttribute("loop");
    expect(video).toHaveAttribute("playsinline");
    expect(video).toHaveAttribute("poster", "/p.jpg");
  });
});
