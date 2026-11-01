// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { signup } from "./actions";
import SignupPage from "./page";

vi.mock("./actions", () => ({
  signup: vi.fn(),
}));

const TERMS_LABEL =
  "Kullanım Şartları'nı ve KVKK Aydınlatma Metni'ni okudum, kabul ediyorum.";
const TERMS_ERROR = "Devam etmek için şartları kabul etmeniz gerekiyor.";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function completeStep1(password = "Sifre123") {
  fireEvent.change(screen.getByLabelText("E-posta"), { target: { value: "test@example.com" } });
  fireEvent.change(screen.getByLabelText("Şifre"), { target: { value: password } });
  fireEvent.click(screen.getByRole("button", { name: "Devam et" }));
}

function fillStep2({ terms = true, phone = "532 123 45 67" } = {}) {
  fireEvent.change(screen.getByLabelText("Şirket adı"), { target: { value: "Acme Emlak" } });
  fireEvent.change(screen.getByLabelText("WhatsApp numarası"), { target: { value: phone } });
  if (terms) fireEvent.click(screen.getByRole("checkbox", { name: TERMS_LABEL }));
}

describe("SignupPage — adım 1 (hesap)", () => {
  it("başlık, tanıtım paragrafı ve adım göstergesi görünür", () => {
    render(<SignupPage />);

    expect(screen.getByRole("heading", { name: "Ücretsiz Deneyin" })).toBeInTheDocument();
    const paragraph = screen.getByText(/Yeni bir şey öğrenmenize gerek yok/);
    expect(paragraph.className).not.toMatch(/\bhidden\b/);
    expect(screen.getByText("Adım 1 / 2 · Hesap")).toBeInTheDocument();
  });

  it("e-posta ve şifre alanları var, şirket alanı henüz yok", () => {
    render(<SignupPage />);

    expect(screen.getByLabelText("E-posta")).toHaveAttribute("type", "email");
    expect(screen.getByLabelText("Şifre")).toHaveAttribute("autocomplete", "new-password");
    expect(screen.queryByLabelText("Şirket adı")).toBeNull();
  });

  it("şifre gücü canlı gösterilir; renk dışında metinle de belirtilir", () => {
    render(<SignupPage />);

    fireEvent.change(screen.getByLabelText("Şifre"), { target: { value: "sifre123" } });
    expect(screen.getByText("Şifre gücü: Orta")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Şifre"), { target: { value: "Sifre123" } });
    expect(screen.getByText("Şifre gücü: Güçlü")).toBeInTheDocument();
  });

  it("zayıf şifreyle ikinci adıma geçilmez", async () => {
    render(<SignupPage />);
    completeStep1("abc");

    expect(await screen.findByText("Daha güçlü bir şifre seçin.")).toBeInTheDocument();
    expect(screen.queryByLabelText("Şirket adı")).toBeNull();
  });

  it("geçersiz e-postada ikinci adıma geçilmez", async () => {
    render(<SignupPage />);
    fireEvent.change(screen.getByLabelText("E-posta"), { target: { value: "yanlis" } });
    fireEvent.change(screen.getByLabelText("Şifre"), { target: { value: "Sifre123" } });
    fireEvent.click(screen.getByRole("button", { name: "Devam et" }));

    expect(await screen.findByText("Geçerli bir e-posta girin.")).toBeInTheDocument();
    expect(screen.queryByLabelText("Şirket adı")).toBeNull();
  });

  it("adım 1 servis çağırmaz", () => {
    render(<SignupPage />);
    completeStep1();

    expect(signup).not.toHaveBeenCalled();
  });
});

describe("SignupPage — adım 2 (şirket)", () => {
  it("geçerli adım 1 sonrası şirket, telefon ve şartlar görünür; odak şirket adında", () => {
    render(<SignupPage />);
    completeStep1();

    expect(screen.getByText("Adım 2 / 2 · Şirket")).toBeInTheDocument();
    expect(screen.getByLabelText("Şirket adı")).toHaveFocus();
    expect(screen.getByLabelText("WhatsApp numarası")).toHaveAttribute("type", "tel");
    expect(screen.getByRole("checkbox", { name: TERMS_LABEL })).not.toBeChecked();
  });

  it("geri dönünce adım 1 verisi korunur", () => {
    render(<SignupPage />);
    completeStep1();
    fireEvent.click(screen.getByRole("button", { name: "Geri" }));

    expect(screen.getByLabelText("E-posta")).toHaveValue("test@example.com");
    expect(screen.getByLabelText("Şifre")).toHaveValue("Sifre123");
  });

  it("telefon yazarken biçimlendirilir", () => {
    render(<SignupPage />);
    completeStep1();
    fireEvent.change(screen.getByLabelText("WhatsApp numarası"), { target: { value: "05321234567" } });

    expect(screen.getByLabelText("WhatsApp numarası")).toHaveValue("532 123 45 67");
  });

  it("şart linkleri yeni sekmede açılır", () => {
    render(<SignupPage />);
    completeStep1();

    expect(screen.getByRole("link", { name: "Kullanım Şartları" })).toHaveAttribute("target", "_blank");
    expect(screen.getByRole("link", { name: "KVKK Aydınlatma Metni" })).toHaveAttribute("href", "/kvkk");
  });

  // AC-2 (Critical, önceki görev): işaretsiz gönderim reddedilir, hata kutuya bağlı.
  it("şartlar işaretsizken servis çağrılmaz ve hata checkbox'a aria-describedby ile bağlı", async () => {
    render(<SignupPage />);
    completeStep1();
    fillStep2({ terms: false });
    fireEvent.click(screen.getByRole("button", { name: "Hesabı oluştur" }));

    expect(await screen.findByText(TERMS_ERROR)).toBeInTheDocument();
    const checkbox = screen.getByRole("checkbox", { name: TERMS_LABEL });
    expect(document.getElementById(checkbox.getAttribute("aria-describedby") ?? "")?.textContent).toContain(
      TERMS_ERROR,
    );
    expect(signup).not.toHaveBeenCalled();
  });

  it("geçersiz telefonda servis çağrılmaz", async () => {
    render(<SignupPage />);
    completeStep1();
    fillStep2({ phone: "0212 123 45 67" });
    fireEvent.click(screen.getByRole("button", { name: "Hesabı oluştur" }));

    expect(await screen.findByText("Geçerli bir cep telefonu girin (5xx xxx xx xx).")).toBeInTheDocument();
    expect(signup).not.toHaveBeenCalled();
  });

  it("başarıda kesin dil kullanmayan e-posta kontrol ekranı gösterilir", async () => {
    vi.mocked(signup).mockResolvedValue({ message: "Kayıt alındı" });
    render(<SignupPage />);
    completeStep1();
    fillStep2();
    fireEvent.click(screen.getByRole("button", { name: "Hesabı oluştur" }));

    expect(await screen.findByRole("heading", { name: "E-postanızı kontrol edin" })).toBeInTheDocument();
    expect(screen.getByText(/test@example.com/)).toBeInTheDocument();
    expect(screen.queryByText(/gönderdik/)).toBeNull();
    expect(screen.getByRole("link", { name: "Giriş yap" })).toHaveAttribute("href", "/login");
  });

  it("sunucu hatası alert ile gösterilir, form verisi korunur", async () => {
    vi.mocked(signup).mockResolvedValue({ error: "Şirket adı gerekli (2-100 karakter)." });
    render(<SignupPage />);
    completeStep1();
    fillStep2();
    fireEvent.click(screen.getByRole("button", { name: "Hesabı oluştur" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Şirket adı gerekli (2-100 karakter).");
    expect(screen.getByLabelText("Şirket adı")).toHaveValue("Acme Emlak");
  });
});

describe("SignupPage — marka sahnesi", () => {
  it("img/svg yok, dekor aria-hidden; Google düğmesi gerçek serviste gizli", () => {
    const { container } = render(<SignupPage />);

    expect(container.querySelector("img, svg")).toBeNull();
    expect(container.querySelector("[data-auth-decor]")).toHaveAttribute("aria-hidden", "true");
    expect(screen.queryByRole("button", { name: /Google/ })).toBeNull();
  });
});
