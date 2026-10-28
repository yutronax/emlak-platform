import { describe, expect, it } from "vitest";

import {
  ASSET_RULES,
  DELIVERY_BUSINESS_DAYS,
  MAX_FILE_BYTES,
  MAX_PHOTO_BYTES,
  MAX_PHOTOS,
  MAX_RAW_VIDEOS,
  MIN_PHOTOS,
  addBusinessDays,
  kindForService,
} from "./limits";

describe("addBusinessDays (teslim sözü: 2 iş günü, Cmt/Paz sayılmaz)", () => {
  it("Cuma + 2 iş günü → Salı", () => {
    const friday = new Date("2026-10-30T10:00:00+03:00");
    expect(addBusinessDays(friday, DELIVERY_BUSINESS_DAYS)).toEqual(new Date("2026-11-03T10:00:00+03:00"));
  });

  it("Cumartesi + 2 iş günü → Salı", () => {
    const saturday = new Date("2026-10-31T10:00:00+03:00");
    expect(addBusinessDays(saturday, 2)).toEqual(new Date("2026-11-03T10:00:00+03:00"));
  });

  it("Pazar + 1 iş günü → Pazartesi", () => {
    const sunday = new Date("2026-11-01T10:00:00+03:00");
    expect(addBusinessDays(sunday, 1)).toEqual(new Date("2026-11-02T10:00:00+03:00"));
  });

  it("Pazartesi + 2 iş günü → Çarşamba (hafta sonu yok)", () => {
    const monday = new Date("2026-11-02T10:00:00+03:00");
    expect(addBusinessDays(monday, 2)).toEqual(new Date("2026-11-04T10:00:00+03:00"));
  });

  it("girdi tarihini değiştirmez", () => {
    const input = new Date("2026-10-30T10:00:00+03:00");
    const before = input.getTime();
    addBusinessDays(input, 2);
    expect(input.getTime()).toBe(before);
  });
});

describe("sınırlar ve izinli türler", () => {
  it("ham video dosya sınırı 50 MB, fotoğraf 20 MB", () => {
    expect(MAX_FILE_BYTES).toBe(52428800);
    expect(MAX_PHOTO_BYTES).toBe(20971520);
  });

  it("sayı sınırları: 30 fotoğraf, 5 video, en az 3 fotoğraf", () => {
    expect(MAX_PHOTOS).toBe(30);
    expect(MAX_RAW_VIDEOS).toBe(5);
    expect(MIN_PHOTOS).toBe(3);
  });

  it("hizmet → varlık türü eşlemesi", () => {
    expect(kindForService("photos")).toBe("photo");
    expect(kindForService("raw_video")).toBe("raw_video");
    expect(kindForService("onsite")).toBeNull();
  });

  it("izinli uzantılar ve MIME türleri", () => {
    expect(ASSET_RULES.photo.extensions).toEqual(["jpg", "jpeg", "png", "webp", "heic"]);
    expect(ASSET_RULES.photo.mimeTypes).toEqual(["image/jpeg", "image/png", "image/webp", "image/heic"]);
    expect(ASSET_RULES.raw_video.extensions).toEqual(["mp4", "mov", "webm"]);
    expect(ASSET_RULES.raw_video.mimeTypes).toEqual(["video/mp4", "video/quicktime", "video/webm"]);
  });
});
