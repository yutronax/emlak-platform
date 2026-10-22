// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { signup } from "./actions";
import SignupPage from "./page";

vi.mock("./actions", () => ({
  signup: vi.fn(),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("SignupPage (/signup) — component smoke", () => {
  // AC-1 / AC-6 için giriş alanları: email, password, company_name
  it("e-posta, şifre ve şirket adı için birer input render eder", () => {
    render(<SignupPage />);

    const email = screen.getByPlaceholderText("E-posta");
    const password = screen.getByPlaceholderText("Şifre");
    const companyName = screen.getByPlaceholderText("Şirket adı");

    expect(email).toBeInTheDocument();
    expect(email).toHaveAttribute("name", "email");
    expect(email).toHaveAttribute("type", "email");

    expect(password).toBeInTheDocument();
    expect(password).toHaveAttribute("name", "password");
    expect(password).toHaveAttribute("type", "password");

    expect(companyName).toBeInTheDocument();
    expect(companyName).toHaveAttribute("name", "company_name");
  });

  // Submit butonu planlanan "Kayıt ol" metniyle render edilmeli
  it("'Kayıt ol' metinli bir submit butonu render eder", () => {
    render(<SignupPage />);

    const button = screen.getByRole("button", { name: "Kayıt ol" });
    expect(button).toBeInTheDocument();
    expect(button).toHaveAttribute("type", "submit");
  });

  // Form, useActionState'in action prop'una bağlı bir <form> olmalı
  it("inputları bir <form> içinde sarar (action bağlanmış form)", () => {
    const { container } = render(<SignupPage />);

    const form = container.querySelector("form");
    expect(form).not.toBeNull();
    expect(form).toContainElement(screen.getByPlaceholderText("E-posta"));
    expect(form).toContainElement(screen.getByRole("button", { name: "Kayıt ol" }));
  });

  // Başlangıçta (henüz submit yokken) state boş: hata/mesaj paragrafı görünmemeli
  it("ilk render'da hata veya genel mesaj göstermez", () => {
    const { container } = render(<SignupPage />);

    expect(container.querySelector("p.text-red-600")).toBeNull();
    expect(screen.queryByText(/Kayıt alındı/)).not.toBeInTheDocument();
  });

  // Render sırasında signup action'ı tetiklenmemeli (yalnızca submit'te çağrılır)
  it("render sırasında signup action'ını çağırmaz", () => {
    render(<SignupPage />);

    expect(signup).not.toHaveBeenCalled();
  });
});
