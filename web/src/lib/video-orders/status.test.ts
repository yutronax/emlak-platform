import { describe, expect, it } from "vitest";

import { STATUS_LABELS, canTransition, type OrderStatus } from "./status";

describe("canTransition — agent (AC-S4)", () => {
  it("draft → awaiting_payment (gönder) izinli", () => {
    expect(canTransition("draft", "awaiting_payment", "agent")).toBe(true);
  });

  it.each([
    ["draft", "in_progress"],
    ["awaiting_payment", "in_progress"],
    ["quote_pending", "awaiting_payment"],
    ["in_progress", "delivered"],
    ["draft", "delivered"],
    ["payment_failed", "in_progress"],
  ] as const)("%s → %s agent tarafından YASAK", (from, to) => {
    expect(canTransition(from, to, "agent")).toBe(false);
  });
});

describe("canTransition — admin", () => {
  it("quote_pending → awaiting_payment (fiyat ver) ve quote_pending → canceled (reddet) izinli", () => {
    expect(canTransition("quote_pending", "awaiting_payment", "admin")).toBe(true);
    expect(canTransition("quote_pending", "canceled", "admin")).toBe(true);
  });

  it("in_progress → delivered izinli", () => {
    expect(canTransition("in_progress", "delivered", "admin")).toBe(true);
  });

  it("draft → in_progress ve delivered → in_progress reddedilir", () => {
    expect(canTransition("draft", "in_progress", "admin")).toBe(false);
    expect(canTransition("delivered", "in_progress", "admin")).toBe(false);
  });
});

describe("canTransition — system (ödeme webhook'u)", () => {
  it.each([
    ["awaiting_payment", "in_progress"],
    ["awaiting_payment", "payment_failed"],
    ["payment_failed", "in_progress"],
  ] as const)("%s → %s izinli", (from, to) => {
    expect(canTransition(from, to, "system")).toBe(true);
  });

  it("system teslim edemez", () => {
    expect(canTransition("in_progress", "delivered", "system")).toBe(false);
  });
});

describe("canTransition — geçersiz geçişler", () => {
  it("teslim edilmiş sipariş hiçbir aktörle geri alınamaz", () => {
    const actors = ["agent", "admin", "system"] as const;
    const targets: OrderStatus[] = ["draft", "awaiting_payment", "in_progress", "canceled"];
    for (const actor of actors) {
      for (const to of targets) {
        expect(canTransition("delivered", to, actor)).toBe(false);
      }
    }
  });
});

describe("STATUS_LABELS", () => {
  it("tüm durumların Türkçe etiketi var", () => {
    expect(STATUS_LABELS).toEqual({
      draft: "Dosya bekleniyor",
      quote_pending: "Fiyat teklifi bekleniyor",
      awaiting_payment: "Ödeme bekleniyor",
      payment_failed: "Ödeme alınamadı",
      in_progress: "Hazırlanıyor",
      delivered: "Teslim edildi",
      canceled: "İptal edildi",
    });
  });
});
