import { describe, expect, it, vi } from "vitest";

import { selectProfileService } from "./service";

vi.mock("@/app/account/profile/actions", () => ({}));

describe("selectProfileService", () => {
  it("dev'de açık bayrakla mock", () => {
    expect(selectProfileService({ nodeEnv: "development", mockFlag: "1" }).kind).toBe("mock");
  });

  it("production'da mock bayrağı hata fırlatır (sahte profil gösterilmez)", () => {
    expect(() => selectProfileService({ nodeEnv: "production", mockFlag: "1" })).toThrow(/mock/i);
  });

  it("bayraksız gerçek servis", () => {
    expect(selectProfileService({ nodeEnv: "production", mockFlag: undefined }).kind).toBe("real");
    expect(selectProfileService({ nodeEnv: "development", mockFlag: undefined }).kind).toBe("real");
  });
});
