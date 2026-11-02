import { beforeEach, describe, expect, it, vi } from "vitest";

import { requireAdmin } from "@/lib/auth/requireAdmin";

import { reviewApprove, reviewGetThreshold, reviewReject, toDbEdits, toReviewItem } from "./review-actions";

vi.mock("@/lib/auth/requireAdmin", () => ({ requireAdmin: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const rpc = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.mocked(requireAdmin).mockResolvedValue({ ok: true, userId: "u", supabase: { rpc } } as never);
});

describe("toDbEdits", () => {
  it("UI alanlarını veritabanı anahtarlarına çevirir", async () => {
    expect(await toDbEdits({ title: "Yeni", areaM2: 90, price: null })).toEqual({ title: "Yeni", area_m2: 90, price: null });
  });
});

describe("toReviewItem", () => {
  it("eksik ayrıştırma alanlarını boş değere tamamlar", async () => {
    expect(
      await toReviewItem({
        id: "r1",
        raw_text: "metin",
        source_group: "G",
        quality_score: 0.4,
        created_at: "2026-11-01T00:00:00Z",
        owner_agent_id: null,
        owner: null,
        parsed: { title: "Ev", price: 100, area_m2: 80, currency: "XYZ" },
      }),
    ).toEqual({
      id: "r1",
      rawText: "metin",
      sourceGroup: "G",
      owner: null,
      score: 0.4,
      createdAt: "2026-11-01T00:00:00Z",
      parsed: {
        title: "Ev",
        price: 100,
        currency: "TRY",
        rooms: "",
        areaM2: 80,
        city: "",
        district: "",
        neighborhood: "",
        description: "",
      },
    });
  });
});

describe("AC-6 sahiplik", () => {
  it("owner_agent_id doluysa kişisel ilan, emlakçı adıyla", async () => {
    const item = await toReviewItem({
      id: "r2",
      raw_text: "",
      source_group: null,
      quality_score: null,
      created_at: "2026-11-01T00:00:00Z",
      owner_agent_id: "a1",
      owner: { company_name: "Acme Emlak" },
      parsed: null,
    });
    expect(item.owner).toEqual({ companyName: "Acme Emlak" });
  });
});

describe("AC-7 eşik", () => {
  it.each([
    [{ data: { ok: true, value: 0.85 }, error: null }, { value: 0.85, failed: false }],
    [{ data: { ok: false, error: "forbidden" }, error: null }, { value: 0.7, failed: true }],
    [{ data: { ok: true, value: "x" }, error: null }, { value: 0.7, failed: true }],
    [{ data: null, error: { message: "boom" } }, { value: 0.7, failed: true }],
  ])("RPC yanıtı %j → %j", async (reply, expected) => {
    rpc.mockResolvedValueOnce(reply);
    expect(await reviewGetThreshold()).toEqual(expected);
    expect(rpc).toHaveBeenCalledWith("admin_get_threshold");
  });
});

describe("onay/ret", () => {
  it("admin değilse RPC çağrılmaz", async () => {
    vi.mocked(requireAdmin).mockResolvedValue({ ok: false, reason: "not-admin" });
    expect(await reviewApprove("r1", {})).toEqual({ status: "error" });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("düzeltmeler snake_case ile gönderilir; gone ve invalid eşlenir", async () => {
    rpc.mockResolvedValueOnce({ data: { ok: true, id: "l1" }, error: null });
    expect(await reviewApprove("r1", { areaM2: 95 })).toEqual({ status: "ok" });
    expect(rpc).toHaveBeenCalledWith("review_approve", { p_raw_listing_id: "r1", p_edits: { area_m2: 95 } });

    rpc.mockResolvedValueOnce({ data: { ok: false, error: "gone" }, error: null });
    expect(await reviewApprove("r1", {})).toEqual({ status: "gone" });

    rpc.mockResolvedValueOnce({ data: { ok: false, error: "invalid" }, error: null });
    expect(await reviewApprove("r1", {})).toMatchObject({ status: "error", message: expect.any(String) });
  });

  it("ret gerekçesi ve not gönderilir", async () => {
    rpc.mockResolvedValueOnce({ data: { ok: true }, error: null });
    expect(await reviewReject("r1", "spam", " reklam ")).toEqual({ status: "ok" });
    expect(rpc).toHaveBeenCalledWith("review_reject", { p_raw_listing_id: "r1", p_reason: "spam", p_note: "reklam" });
  });
});
