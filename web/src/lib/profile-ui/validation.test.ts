import { describe, expect, it } from "vitest";

import { validateCompany, validateEmailChange, validateLogo, validatePasswordChange } from "./validation";

describe("validateCompany", () => {
  const ok = { companyName: "Acme Emlak", contactName: "Ayşe Yılmaz", city: "İzmir", district: "" };

  it("geçerli girişte hata yok (ilçe opsiyonel)", () => {
    expect(validateCompany(ok)).toEqual({});
  });

  it("kısa/uzun şirket adı, kısa yetkili adı ve boş şehir hatalı", () => {
    expect(validateCompany({ companyName: "A", contactName: "B", city: "  ", district: "" })).toEqual({
      companyName: "Şirket adını girin (2-100 karakter).",
      contactName: "Yetkili adını girin (2-80 karakter).",
      city: "Şehir seçin.",
    });
    expect(validateCompany({ ...ok, companyName: "x".repeat(101) }).companyName).toBeDefined();
  });
});

describe("validateEmailChange", () => {
  it("biçim hatası", () => {
    expect(validateEmailChange("yanlis", "a@b.co")).toBe("Geçerli bir e-posta girin.");
  });
  it("mevcut adresle aynıysa (büyük/küçük harf farkı dahil) hata", () => {
    expect(validateEmailChange(" A@B.co ", "a@b.co")).toBe("Yeni adres mevcut adresinizle aynı.");
  });
  it("geçerli farklı adres", () => {
    expect(validateEmailChange("yeni@b.co", "a@b.co")).toBeUndefined();
  });
});

describe("validatePasswordChange", () => {
  it("boş mevcut şifre, zayıf yeni şifre, eşleşmeyen tekrar", () => {
    expect(validatePasswordChange({ current: "", next: "abc", confirm: "x" })).toEqual({
      current: "Mevcut şifrenizi girin.",
      next: "Daha güçlü bir şifre seçin.",
      confirm: "Şifreler eşleşmiyor.",
    });
  });
  it("yeni şifre mevcutla aynı olamaz", () => {
    expect(validatePasswordChange({ current: "Sifre123", next: "Sifre123", confirm: "Sifre123" }).next).toBe(
      "Yeni şifre mevcut şifreden farklı olmalı.",
    );
  });
  it("geçerli", () => {
    expect(validatePasswordChange({ current: "eski1234", next: "Yeni1234", confirm: "Yeni1234" })).toEqual({});
  });
});

describe("validateLogo", () => {
  it("desteklenmeyen tip", () => {
    expect(validateLogo({ type: "image/gif", size: 1000 })).toBe("Logo PNG, JPG veya WEBP olmalı.");
  });
  it("2 MB üstü", () => {
    expect(validateLogo({ type: "image/png", size: 2 * 1024 * 1024 + 1 })).toBe("Logo en fazla 2 MB olabilir.");
  });
  it("geçerli", () => {
    expect(validateLogo({ type: "image/webp", size: 2 * 1024 * 1024 })).toBeUndefined();
  });
});
