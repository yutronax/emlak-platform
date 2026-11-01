import { describe, expect, it } from "vitest";

import { selectProfileService } from "./service";

describe("selectProfileService", () => {
  it("dev'de açık bayrakla mock", () => {
    expect(selectProfileService({ nodeEnv: "development", mockFlag: "1" })?.kind).toBe("mock");
  });

  it("production'da mock bayrağı hata fırlatır (sahte profil gösterilmez)", () => {
    expect(() => selectProfileService({ nodeEnv: "production", mockFlag: "1" })).toThrow(/mock/i);
  });

  it("gerçek servis henüz yok: bayraksız null döner", () => {
    expect(selectProfileService({ nodeEnv: "production", mockFlag: undefined })).toBeNull();
    expect(selectProfileService({ nodeEnv: "development", mockFlag: undefined })).toBeNull();
  });
});
