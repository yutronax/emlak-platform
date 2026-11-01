import { describe, expect, it } from "vitest";

import { createMockShowcaseService, filterFixture } from "./mock-service";
import { selectShowcaseService } from "./service";

describe("selectShowcaseService", () => {
  it("production'da mock hata fırlatır; bayraksız null; dev+bayrak mock", () => {
    expect(() => selectShowcaseService({ nodeEnv: "production", mockFlag: "1" })).toThrow(/mock/i);
    expect(selectShowcaseService({ nodeEnv: "development", mockFlag: undefined })).toBeNull();
    expect(selectShowcaseService({ nodeEnv: "development", mockFlag: "1" })?.kind).toBe("mock");
  });
});

describe("mock vitrin", () => {
  const svc = createMockShowcaseService(0);

  it("sayfalar: 6'şar, nextCursor ile devam", async () => {
    const first = await svc.list({ sort: "yeni" });
    expect(first.status === "ok" && first.items).toHaveLength(6);
    if (first.status !== "ok") throw new Error();
    expect(first.total).toBe(14);
    const second = await svc.list({ sort: "yeni" }, first.nextCursor ?? undefined);
    expect(second.status === "ok" && second.items[0].id).not.toBe(first.items[0].id);
  });

  it("filtreler ve 4+ odası", () => {
    expect(filterFixture({ sort: "yeni", deal: "kiralik", city: "İzmir" }).every((i) => i.deal === "kiralik" && i.city === "İzmir")).toBe(true);
    expect(filterFixture({ sort: "yeni", rooms: "4+" }).map((i) => i.rooms).sort()).toEqual(["4+1", "4+1", "5+2"]);
  });

  it("fiyata göre sıralar", () => {
    const prices = filterFixture({ sort: "fiyat-artan" }).map((i) => i.priceMinor);
    expect(prices).toEqual([...prices].sort((a, b) => a - b));
  });

  it("detay: bulunamayan id not_found; benzerler aynı şehir+işlem", async () => {
    expect((await svc.get("yok")).status).toBe("not_found");
    const res = await svc.get("a1");
    if (res.status !== "ok") throw new Error();
    expect(res.similar.every((s) => s.city === "İzmir" && s.deal === "satilik" && s.id !== "a1")).toBe(true);
  });
});
