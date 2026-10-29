import { describe, expect, it } from "vitest";

import { getCtaState } from "./cta-state";

// Sabit "şimdi": 2026-10-28 12:00 UTC.
const NOW = new Date("2026-10-28T12:00:00.000Z");
const MINUTE = 60 * 1000;
const DAY = 24 * 60 * MINUTE;

function at(offsetMs: number): string {
  return new Date(NOW.getTime() + offsetMs).toISOString();
}

const USER = { id: "user-1" };

describe("getCtaState (AC-7 fiyat CTA durumları)", () => {
  // AC-7: girişsiz -> guest (CTA "14 gün ücretsiz dene").
  it("kullanıcı yoksa kind='guest' döner", () => {
    expect(getCtaState({ user: null, subscription: null, now: NOW })).toEqual({
      kind: "guest",
    });
  });

  it("kullanıcı yokken abonelik satırı olsa bile kind='guest' döner", () => {
    expect(
      getCtaState({
        user: null,
        subscription: { status: "trialing", plan_id: "plan-start", current_period_end: at(9 * DAY) },
        now: NOW,
      }),
    ).toEqual({ kind: "guest" });
  });

  // AC-7: denemede -> trialing + kalan gün (yukarı yuvarlanır).
  it("deneme sürerken kalan gün yukarı yuvarlanır (9,5 gün -> 10)", () => {
    expect(
      getCtaState({
        user: USER,
        subscription: {
          status: "trialing",
          plan_id: "plan-start",
          current_period_end: at(9.5 * DAY),
        },
        now: NOW,
      }),
    ).toEqual({ kind: "trialing", daysLeft: 10 });
  });

  it("tam 14 gün kaldığında daysLeft=14 döner", () => {
    expect(
      getCtaState({
        user: USER,
        subscription: { status: "trialing", plan_id: "plan-start", current_period_end: at(14 * DAY) },
        now: NOW,
      }),
    ).toEqual({ kind: "trialing", daysLeft: 14 });
  });

  it("1 dakika kaldığında bile daysLeft=1 döner (yukarı yuvarlama)", () => {
    expect(
      getCtaState({
        user: USER,
        subscription: { status: "trialing", plan_id: "plan-start", current_period_end: at(1 * MINUTE) },
        now: NOW,
      }),
    ).toEqual({ kind: "trialing", daysLeft: 1 });
  });

  // AC-7: deneme bitmiş -> expired (CTA "Denemeniz bitti" + "Abone ol").
  it("current_period_end geçmişse kind='expired' döner", () => {
    expect(
      getCtaState({
        user: USER,
        subscription: { status: "trialing", plan_id: "plan-start", current_period_end: at(-1 * DAY) },
        now: NOW,
      }),
    ).toEqual({ kind: "expired" });
  });

  // AC-7: aktif abonelik -> active (CTA "Mevcut planınız").
  it("status='active' ve bitiş tarihi gelecekteyse kind='active' döner", () => {
    expect(
      getCtaState({
        user: USER,
        subscription: { status: "active", plan_id: "plan-pro", current_period_end: at(20 * DAY) },
        now: NOW,
      }),
    ).toEqual({ kind: "active" });
  });

  // Ücretli abonelik biterse "expired" değil "lapsed" (Aboneliğiniz sona erdi).
  it.each([
    { label: "canceled", status: "canceled", end: at(20 * DAY) },
    { label: "past_due", status: "past_due", end: at(20 * DAY) },
    { label: "canceled + geçmiş tarih", status: "canceled", end: at(-3 * DAY) },
    { label: "past_due + geçmiş tarih", status: "past_due", end: at(-3 * DAY) },
    { label: "active + geçmiş tarih", status: "active", end: at(-1 * DAY) },
  ])("ücretli abonelik $label ise kind='lapsed' döner (expired DEĞİL)", ({ status, end }) => {
    expect(
      getCtaState({
        user: USER,
        subscription: { status, plan_id: "plan-pro", current_period_end: end },
        now: NOW,
      }),
    ).toEqual({ kind: "lapsed" });
  });

  // Deneme bitmiş kaynağı yalnız trialing: canceled + geçmiş tarih "expired" olmaz.
  it("trialing olmayan bitmiş abonelik (canceled) 'Denemeniz bitti' (expired) durumuna düşmez", () => {
    expect(
      getCtaState({
        user: USER,
        subscription: { status: "canceled", plan_id: "plan-start", current_period_end: at(-1 * DAY) },
        now: NOW,
      }),
    ).not.toEqual({ kind: "expired" });
  });
});
