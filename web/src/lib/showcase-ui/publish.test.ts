import { describe, expect, it } from "vitest";

import { validatePublish, type PublishInput } from "./publish";

const ok: PublishInput = {
  deal: "satilik",
  price: "8.450.000",
  city: " İzmir ",
  district: "",
  rooms: "3+1",
  areaM2: "135",
  floor: "",
  buildingAge: "",
  heating: "Kombi",
  description: "",
  phoneConsent: true,
};

describe("validatePublish", () => {
  it("geçerli girişi kolonlara çevirir: fiyat kuruş, boşlar null", () => {
    expect(validatePublish(ok)).toEqual({
      errors: {},
      columns: {
        deal: "satilik",
        price_minor: 845_000_000,
        city: "İzmir",
        district: null,
        rooms: "3+1",
        area_m2: 135,
        floor: null,
        building_age: null,
        heating: "Kombi",
        description: null,
      },
    });
  });

  it("telefon onayı olmadan yayınlanamaz", () => {
    const r = validatePublish({ ...ok, phoneConsent: false });
    expect(r.columns).toBeNull();
    expect(r.errors.phoneConsent).toBeTruthy();
  });

  it("zorunlu alan ve biçim hataları", () => {
    const r = validatePublish({ ...ok, deal: "", price: "abc", city: " ", rooms: "üç", areaM2: "0", buildingAge: "-1" });
    expect(Object.keys(r.errors).sort()).toEqual(["areaM2", "buildingAge", "city", "deal", "price", "rooms"]);
  });
});
