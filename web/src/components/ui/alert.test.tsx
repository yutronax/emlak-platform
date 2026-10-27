// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { Alert } from "./alert";

describe("Alert (ui)", () => {
  afterEach(() => {
    cleanup();
  });

  // AC-3/AC-4 (hata): variant="error" → role="alert" otomatik.
  it("variant=\"error\" iken kök element role=\"alert\" taşır", () => {
    render(<Alert variant="error">E-posta veya şifre hatalı.</Alert>);

    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  // AC-5 (başarı): variant="success" → role="status" otomatik.
  it("variant=\"success\" iken kök element role=\"status\" taşır", () => {
    render(<Alert variant="success">Kayıt başarılı, e-postanızı doğrulayın.</Alert>);

    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  // plan.md madde 4: hata rengi brick-700 token ailesi.
  it("variant=\"error\" iken class'ında brick token'ı geçer", () => {
    render(<Alert variant="error">Hata</Alert>);

    expect(screen.getByRole("alert").className).toContain("brick");
  });

  // plan.md madde 4: başarı rengi moss-700 token ailesi.
  it("variant=\"success\" iken class'ında moss token'ı geçer", () => {
    render(<Alert variant="success">Başarılı</Alert>);

    expect(screen.getByRole("status").className).toContain("moss");
  });

  // children (mesaj metni) component içinde gerçekten render edilmeli.
  it("verilen children mesaj metni olarak render edilir", () => {
    render(<Alert variant="error">Oturum açılamadı.</Alert>);

    expect(screen.getByText("Oturum açılamadı.")).toBeInTheDocument();
  });
});
