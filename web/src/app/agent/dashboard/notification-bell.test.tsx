// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { markListingsSeen, refreshUnreadCount } from "./actions";
import { NotificationBell } from "./notification-bell";

// Server action'lar test ortamında gerçek DB'ye gitmesin; çağrılar assert edilir.
vi.mock("./actions", () => ({
  markListingsSeen: vi.fn(),
  refreshUnreadCount: vi.fn(),
}));

const POLL_MS = 60_000;

function setVisibility(state: "visible" | "hidden") {
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    get: () => state,
  });
}

// Props sözleşmesi: initialCount (sunucudan gelen ilk sayaç, number).
function renderBell(initialCount: number) {
  return render(<NotificationBell initialCount={initialCount} />);
}

describe("NotificationBell — rozet gösterimi (AC-13, AC-10 benzeri)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setVisibility("visible");
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("N > 0 iken rozet 'N' metni ve 'N yeni ilan' aria-label'ı ile görünür (AC-13, 9a)", () => {
    renderBell(3);

    expect(screen.getByLabelText("3 yeni ilan")).toBeInTheDocument();
    expect(screen.getByText("3", { exact: true })).toBeInTheDocument();
  });

  it("N = 0 iken rozet yoktur (9b)", () => {
    renderBell(0);

    expect(screen.queryByLabelText(/yeni ilan/)).toBeNull();
  });

  it("N = 100 iken '99+' gösterilir (9c)", () => {
    renderBell(100);

    expect(screen.getByLabelText("99+ yeni ilan")).toBeInTheDocument();
    expect(screen.getByText("99+", { exact: true })).toBeInTheDocument();
  });

  it("N = 99 iken '99' gösterilir (sınır değer)", () => {
    renderBell(99);

    expect(screen.getByLabelText("99 yeni ilan")).toBeInTheDocument();
    expect(screen.getByText("99", { exact: true })).toBeInTheDocument();
  });

  it("sayfa açılışı tek başına 'görüldü' sayılmaz: markListingsSeen mount'ta çağrılmaz (AC-14)", () => {
    renderBell(5);

    expect(markListingsSeen).not.toHaveBeenCalled();
  });
});

describe("NotificationBell — 60 sn polling (AC-15)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    setVisibility("visible");
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("görünürken 60000 ms'de bir refreshUnreadCount çağrılır", async () => {
    vi.mocked(refreshUnreadCount).mockResolvedValue({ ok: true, count: 3 });
    renderBell(3);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(POLL_MS - 1);
    });
    expect(refreshUnreadCount).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(refreshUnreadCount).toHaveBeenCalledTimes(1);
  });

  it("polling sonucu ile rozet güncellenir", async () => {
    vi.mocked(refreshUnreadCount).mockResolvedValue({ ok: true, count: 5 });
    renderBell(3);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(POLL_MS);
    });

    expect(screen.getByLabelText("5 yeni ilan")).toBeInTheDocument();
  });

  it("sekme gizliyken (visibilityState='hidden') polling çağrısı yapılmaz", async () => {
    vi.mocked(refreshUnreadCount).mockResolvedValue({ ok: true, count: 3 });
    setVisibility("hidden");
    renderBell(3);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(POLL_MS * 3);
    });

    expect(refreshUnreadCount).not.toHaveBeenCalled();
  });

  it("polling {ok:false} dönerse son değer korunur", async () => {
    vi.mocked(refreshUnreadCount).mockResolvedValue({ ok: false });
    renderBell(3);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(POLL_MS);
    });

    expect(screen.getByLabelText("3 yeni ilan")).toBeInTheDocument();
  });

  it("polling istisna fırlatırsa (timeout) son değer korunur ve arayüz bozulmaz", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(refreshUnreadCount).mockRejectedValue(new Error("timeout"));
    renderBell(3);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(POLL_MS);
    });

    expect(screen.getByLabelText("3 yeni ilan")).toBeInTheDocument();
  });
});

describe("NotificationBell — tıklama ile görüldü (AC-14, AC-17)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setVisibility("visible");
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("tıklanınca markListingsSeen çağrılır; ok:true ise rozet kaybolur", async () => {
    vi.mocked(markListingsSeen).mockResolvedValue({ ok: true });
    renderBell(3);

    await act(async () => {
      fireEvent.click(screen.getByLabelText("3 yeni ilan"));
    });

    expect(markListingsSeen).toHaveBeenCalledTimes(1);
    expect(screen.queryByLabelText(/yeni ilan/)).toBeNull();
  });

  it("markListingsSeen ok:false dönerse rozet kalır", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(markListingsSeen).mockResolvedValue({ ok: false });
    renderBell(3);

    await act(async () => {
      fireEvent.click(screen.getByLabelText("3 yeni ilan"));
    });

    expect(markListingsSeen).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText("3 yeni ilan")).toBeInTheDocument();
  });
});
